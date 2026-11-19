import { act, renderHook } from '@testing-library/react';

import { useLiveInspectionRows } from '@/hooks/useLiveInspectionRows';

const getRowId = (row: { id: string }) => row.id;

it('keeps a row opened while paused when live mode resumes', () => {
  const row = { id: 'inspecting' };
  const { result, rerender } = renderHook(
    ({ rows, enabled }) =>
      useLiveInspectionRows({ rows, enabled, getRowId, scope: 'same-query' }),
    { initialProps: { rows: [row], enabled: false } },
  );
  act(() => result.current.holdRow(row.id));
  rerender({ rows: [], enabled: true });
  expect(result.current.rows).toEqual([row]);
});

it('retains only inspected rows in place through partial and replacement live results', () => {
  const first = { id: 'first' };
  const inspecting = { id: 'inspecting' };
  const next = { id: 'next' };
  const { result, rerender } = renderHook(
    ({ rows, scope, enabled }) =>
      useLiveInspectionRows({ rows, scope, enabled, getRowId }),
    {
      initialProps: {
        rows: [first, inspecting],
        scope: 'logs-query',
        enabled: true,
      },
    },
  );
  act(() => result.current.holdRow('inspecting'));
  rerender({ rows: [next, first], scope: 'logs-query', enabled: true });
  expect(result.current.rows).toEqual([next, inspecting, first]);
  rerender({ rows: [next], scope: 'logs-query', enabled: true });
  expect(result.current.rows).toEqual([next, inspecting]);
  rerender({ rows: [next, inspecting], scope: 'logs-query', enabled: true });
  expect(result.current.rows).toEqual([next, inspecting]);
  rerender({ rows: [next], scope: 'logs-query', enabled: true });
  act(() => result.current.releaseRow('inspecting'));
  expect(result.current.rows).toEqual([next]);
  expect(result.current.hasHeldRows).toBe(false);
});

it('does not inject held rows into other searches or non-live results', () => {
  const rows = [{ id: 'old' }];
  const { result, rerender } = renderHook(
    ({ scope, enabled, rows }) =>
      useLiveInspectionRows({ rows, scope, enabled, getRowId }),
    { initialProps: { scope: 'query-a', enabled: true, rows } },
  );
  act(() => result.current.holdRow('old'));
  rerender({ scope: 'query-b', enabled: true, rows: [] });
  expect(result.current.rows).toEqual([]);
  expect(result.current.hasHeldRows).toBe(false);
  rerender({ scope: 'query-a', enabled: false, rows: [] });
  expect(result.current.rows).toEqual([]);
  act(() => result.current.clearRows());
  rerender({ scope: 'query-a', enabled: true, rows: [] });
  expect(result.current.rows).toEqual([]);
});
