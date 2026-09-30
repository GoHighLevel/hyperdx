import { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';

export type ProgressiveValueCounts = {
  counts: Map<string, string>;
  complete: boolean;
  countedFrom: number;
  countedTo: number;
};

/** Count newest first, publishing only fully completed, non-overlapping windows. */
export async function fetchProgressiveValueCounts({
  chartConfig,
  signal,
  fetchWindow,
  onProgress,
}: {
  chartConfig: BuilderChartConfigWithDateRange;
  signal: AbortSignal;
  fetchWindow: (
    config: BuilderChartConfigWithDateRange,
  ) => Promise<Map<string, string>>;
  onProgress: (progress: ProgressiveValueCounts) => void;
}): Promise<ProgressiveValueCounts> {
  const from = chartConfig.dateRange[0].getTime();
  const to = chartConfig.dateRange[1].getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    throw new Error('Invalid filter count time range');
  }
  let cursor = to;
  let windowMs = 5 * 60_000;
  let maxWindowMs = 86400000;
  const counts = new Map<string, string>();
  let progress: ProgressiveValueCounts;
  do {
    signal.throwIfAborted();
    const start = Math.max(from, cursor - windowMs);
    const started = performance.now();
    let result: Map<string, string>;
    try {
      result = await fetchWindow({
        ...chartConfig,
        dateRange: [new Date(start), new Date(cursor)],
        dateRangeStartInclusive:
          start === from ? (chartConfig.dateRangeStartInclusive ?? true) : true,
        dateRangeEndInclusive:
          cursor === to ? (chartConfig.dateRangeEndInclusive ?? true) : false,
      });
    } catch (error) {
      signal.throwIfAborted();
      // Retrying invalid SQL/auth errors cannot be fixed by a smaller scan.
      if (
        cursor - start > 60_000 &&
        error instanceof Error &&
        /memory.limit|time.?out|time.limit|too.many.rows|limit.exceeded/i.test(
          error.message,
        )
      ) {
        windowMs = Math.max(60_000, Math.floor((cursor - start) / 2));
        maxWindowMs = Math.min(maxWindowMs, windowMs);
        continue;
      }
      throw error;
    }
    signal.throwIfAborted();
    for (const [value, count] of result) {
      counts.set(
        value,
        (BigInt(counts.get(value) ?? '0') + BigInt(count)).toString(),
      );
    }
    cursor = start;
    progress = {
      counts: new Map(counts),
      complete: cursor === from,
      countedFrom: cursor,
      countedTo: to,
    };
    onProgress(progress);
    const elapsed = performance.now() - started;
    if (elapsed < 2000) windowMs = Math.min(windowMs * 4, maxWindowMs);
    else if (elapsed > 5000)
      windowMs = Math.max(60_000, Math.floor(windowMs / 2));
  } while (cursor > from);
  return progress!;
}
