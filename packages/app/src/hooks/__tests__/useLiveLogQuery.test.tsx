import type {
  BuilderChartConfigWithDateRange,
  ChartConfigWithOptTimestamp,
} from '@hyperdx/common-utils/dist/types';
import { act, renderHook } from '@testing-library/react';

import useLiveLogQuery, {
  chronologicalLogConfig,
} from '@/hooks/useLiveLogQuery';
import useOffsetPaginatedQuery from '@/hooks/useOffsetPaginatedQuery';

jest.mock('@/hooks/useOffsetPaginatedQuery');
const query = jest.mocked(useOffsetPaginatedQuery);
const fetchNextPage = jest.fn();
const config = (start = 0, end = 60000, source = 'logs') =>
  ({
    source,
    timestampValueExpression: 'Timestamp',
    orderBy: 'Timestamp ASC',
    dateRange: [new Date(start), new Date(end)],
    select: 'Timestamp, Body',
    limit: { limit: 100 },
  }) as ChartConfigWithOptTimestamp;
const response = (rows: number[] = [], overrides = {}) => ({
  data: {
    data: rows.map(Timestamp => ({ Timestamp, Body: `line ${Timestamp}` })),
    meta: [],
    chSql: { sql: '', params: {} },
    window: {
      startTime: new Date(0),
      endTime: new Date(60000),
      windowIndex: 0,
      direction: 'ASC' as const,
    },
  },
  fetchNextPage,
  hasNextPage: true,
  isFetching: false,
  isLoading: false,
  isError: false,
  error: null,
  refreshedUntil: undefined,
  ...overrides,
});
beforeEach(() => {
  jest.clearAllMocks();
  query.mockReturnValue(response([1, 2, 3]));
  jest.spyOn(Date, 'now').mockReturnValue(70000);
});
afterEach(() => jest.restoreAllMocks());

it('refreshes live latest to the current clock on every explicit check without paging through the backlog', () => {
  const cache = new Map<string, ReturnType<typeof response>>();
  query.mockImplementation(input => {
    const order = (input as BuilderChartConfigWithDateRange).orderBy;
    const end = input.dateRange[1].getTime();
    const key = `${order}:${end}`;
    if (!cache.has(key))
      cache.set(
        key,
        response(
          order === 'Timestamp DESC'
            ? Array.from({ length: 1000 }, (_, index) => end - 1 - index)
            : [1],
        ),
      );
    return cache.get(key)!;
  });
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  jest.mocked(Date.now).mockReturnValue(600000);
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(result.current.requestedRange.map(date => date.getTime())).toEqual([
    540000, 600000,
  ]);
  expect(result.current.data?.data).toHaveLength(1000);
  expect(result.current.data?.data[0].Timestamp).toBe(599000);
  expect(result.current.data?.data.at(-1)?.Timestamp).toBe(599999);
  jest.mocked(Date.now).mockReturnValue(700000);
  rerender();
  expect(result.current.refreshedUntil).toBe(600000);
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(result.current.requestedRange.map(date => date.getTime())).toEqual([
    640000, 700000,
  ]);
  expect(result.current.data?.data).toHaveLength(1000);
  expect(result.current.data?.data[0].Timestamp).toBe(699000);
  expect(result.current.data?.data.at(-1)?.Timestamp).toBe(699999);
  expect(result.current.refreshedUntil).toBe(700000);
  expect(result.current.hasNextPage).toBe(false);
  expect(fetchNextPage).not.toHaveBeenCalled();
  jest.mocked(Date.now).mockReturnValue(800000);
  act(() => result.current.jumpToLatest?.());
  expect(result.current.refreshedUntil).toBe(800000);
});

