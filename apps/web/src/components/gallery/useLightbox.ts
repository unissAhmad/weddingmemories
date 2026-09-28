import { useCallback, useEffect, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

export interface LightboxItem {
  src: string;
  width: number;
  height: number;
  msrc?: string;
  alt?: string;
  caption?: string;
}

const DOWNLOAD_ICON =
  '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32"><path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1-1.5-1.6ZM23 23H9v2h14" /></svg>';

/**
 * PhotoSwipe with a live data source: items can grow while the lightbox is open (infinite
 * scroll), and `onNearEnd` lets the caller load the next page as the viewer swipes.
 */
export function useLightbox(items: LightboxItem[], opts: { onNearEnd?: () => void } = {}) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const nearEndRef = useRef(opts.onNearEnd);
  nearEndRef.current = opts.onNearEnd;
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.96,
      showHideAnimationType: 'fade',
      loop: false,
      preload: [1, 2],
      paddingFn: (viewport) => (viewport.x < 640 ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 40, bottom: 72, left: 60, right: 60 }),
    });

    lightbox.addFilter('numItems', () => itemsRef.current.length);
    lightbox.addFilter('itemData', (_data, index) => ({ ...itemsRef.current[index] }));

    lightbox.on('uiRegister', () => {
      const pswp = lightbox.pswp!;
      pswp.ui!.registerElement({
        name: 'caption',
        order: 9,
        isButton: false,
        appendTo: 'root',
        onInit: (el) => {
          el.className = 'pswp__custom-caption';
          const update = () => {
            el.textContent = itemsRef.current[pswp.currIndex]?.caption ?? '';
          };
          pswp.on('change', update);
          update();
        },
      });
      pswp.ui!.registerElement({
        name: 'download',
        order: 8,
        isButton: true,
        tagName: 'a',
        title: 'Open full size',
        html: DOWNLOAD_ICON,
        onInit: (el) => {
          const a = el as HTMLAnchorElement;
          a.target = '_blank';
          a.rel = 'noopener';
          const update = () => {
            a.href = itemsRef.current[pswp.currIndex]?.src ?? '#';
          };
          pswp.on('change', update);
          update();
        },
      });
    });

    lightbox.on('change', () => {
      const pswp = lightbox.pswp;
      if (pswp && pswp.currIndex >= itemsRef.current.length - 4) nearEndRef.current?.();
    });

    lightbox.init();
    lightboxRef.current = lightbox;
    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
    };
  }, []);

  return useCallback((index: number) => {
    lightboxRef.current?.loadAndOpen(index);
  }, []);
}
