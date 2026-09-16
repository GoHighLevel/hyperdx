import {
  convertDateRangeToGranularityString,
  convertGranularityToSeconds,
} from '@hyperdx/common-utils/dist/core/utils';
import { ChartConfigWithOptDateRange } from '@hyperdx/common-utils/dist/types';

type ChartGranularity = ChartConfigWithOptDateRange['granularity'];

// A fixed, conservative display budget; independent of the backend safety cap.
const AUTO_MAX_BUCKETS = 1000;
const MAX_POINTS_PER_SERIES = 11000;

/** Dashboard Auto inherits a panel's saved interval; explicit overrides win. */
export function resolvePromqlDashboardGranularity(
  dashboard: ChartGranularity,
  panel: ChartGranularity,
): ChartGranularity {
  return dashboard && dashboard !== 'auto' ? dashboard : (panel ?? 'auto');
}

/** Resolve Auto using the selected range, without changing explicit precision. */
export function resolvePromqlQueryStep(
  dateRange: [Date, Date],
  granularity: ChartGranularity,
): string {
  const durationSeconds =
    (dateRange[1].getTime() - dateRange[0].getTime()) / 1000;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error(
      'Invalid PromQL time range. Choose a valid start and end time.',
    );
  }

  const resolved =
    !granularity || granularity === 'auto'
      ? convertDateRangeToGranularityString(dateRange, AUTO_MAX_BUCKETS)
      : granularity;
  const seconds = convertGranularityToSeconds(resolved);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Invalid PromQL interval. Choose a positive interval.');
  }

  const points = Math.floor(durationSeconds / seconds) + 1;
  if (points > MAX_POINTS_PER_SERIES) {
    throw new Error(
      `This range at ${resolved} requests ${points} points per series ` +
        `(limit ${MAX_POINTS_PER_SERIES}). Choose a larger interval or a shorter time range.`,
    );
  }

  return `${seconds}s`;
}
