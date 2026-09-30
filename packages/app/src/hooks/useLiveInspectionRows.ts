import { useCallback, useMemo, useState } from 'react';

// Preserve only explicitly expanded rows, not an ever-growing history of logs.
// A live refresh can briefly omit older rows while it loads more time windows.
export function useLiveInspectionRows<T>({
  rows,
  getRowId,
  scope,
  enabled,
}: {
  rows: T[];
  getRowId: (row: T) => string;
  scope: string;
  enabled: boolean;
}) {
  const [held, setHeld] = useState<{
    scope: string;
    rows: Map<string, { row: T; index: number }>;
  }>({ scope, rows: new Map() });

  const displayedRows = useMemo(() => {
    if (!enabled || held.scope !== scope || held.rows.size === 0) return rows;
    const result = rows.filter(row => !held.rows.has(getRowId(row)));
    const inspections = [...held.rows.values()].sort(
      (a, b) => a.index - b.index,
    );
    for (const { row, index } of inspections) {
      result.splice(Math.min(index, result.length), 0, row);
    }
    return result;
  }, [rows, enabled, held, scope, getRowId]);

  const holdRow = useCallback(
    (id: string) => {
      const index = displayedRows.findIndex(row => getRowId(row) === id);
      if (index < 0) return;
      const row = displayedRows[index];
      setHeld(previous => {
        const next = new Map(previous.scope === scope ? previous.rows : []);
        next.set(id, { row, index });
        return { scope, rows: next };
      });
    },
    [displayedRows, scope, getRowId],
  );

  const releaseRow = useCallback((id: string) => {
    setHeld(previous => {
      const next = new Map(previous.rows);
      next.delete(id);
      return { ...previous, rows: next };
    });
  }, []);
  const clearRows = useCallback(
    () => setHeld({ scope, rows: new Map() }),
    [scope],
  );

  return {
    rows: displayedRows,
    holdRow,
    releaseRow,
    clearRows,
    hasHeldRows: enabled && held.scope === scope && held.rows.size > 0,
  };
}
