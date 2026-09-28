import { BasePlugin, type DefinePluginOpts, type PluginOpts, type Uppy, type UppyFile } from '@uppy/core';
import { UPLOAD_CHUNK_SIZE, type SignedUpload } from '@wm/shared';

/**
 * Progress lives in file meta, which GoldenRetriever persists. After a reload or a retry the
 * upload continues from the last finished chunk, and a file Cloudinary already stored is never
 * uploaded twice.
 */
export type UploadMeta = {
  wmPhotoId?: string;
  wmUploadUrl?: string;
  wmParams?: string;
  wmSignedAt?: number;
  wmUploadId?: string;
  wmNextByte?: number;
  wmResult?: string;
};
type Body = Record<string, never>;
type File = UppyFile<UploadMeta, Body>;

export interface CloudinaryUploaderOptions extends PluginOpts {
  /** Ask the API for a photo id and a signed Cloudinary upload. */
  init: (file: File) => Promise<SignedUpload & { photoId: string }>;
  /** Tell the API the upload finished (with Cloudinary's signed response). */
  complete: (photoId: string, result: unknown) => Promise<void>;
  /** Tell the API an unfinished upload was cancelled. */
  abort: (photoId: string) => Promise<void>;
  /** Uploads running at the same time. */
  limit?: number;
  retryDelays?: number[];
}

const defaults = { limit: 3, retryDelays: [1000, 3000, 5000, 10000, 20000, 30000] };

/** Cloudinary rejects signatures older than an hour; re-sign a little before that. */
const SIGNATURE_MAX_AGE_MS = 50 * 60 * 1000;

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

interface PostOptions {
  url: string;
  form: FormData;
  headers?: Record<string, string>;
  signal: AbortSignal;
  onProgress: (loaded: number) => void;
}

/** XHR rather than fetch: it's the only way to get upload progress in every browser. */
function post({ url, form, headers, signal, onProgress }: PostOptions): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 120_000;
    for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      const message = (body.error as { message?: string } | undefined)?.message;
      reject(new UploadError(message ?? `Upload failed (${xhr.status})`, xhr.status >= 500 || xhr.status === 429));
    };
    xhr.onerror = () => reject(new UploadError('Connection lost', true));
    xhr.ontimeout = () => reject(new UploadError('Upload timed out', true));
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    xhr.send(form);
  });
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Aborted', 'AbortError'))), {
      once: true,
    });
  });

export default class CloudinaryUploader extends BasePlugin<
  DefinePluginOpts<CloudinaryUploaderOptions, keyof typeof defaults>,
  UploadMeta,
  Body