it('starts ASC at the selected beginning and remains idle after a nonempty page', () => {
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  expect(
    (query.mock.calls[0][0] as BuilderChartConfigWithDateRange).orderBy,
  ).toBe('Timestamp ASC');
  expect(query.mock.calls[0][0].dateRange[0].getTime()).toBe(0);
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    1, 2, 3,
  ]);
  expect(result.current.hasNextPage).toBe(true);
  expect(result.current.refreshedUntil).toBeUndefined();
  rerender();
  expect(fetchNextPage).not.toHaveBeenCalled();
  expect(query.mock.calls.at(-1)?.[1]?.enabled).toBe(false);
});

it('isolates a remounted session from cached pages while keeping its own query identity stable', () => {
  const cached = new Map<string, ReturnType<typeof response>>();
  query.mockImplementation((_input, options) => {
    const prefix = options?.queryKeyPrefix ?? '';
    if (!cached.has(prefix)) cached.set(prefix, response([1, 2, 3]));
    return cached.get(prefix)!;
  });
  const first = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  const firstPrefix = query.mock.calls.at(-1)?.[1]?.queryKeyPrefix;
  act(() => {
    void first.result.current.fetchNextPage();
  });
  cached.set(firstPrefix!, response([1, 2, 3, 4, 5]));
  first.rerender();
  expect(first.result.current.data?.data).toHaveLength(5);
  expect(query.mock.calls.at(-1)?.[1]?.queryKeyPrefix).toBe(firstPrefix);
  first.unmount();
  const second = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  expect(second.result.current.data?.data.map(row => row.Timestamp)).toEqual([
    1, 2, 3,
  ]);
  expect(query.mock.calls.at(-1)?.[1]?.queryKeyPrefix).not.toBe(firstPrefix);
});

it('loads one historical page per request and coalesces pending gestures', () => {
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => {
    void result.current.fetchNextPage();
    void result.current.fetchNextPage();
  });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  query.mockReturnValue(response([1, 2, 3, 4, 5]));
  rerender();
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  expect(result.current.refreshedUntil).toBeUndefined();
});

it('crosses empty windows within one load and stops at the first nonempty page', () => {
  query.mockReturnValue(response([]));
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  query.mockReturnValue(response([]));
  rerender();
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
  query.mockReturnValue(response([100]));
  rerender();
  expect(result.current.data?.data).toHaveLength(1);
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
  expect(result.current.refreshedUntil).toBeUndefined();
});

it('requires an explicit newer check and moves the live window to now without cascading', () => {
  query.mockReturnValue(response([1, 2], { hasNextPage: false }));
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  expect(result.current.refreshedUntil).toBe(60000);
  jest.mocked(Date.now).mockReturnValue(600000);
  rerender();
  expect(
    query.mock.calls.at(-1)?.[0].dateRange.map(date => date.getTime()),
  ).toEqual([0, 60000]);
  query.mockReturnValue(response([], { isFetching: true }));
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(result.current.requestedRange.map(date => date.getTime())).toEqual([
    540000, 600000,
  ]);
  expect(result.current.refreshedUntil).toBe(60000);
  query.mockReturnValue(response([2, 3], { hasNextPage: false }));
  rerender();
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([2, 3]);
  expect(result.current.refreshedUntil).toBe(600000);
  rerender();
  expect(result.current.requestedRange[1].getTime()).toBe(600000);
});

