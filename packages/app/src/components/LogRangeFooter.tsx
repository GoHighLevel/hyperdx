import { UnstyledButton } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { useFormatTime } from '@/useFormatTime';

import type { LogEdgeNavigation } from './LogScrollButtons';

import styles from './LogSummaryDemo/LiveSummaryContent.module.scss';

export default function LogRangeFooter({
  dateRange,
  checkedUntil,
  hasNextPage,
  isLive,
  loading,
  paused,
  failed,
  onLoad,
  rows,
  timestampColumn,
  latestInRange,
  navigation,
}: {
  dateRange?: [Date, Date];
  checkedUntil?: number;
  hasNextPage?: boolean;
  isLive?: boolean;
  loading?: boolean;
  paused?: boolean;
  failed?: boolean;
  onLoad: () => void;
  rows: Record<string, unknown>[];
  timestampColumn?: string;
  latestInRange?: boolean;
  navigation?: LogEdgeNavigation;
}) {
  const formatTime = useFormatTime();
  const action =
    navigation?.status === 'loading'
      ? `Loading ${navigation.edge === 'latest' ? 'latest' : 'earliest'} logs…`
      : loading
        ? 'Loading logs…'
        : paused
          ? 'Close log details to load more'
          : failed
            ? 'Retry loading logs'
            : isLive
              ? 'Scroll down to show latest logs'
              : hasNextPage
                ? 'Scroll down to load newer logs'
                : 'End of selected range';
  const displayedRange =
    isLive && latestInRange && checkedUntil != null && dateRange
      ? [
          new Date(
            checkedUntil - (dateRange[1].getTime() - dateRange[0].getTime()),
          ),
          new Date(checkedUntil),
        ]
      : dateRange;
  const selectedRange = displayedRange
    ? `Search range: ${formatTime(displayedRange[0], { format: 'withYear' })} – ${formatTime(displayedRange[1], { format: 'withYear' })}`
    : 'Logs in chronological order';
  const selectedLabel =
    dateRange && checkedUntil != null && checkedUntil > dateRange[1].getTime()
      ? `${selectedRange} · Checked through ${formatTime(checkedUntil, { format: 'withYear' })}`
      : selectedRange;
  const timestamp = (row: Record<string, unknown> | undefined) => {
    const value =
      row?.__hdx_timestamp ??
      (timestampColumn ? row?.[timestampColumn] : undefined);
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      !(value instanceof Date)
    )
      return undefined;
    return Number.isFinite(new Date(value).getTime()) ? value : undefined;
  };
  const first = timestamp(rows[0]);
  const last = timestamp(rows[rows.length - 1]);
  const loadedRange =
    first != null && last != null
      ? ` · ${formatTime(first, { format: 'withMs' })} – ${formatTime(last, { format: 'withMs' })}`
      : '';
  const coverage =
    latestInRange && checkedUntil != null
      ? ` · Searched through ${formatTime(checkedUntil, { format: 'time' })}`
      : hasNextPage
        ? ' · More logs remain in range'
        : '';
  const eventLabel =
    last != null
      ? `${latestInRange ? 'Latest event' : 'Last shown'} ${formatTime(last, { format: 'time' })}`
      : rows.length === 0
        ? 'No matching logs'
        : 'Event time unavailable';
  const rangeLabel = `${eventLabel}${coverage}`;
  return (
    <UnstyledButton
      className={styles.rangeFooter}
      data-testid="log-range-footer"
      data-dashboard-no-drag
      disabled={
        loading ||
        navigation?.status === 'loading' ||
        paused ||
        (!isLive && !hasNextPage && !failed)
      }
      onClick={onLoad}
      title={`${rangeLabel}. Loaded timestamps${loadedRange || ': unavailable'}. ${selectedLabel}. ${action}. Showing a page does not mean every matching log is displayed. Use a fixed time range to page through all matching logs.`}
      aria-label={action}
      aria-busy={loading || navigation?.status === 'loading'}
    >
      <IconInfoCircle size={16} aria-hidden="true" />
      <span className={styles.rangeLabel}>{rangeLabel}</span>
      <span>{action}</span>
    </UnstyledButton>
  );
}
