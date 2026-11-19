import { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';

import { fetchProgressiveValueCounts } from '@/hooks/progressiveValueCounts';

const end = new Date('2026-09-16T12:00:00Z');
const config = {
  dateRange: [new Date(end.getTime() - 30 * 86400000), end],
} as BuilderChartConfigWithDateRange;

describe('progressive filter counts', () => {
  it('publishes early counts, covers 30 days without overlapping boundaries, and sums UInt64 exactly', async () => {
    const windows: BuilderChartConfigWithDateRange[] = [];
    const updates: string[] = [];
    const result = await fetchProgressiveValueCounts({
      chartConfig: config,
      signal: new AbortController().signal,
      fetchWindow: async window => {
        windows.push(window);
        return new Map([['api', '9007199254740993']]);
      },
      onProgress: progress => updates.push(progress.counts.get('api')!),
    });
    expect(updates[0]).toBe('9007199254740993');
    expect(windows[0].dateRange[1]).toEqual(end);
    expect(
      windows[0].dateRange[1].getTime() - windows[0].dateRange[0].getTime(),
    ).toBe(300000);
    expect(windows.length).toBeLessThan(45);
    windows.forEach((window, index) => {
      expect(window.dateRangeEndInclusive).toBe(index === 0);
      expect(window.dateRangeStartInclusive).toBe(true);
      if (index)
        expect(window.dateRange[1]).toEqual(windows[index - 1].dateRange[0]);
    });
    expect(windows.at(-1)!.dateRange[0]).toEqual(config.dateRange[0]);
    expect(result.counts.get('api')).toBe(
      (BigInt(windows.length) * 9007199254740993n).toString(),
    );
    expect(result.complete).toBe(true);
  });

  it('retries a smaller window on a resource limit without adding the failed window', async () => {
    let calls = 0;
    const result = await fetchProgressiveValueCounts({
      chartConfig: {
        ...config,
        dateRange: [new Date(end.getTime() - 300000), end],
      },
      signal: new AbortController().signal,
      fetchWindow: async () => {
        if (++calls === 1) throw new Error('MEMORY_LIMIT_EXCEEDED');
        return new Map([['api', '2']]);
      },
      onProgress: jest.fn(),
    });
    expect(result.counts.get('api')).toBe(String((calls - 1) * 2));
  });

  it('keeps completed-window progress on failure and does not retry invalid SQL', async () => {
    const progress = jest.fn();
    const fetchWindow = jest
      .fn()
      .mockResolvedValueOnce(new Map([['api', '3']]))
      .mockRejectedValue(new Error('Unknown identifier'));
    await expect(
      fetchProgressiveValueCounts({
        chartConfig: config,
        signal: new AbortController().signal,
        fetchWindow,
        onProgress: progress,
      }),
    ).rejects.toThrow('Unknown identifier');
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls[0][0].counts.get('api')).toBe('3');
    expect(progress.mock.calls[0][0].complete).toBe(false);
    expect(fetchWindow).toHaveBeenCalledTimes(2);
  });

  it('does not publish results from a cancelled query', async () => {
    const abort = new AbortController();
    const progress = jest.fn();
    await expect(
      fetchProgressiveValueCounts({
        chartConfig: config,
        signal: abort.signal,
        fetchWindow: async () => {
          abort.abort();
          return new Map([['api', '4']]);
        },
        onProgress: progress,
      }),
    ).rejects.toThrow();
    expect(progress).not.toHaveBeenCalled();
  });
});