it('freezes in-flight data during inspection and applies it without another query on resume', () => {
  const { result, rerender } = renderHook(
    ({ paused }) =>
      useLiveLogQuery(config(), { manualNavigation: true, paused }),
    { initialProps: { paused: false } },
  );
  act(() => {
    void result.current.fetchNextPage();
  });
  query.mockReturnValue(response([1, 2, 3, 4], { hasNextPage: false }));
  rerender({ paused: true });
  expect(result.current.data?.data).toHaveLength(3);
  act(() => {
    void result.current.fetchNextPage();
  });
  rerender({ paused: false });
  expect(result.current.data?.data).toHaveLength(4);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('keeps rows after failure and retries the same page only on explicit request', () => {
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => {
    void result.current.fetchNextPage();
  });
  const failure = new Error('unavailable');
  query.mockReturnValue(response([1, 2, 3], { isError: true, error: failure }));
  rerender();
  expect(result.current.error).toBe(failure);
  expect(result.current.data?.data).toHaveLength(3);
  jest.mocked(Date.now).mockReturnValue(600000);
  rerender();
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
  expect(
    query.mock.calls.at(-1)?.[0].dateRange.map(date => date.getTime()),
  ).toEqual([0, 60000]);
  query.mockReturnValue(response([1, 2, 3, 4]));
  rerender();
  expect(result.current.data?.data).toHaveLength(4);
  // Successful retry must settle its request and allow the next deliberate page.
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(fetchNextPage).toHaveBeenCalledTimes(3);
  query.mockReturnValue(response([1, 2, 3, 4, 5], { hasNextPage: false }));
  rerender();
  expect(result.current.data?.data).toHaveLength(5);
  expect(result.current.refreshedUntil).toBe(60000);
});

it.each([
  [10000, 70000, 'logs'],
  [-30000, 30000, 'logs'],
  [0, 60000, 'other'],
] as const)(
  'resets explicit range/source changes: %s %s %s',
  (start, end, source) => {
    const { result, rerender } = renderHook(
      ({ input }) => useLiveLogQuery(input, { isLive: true }),
      { initialProps: { input: config() } },
    );
    query.mockReturnValue(response([10, 11]));
    rerender({ input: config(start, end, source) });
    expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
      10, 11,
    ]);
  },
);

it('holds manual Live-off and resumes without requesting another page', () => {
  const { result, rerender } = renderHook(
    ({ live, end }) => useLiveLogQuery(config(0, end), { isLive: live }),
    { initialProps: { live: true, end: 60000 } },
  );
  rerender({ live: false, end: 60000 });
  expect(query.mock.calls.at(-1)?.[1]?.enabled).toBe(false);
  expect(result.current.data?.data).toHaveLength(3);
  rerender({ live: true, end: 60000 });
  expect(fetchNextPage).not.toHaveBeenCalled();
  query.mockReturnValue(response([40, 41]));
  rerender({ live: false, end: 80000 });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([40, 41]);
});

it('preserves the historical/other-source query mode', () => {
  const original = response([3, 2, 1]);
  query.mockReturnValue(original);
  const { result } = renderHook(() =>
    useLiveLogQuery(config(), { fallbackIsLive: true }),
  );
  expect(result.current.data).toBe(original.data);
  expect(query.mock.calls.at(-1)?.[1]?.isLive).toBe(true);
});

it('keeps equal timestamps with different payloads and deduplicates nested key order', () => {
  const initial = response([]);
  initial.data.data = [
    { Timestamp: 3, Body: { b: 2, a: 1 } },
    { Timestamp: 3, Body: { a: 1, b: 2 } },
    { Timestamp: 3, Body: { a: 9, b: 2 } },
  ] as unknown as typeof initial.data.data;
  query.mockReturnValue(initial);
  const { result } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  expect(result.current.data?.data).toHaveLength(2);
});

it('sorts nanosecond overlap rows using the precise timestamp instead of a Date partition', () => {
  const initial = response([]);
  const precise = (fraction: string) => ({
    __hdx_timestamp_value_0: '1970-01-01',
    __hdx_timestamp_value_1: `1970-01-01 00:00:59.${fraction}`,
    Body: fraction,
  });
  initial.data.data = [
    precise('999999999'),
  ] as unknown as typeof initial.data.data;
  initial.data.meta = [
    { name: '__hdx_timestamp_value_0', type: 'Date' },
    { name: '__hdx_timestamp_value_1', type: 'DateTime64(9)' },
  ] as unknown as typeof initial.data.meta;
  query.mockReturnValue(initial);
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => {
    void result.current.fetchNextPage();
  });
  query.mockReturnValue({
    ...initial,
    data: {
      ...initial.data,
      data: [
        precise('999999999'),
        precise('999999001'),
      ] as unknown as typeof initial.data.data,
    },
  });
  rerender();
  expect(result.current.data?.data.map(row => row.Body)).toEqual([
    '999999001',
    '999999999',
  ]);
});

