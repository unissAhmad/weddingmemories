const KEY = 'wm:lastEvent';

/**
 * The installed app always opens at "/", so remember the event the guest last visited and
 * send them straight back to it. Storage can be unavailable (private mode), so never throw.
 */
export function rememberEvent(slug: string) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    // ignore
  }
}

export function lastEvent(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
