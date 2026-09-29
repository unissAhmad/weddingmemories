import { useEffect } from 'react';
import type { Theme } from '@wm/shared';

/** Applies the event's colour theme to the page (and the phone's browser chrome) while mounted. */
export function useEventTheme(theme: Theme | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--background').trim() || previous || '';
    return () => {
      delete root.dataset.theme;
      if (meta && previous) meta.content = previous;
    };
  }, [theme]);
}
