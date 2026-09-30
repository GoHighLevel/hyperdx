import React from 'react';
import { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useProgressiveValueCounts } from '@/hooks/useProgressiveValueCounts';

const end = Date.parse('2026-09-16T12:00:00Z');
const config = {
  dateRange: [new Date(end - 30 * 86400000), new Date(end)],
  where: '',
} as BuilderChartConfigWithDateRange;

function setup(
  fetchWindow: (
    config: BuilderChartConfigWithDateRange,
    signal: AbortSignal,
  ) => Promise<Map<string, string>>,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ chartConfig, isLive }) =>
      useProgressiveValueCounts({
        chartConfig,
        field: 'deployment_name',
        values: ['api'],
        source: undefined,
        enabled: true,
        isLive,
        fetchWindow,
      }),
    { wrapper, initialProps: { chartConfig: config, isLive: true } },
  );
  return { ...hook, client };
}

describe('live progressive counts', () => {
  it('keeps partial counts and the active request across relative ticks; cancels on query change', async () => {
    let finish: (value: Map<string, string>) => void = () => {};
    const signals: AbortSignal[] = [];
    const fetchWindow = jest.fn(
      (_config: BuilderChartConfigWithDateRange, signal: AbortSignal) => {
        signals.push(signal);
        if (signals.length === 1)
          return Promise.resolve(new Map([['api', '12']]));
        return new Promise<Map<string, string>>(resolve => {
          finish = resolve;
        });
      },
    );
    const { result, rerender, unmount, client } = setup(fetchWindow);
    await waitFor(() => expect(result.current.data?.get('api')).toBe('12'));
    expect(result.current.isPartial).toBe(true);
    rerender({
      chartConfig: {
        ...config,
        dateRange: config.dateRange.map(d => new Date(d.getTime() + 10000)) as [
          Date,
          Date,
        ],
      },
      isLive: true,
    });
    expect(signals[1].aborted).toBe(false);
    expect(fetchWindow).toHaveBeenCalledTimes(2);
    expect(result.current.data?.get('api')).toBe('12');
    rerender({ chartConfig: { ...config, where: 'different' }, isLive: true });
    await waitFor(() => expect(signals[1].aborted).toBe(true));
    expect(result.current.data).toBeUndefined();
    await act(async () => finish(new Map([['api', '999']])));
    unmount();
    client.clear();
  });

  it('retains partial counts when a later window fails', async () => {
    const fetchWindow = jest
      .fn()
      .mockResolvedValueOnce(new Map([['api', '12']]))
      .mockRejectedValue(new Error('Unknown identifier'));
    const { result, unmount, client } = setup(fetchWindow);
    await waitFor(() =>
      expect(result.current.error?.message).toBe('Unknown identifier'),
    );
    expect(result.current.data?.get('api')).toBe('12');
    expect(result.current.isPartial).toBe(true);
    unmount();
    client.clear();
  });

  it('finishes the range and keeps the completed count while a refresh is pending', async () => {
    const fetchWindow = jest.fn().mockResolvedValue(new Map([['api', '1']]));
    const { result, unmount, client } = setup(fetchWindow);
    await waitFor(() =>
      expect(result.current.isSuccess && !result.current.isFetching).toBe(true),
    );
    const count = result.current.data?.get('api');
    expect(result.current.isPartial).toBe(false);
    fetchWindow.mockImplementation(() => new Promise(() => {}));
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data?.get('api')).toBe(count);
    unmount();
    client.clear();
  });
});