it('bounds retained rows and does not replay consumed pages', () => {
  query.mockReturnValue(response([1]));
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => {
    void result.current.fetchNextPage();
  });
  query.mockReturnValue(
    response(Array.from({ length: 5002 }, (_, index) => index + 1)),
  );
  rerender();
  expect(result.current.data?.data).toHaveLength(5000);
  expect(result.current.data?.data[0].Timestamp).toBe(3);
  expect(result.current.retainedRowsDropped).toBe(2);
  rerender();
  expect(result.current.retainedRowsDropped).toBe(2);
});

it('normalizes composite ordering without splitting function commas', () => {
  expect(
    (
      chronologicalLogConfig({
        ...config(),
        orderBy: '(toStartOfSecond(Timestamp), Timestamp) DESC, id DESC',
      }) as BuilderChartConfigWithDateRange
    ).orderBy,
  ).toBe('(toStartOfSecond(Timestamp), Timestamp) ASC, id ASC');
});

it('jumps directly to a bounded latest page instead of draining earlier rows', () => {
  const initial = response([1, 2, 3]);
  const latest = response([59999, 59998, 59997]);
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : initial,
  );
  const { result } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  act(() => result.current.jumpToLatest?.());
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    59997, 59998, 59999,
  ]);
  expect(result.current.edgeNavigation?.status).toBe('success');
  expect(result.current.latestInRange).toBe(true);
  expect(result.current.hasNextPage).toBe(false);
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('navigates both edges for a fixed range without expanding it to the live clock', () => {
  const initial = response([1, 2, 3]);
  const latest = response([59999, 59998]);
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : initial,
  );
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => result.current.jumpToLatest?.());
  expect(result.current.edgeNavigation).toEqual({
    id: 1,
    edge: 'latest',
    status: 'success',
  });
  expect(result.current.refreshedUntil).toBe(60000);
  expect(result.current.requestedRange.map(date => date.getTime())).toEqual([
    0, 60000,
  ]);
  act(() => {
    void result.current.fetchNextPage();
  });
  rerender();
  expect(fetchNextPage).not.toHaveBeenCalled();
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    59998, 59999,
  ]);
  act(() => result.current.jumpToStart?.());
  expect(result.current.edgeNavigation).toEqual({
    id: 2,
    edge: 'start',
    status: 'success',
  });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    1, 2, 3,
  ]);
  expect(result.current.refreshedUntil).toBeUndefined();
  expect(result.current.latestInRange).toBe(false);
  expect(result.current.hasNextPage).toBe(true);
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('refreshes the newest page after a latest snapshot without appending descending older pages', () => {
  const initial = response([1]);
  const latest = response([59999, 59998]);
  const loading = response([], { isFetching: true });
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : input.dateRange[0].getTime() > 0
        ? loading
        : initial,
  );
  const { result } = renderHook(() =>
    useLiveLogQuery(config(), { isLive: true }),
  );
  act(() => result.current.jumpToLatest?.());
  act(() => {
    void result.current.fetchNextPage();
  });
  const requested = query.mock.calls.at(
    -1,
  )?.[0] as BuilderChartConfigWithDateRange;
  expect(requested.orderBy).toBe('Timestamp DESC');
  expect(requested.dateRange.map(date => date.getTime())).toEqual([
    10000, 70000,
  ]);
  expect(fetchNextPage).not.toHaveBeenCalled();
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([
    59998, 59999,
  ]);
});