> {
  #controllers = new Map<string, AbortController>();

  constructor(uppy: Uppy<UploadMeta, Body>, opts: CloudinaryUploaderOptions) {
    super(uppy, { ...defaults, ...opts });
    this.id = opts.id ?? 'CloudinaryUploader';
    this.type = 'uploader';
  }

  install() {
    this.uppy.addUploader(this.#upload);
    this.uppy.on('file-removed', this.#onFileRemoved);
    this.uppy.on('cancel-all', this.#onCancelAll);
  }

  uninstall() {
    this.uppy.removeUploader(this.#upload);
    this.uppy.off('file-removed', this.#onFileRemoved);
    this.uppy.off('cancel-all', this.#onCancelAll);
  }

  #onFileRemoved = (file: File) => {
    this.#controllers.get(file.id)?.abort();
    this.#controllers.delete(file.id);
    if (file.meta.wmPhotoId && !file.progress.uploadComplete) {
      void this.opts.abort(file.meta.wmPhotoId).catch(() => {});
    }
  };

  #onCancelAll = () => {
    for (const c of this.#controllers.values()) c.abort();
    this.#controllers.clear();
  };

  #upload = async (fileIDs: string[]) => {
    const files = fileIDs.map((id) => this.uppy.getFile(id)).filter(Boolean);
    this.uppy.emit('upload-start', files);

    const queue = [...files];
    const run = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) await this.#uploadFile(file.id);
    };
    await Promise.all(Array.from({ length: Math.min(this.opts.limit, files.length) }, run));
  };

  async #uploadFile(fileId: string) {
    const controller = new AbortController();
    this.#controllers.set(fileId, controller);
    const { signal } = controller;

    for (let attempt = 0; ; attempt++) {
      try {
        await this.#attempt(fileId, signal);
        const file = this.uppy.getFile(fileId);
        if (file) this.uppy.emit('upload-success', file, { status: 200, body: {} });
        break;
      } catch (err) {
        if (signal.aborted || !this.uppy.getFile(fileId)) break;
        const retryable = !(err instanceof UploadError) || err.retryable;
        const delay = this.opts.retryDelays[attempt];
        if (retryable && delay !== undefined) {
          await sleep(delay, signal).catch(() => {});
          if (signal.aborted) break;
          continue;
        }
        const file = this.uppy.getFile(fileId);
        const message = err instanceof Error ? err.message : 'Upload failed';
        if (file) this.uppy.emit('upload-error', file, { name: 'UploadError', message });
        break;
      }
    }
    this.#controllers.delete(fileId);
  }

  async #attempt(fileId: string, signal: AbortSignal) {
    let file = this.uppy.getFile(fileId);
    if (!file.data) throw new UploadError('File data is missing. Please add it again.', false);

    if (!file.meta.wmResult) {
      const signedAt = file.meta.wmSignedAt ?? 0;
      if (!file.meta.wmPhotoId || Date.now() - signedAt > SIGNATURE_MAX_AGE_MS) {
        const init = await this.opts.init(file);
        this.uppy.setFileMeta(fileId, {
          wmPhotoId: init.photoId,
          wmUploadUrl: init.uploadUrl,
          wmParams: JSON.stringify(init.params),
          wmSignedAt: Date.now(),
          wmUploadId: crypto.randomUUID(),
          wmNextByte: 0,
        });
        file = this.uppy.getFile(fileId);
      }
      const result = await this.#sendToCloudinary(file, signal);
      this.uppy.setFileMeta(fileId, { wmResult: JSON.stringify(result) });
      file = this.uppy.getFile(fileId);
    }

    await this.opts.complete(file.meta.wmPhotoId!, JSON.parse(file.meta.wmResult!));
  }

  /** Small files in one request; larger ones in ≥5 MB chunks that Cloudinary reassembles. */
  async #sendToCloudinary(file: File, signal: AbortSignal) {
    const blob = file.data as Blob;
    const total = blob.size;
    const params = JSON.parse(file.meta.wmParams!) as Record<string, string>;
    const started = Date.now();
    const report = (bytesUploaded: number) => {
      const current = this.uppy.getFile(file.id);
      if (current) {
        this.uppy.emit('upload-progress', current, {
          uploadStarted: started,
          bytesUploaded: Math.min(bytesUploaded, total),
          bytesTotal: total,
        });
      }
    };
    const form = (part: Blob) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(params)) f.append(k, v);
      f.append('file', part, file.name ?? 'photo');
      return f;
    };

    if (total <= UPLOAD_CHUNK_SIZE) {
      return post({ url: file.meta.wmUploadUrl!, form: form(blob), signal, onProgress: report });
    }

    let result: Record<string, unknown> = {};
    for (let start = file.meta.wmNextByte ?? 0; start < total; start += UPLOAD_CHUNK_SIZE) {
      const end = Math.min(start + UPLOAD_CHUNK_SIZE, total);
      result = await post({
        url: file.meta.wmUploadUrl!,
        form: form(blob.slice(start, end)),
        headers: {
          'X-Unique-Upload-Id': file.meta.wmUploadId!,
          'Content-Range': `bytes ${start}-${end - 1}/${total}`,
        },
        signal,
        onProgress: (loaded) => report(start + loaded),
      });
      this.uppy.setFileMeta(file.id, { wmNextByte: end });
    }
    return result;
  }
}
