import { renderHook } from '@testing-library/react';

import { useLastSuccessfulQueryTime } from '@/hooks/useLastSuccessfulQueryTime';

const initial = {
  queryIdentity: 'logs:billing-api',
  completedUntil: undefined as number | undefined,
  isFetching: true,
  isError: false,
  isPlaceholderData: false,
};

describe('last successfully fetched time', () => {
  it('advances only after a complete successful fetch, including empty results', () => {
    const { result, rerender } = renderHook(useLastSuccessfulQueryTime, {
      initialProps: initial,
    });
    expect(result.current).toBeUndefined();
    rerender({ ...initial, completedUntil: 100 });
    expect(result.current).toBeUndefined();
    rerender({ ...initial, completedUntil: 100, isFetching: false });
    expect(result.current).toBe(100);
    rerender({ ...initial, completedUntil: 200 });
    expect(result.current).toBe(100);
    rerender({
      ...initial,
      completedUntil: 200,
      isFetching: false,
      isError: true,
    });
    expect(result.current).toBe(100);
    rerender({
      ...initial,
      completedUntil: 200,
      isFetching: false,
      isPlaceholderData: true,
    });
    expect(result.current).toBe(100);
    rerender({ ...initial, completedUntil: 200, isFetching: false });
    expect(result.current).toBe(200);
  });

  it('does not move backward while paginating older windows', () => {
    const { result, rerender } = renderHook(useLastSuccessfulQueryTime, {
      initialProps: { ...initial, completedUntil: 200, isFetching: false },
    });
    rerender({ ...initial, completedUntil: 100, isFetching: false });
    expect(result.current).toBe(200);
  });

  it('clears the timestamp for a different source or search, even with placeholder data', () => {
    const { result, rerender } = renderHook(useLastSuccessfulQueryTime, {
      initialProps: { ...initial, completedUntil: 200, isFetching: false },
    });
    rerender({
      ...initial,
      queryIdentity: 'logs:payments',
      completedUntil: 200,
      isPlaceholderData: true,
    });
    expect(result.current).toBeUndefined();
    rerender({
      ...initial,
      queryIdentity: 'logs:payments',
      completedUntil: 100,
      isFetching: false,
    });
    expect(result.current).toBe(100);
  });
});
