import objectHash from 'object-hash';
import {
  BuilderChartConfigWithDateRange,
  TSource,
} from '@hyperdx/common-utils/dist/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchProgressiveValueCounts,
  ProgressiveValueCounts,
} from './progressiveValueCounts';

export function useProgressiveValueCounts({
  chartConfig,
  field,
  values,
  source,
  enabled,
  isLive,
  fetchWindow,
}: {
  chartConfig: BuilderChartConfigWithDateRange;
  field: string;
  values: string[];
  source: TSource | undefined;
  enabled: boolean;
  isLive: boolean;
  fetchWindow: (
    config: BuilderChartConfigWithDateRange,
    signal: AbortSignal,
  ) => Promise<Map<string, string>>;
}) {
  const client = useQueryClient();
  const { dateRange, ...scope } = chartConfig;
  const duration = Math.round(
    (dateRange[1].getTime() - dateRange[0].getTime()) / 1000,
  );
  // Live ticks must not cancel an in-flight scan. Changes to filters, source,
  // fields, or the relative duration still start a separate count immediately.
  const queryKey = [
    'useMetadata.useGetValueCounts.progressive',
    objectHash({
      scope,
      field,
      values: [...new Set(values)].sort(),
      source,
      time: isLive ? { duration } : dateRange,
    }),
  ];
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const previous = client.getQueryData<ProgressiveValueCounts>(queryKey);
      return fetchProgressiveValueCounts({
        chartConfig,
        signal,
        fetchWindow: config => fetchWindow(config, signal),
        onProgress: progress => {
          // Retain a completed snapshot during refresh; never replace a known
          // whole-range count with a smaller partial count from the next pass.
          if (!previous?.complete || progress.complete)
            client.setQueryData(queryKey, progress);
        },
      });
    },
    enabled,
    staleTime: 60_000,
    // Large historical scans need not repeat at the live-tail polling rate.
    refetchInterval: isLive
      ? Math.max(60_000, Math.min(900_000, duration * 10))
      : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return {
    ...query,
    data: query.data?.counts,
    isPartial: query.data != null && !query.data.complete,
    countedFrom: query.data?.countedFrom,
    countedTo: query.data?.countedTo,
  };
}