it('keeps the prior rows during an edge failure and retries without scrolling completion', () => {
  const initial = response([1, 2]);
  let latest = response([], { isFetching: true });
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : initial,
  );
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => result.current.jumpToLatest?.());
  expect(result.current.edgeNavigation?.status).toBe('loading');
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([1, 2]);
  latest = response([], { isError: true, error: new Error('failed') });
  rerender();
  expect(result.current.edgeNavigation?.status).toBe('error');
  expect(result.current.isError).toBe(true);
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([1, 2]);
  act(() => {
    void result.current.fetchNextPage();
  });
  expect(result.current.edgeNavigation?.status).toBe('loading');
  latest = response([59999]);
  rerender();
  expect(result.current.edgeNavigation?.status).toBe('success');
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([59999]);
  expect(result.current.hasNextPage).toBe(false);
});

it('traverses empty latest windows without replacing the reader buffer before a completed page', () => {
  const initial = response([1]);
  let latest = response([]);
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : initial,
  );
  const { result, rerender } = renderHook(() =>
    useLiveLogQuery(config(), { manualNavigation: true }),
  );
  act(() => result.current.jumpToLatest?.());
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  expect(result.current.edgeNavigation?.status).toBe('loading');
  expect(result.current.data?.data).toHaveLength(1);
  latest = response([], { hasNextPage: false });
  rerender();
  expect(result.current.data?.data).toEqual([]);
  expect(result.current.edgeNavigation?.status).toBe('success');
  expect(result.current.latestInRange).toBe(true);
  expect(result.current.refreshedUntil).toBe(60000);
});

it('does not replace inspected rows with a completed latest response until inspection closes', () => {
  const initial = response([1]);
  let latest = response([], { isFetching: true });
  query.mockImplementation(input =>
    (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
      ? latest
      : initial,
  );
  const { result, rerender } = renderHook(
    ({ paused }) => useLiveLogQuery(config(), { isLive: true, paused }),
    { initialProps: { paused: false } },
  );
  act(() => result.current.jumpToLatest?.());
  latest = response([59999]);
  rerender({ paused: true });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([1]);
  expect(result.current.edgeNavigation?.status).toBe('loading');
  const prefix = query.mock.calls.at(-1)?.[1]?.queryKeyPrefix;
  act(() => result.current.jumpToStart?.());
  expect(query.mock.calls.at(-1)?.[1]?.queryKeyPrefix).toBe(prefix);
  rerender({ paused: false });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([59999]);
  expect(result.current.edgeNavigation?.status).toBe('success');
});

it('isolates navigation generations and source changes from old in-flight results', async () => {
  const responses = new Map<string, ReturnType<typeof response>>();
  query.mockImplementation((input, options) => {
    const key = options?.queryKeyPrefix ?? '';
    if (!responses.has(key)) {
      responses.set(
        key,
        (input as BuilderChartConfigWithDateRange).orderBy === 'Timestamp DESC'
          ? response([], { isFetching: true })
          : response([input.source === 'other' ? 42 : 1]),
      );
    }
    return responses.get(key)!;
  });
  const { result, rerender } = renderHook(
    ({ source }) =>
      useLiveLogQuery(config(0, 60000, source), { manualNavigation: true }),
    { initialProps: { source: 'logs' } },
  );
  act(() => result.current.jumpToLatest?.());
  const oldKey = query.mock.calls.at(-1)?.[1]?.queryKeyPrefix ?? '';
  act(() => result.current.jumpToStart?.());
  expect(query.mock.calls.at(-1)?.[1]?.queryKeyPrefix).not.toBe(oldKey);
  responses.set(oldKey, response([59999]));
  rerender({ source: 'logs' });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([1]);
  expect(result.current.edgeNavigation?.edge).toBe('start');
  rerender({ source: 'other' });
  expect(result.current.data?.data.map(row => row.Timestamp)).toEqual([42]);
  expect(result.current.edgeNavigation).toBeUndefined();
  expect(result.current.latestInRange).toBe(false);
  expect(fetchNextPage).not.toHaveBeenCalled();
});
