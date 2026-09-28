import { useCallback, useState } from 'react';

/** Set-based multi-select for bulk actions. */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected(on ? new Set(ids) : new Set());
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, ids: [...selected], count: selected.size, toggle, setAll, clear };
}

export function headerCheckState(selectedCount: number, total: number): boolean | 'indeterminate' {
  if (selectedCount === 0 || total === 0) return false;
  return selectedCount >= total ? true : 'indeterminate';
}
