import { useEffect, useMemo, useRef, useState } from 'react';

interface MasonryProps<T> {
  items: T[];
  getRatio: (item: T) => number; // height / width
  getKey: (item: T) => string;
  render: (item: T, index: number) => React.ReactNode;
  gap?: number;
}

function columnsFor(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

/**
 * Shortest-column masonry. Unlike CSS columns, appending a page never moves photos that are
 * already on screen, which matters for infinite scroll.
 */
export function Masonry<T>({ items, getRatio, getKey, render, gap = 8 }: MasonryProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCols(columnsFor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    const out: { item: T; index: number }[][] = Array.from({ length: cols }, () => []);
    const heights = new Array<number>(cols).fill(0);
    items.forEach((item, index) => {
      let shortest = 0;
      for (let c = 1; c < cols; c++) if (heights[c]! < heights[shortest]!) shortest = c;
      out[shortest]!.push({ item, index });
      heights[shortest]! += getRatio(item);
    });
    return out;
  }, [items, cols, getRatio]);

  return (
    <div ref={ref} className="flex items-start" style={{ gap }}>
      {columns.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
          {col.map(({ item, index }) => (
            <div key={getKey(item)}>{render(item, index)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
