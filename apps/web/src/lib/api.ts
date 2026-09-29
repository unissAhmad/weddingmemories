import { toast } from 'sonner';
import { ApiErrorBodySchema, CSRF_HEADER } from '@wm/shared';

const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

/** Absolute URL for plain links to the API (e.g. file downloads). */
export const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/*
 * On free hosting the API sleeps when idle and can take a minute or more to wake. While it
 * boots, the proxy answers 502/503/504: the request never reached the app, so it is safe to
 * retry, even for sign-in or uploads. Guests see a gentle notice instead of an error.
 */
const GATEWAY_STATUSES = new Set([502, 503, 504]);
const WAKE_UP_BUDGET_MS = 3 * 60_000;
const SLOW_NOTICE_AFTER_MS = 4000;

let slowRequests = 0;
function trackSlow() {
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    if (slowRequests++ === 0) {
      toast.loading('Waking up… this can take up to a minute on the first visit.', { id: 'waking-up' });
    }
  }, SLOW_NOTICE_AFTER_MS);
  return () => {
    clearTimeout(timer);
    if (shown && --slowRequests === 0) toast.dismiss('waking-up');
  };
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

export async function api<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers[CSRF_HEADER] = '1';

  const done = trackSlow();
  const started = Date.now();
  let res: Response;
  try {
    for (let attempt = 0; ; attempt++) {
      const outOfTime = Date.now() - started > WAKE_UP_BUDGET_MS;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          method,
          credentials: 'include',
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        // A dropped connection may have reached the server, so only reads are retried here.
        if (method === 'GET' && !outOfTime) {
          await wait(Math.min(2000 * 2 ** attempt, 10_000), signal);
          continue;
        }
        throw new ApiError(0, 'NETWORK', 'No connection. Check your internet and try again.');
      }
      if (!GATEWAY_STATUSES.has(res.status) || outOfTime) break;
      await wait(Math.min(2000 * 2 ** attempt, 10_000), signal);
    }
  } finally {
    done();
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code, message, details);
    }
    if (GATEWAY_STATUSES.has(res.status)) {
      throw new ApiError(res.status, 'UNAVAILABLE', 'The server is taking too long to respond. Please try again.');
    }
    throw new ApiError(res.status, 'INTERNAL', 'Something went wrong. Please try again.');
  }
  return data as T;
}

export const isApiError = (err: unknown, code?: string): err is ApiError =>
  err instanceof ApiError && (code === undefined || err.code === code);
