'use client';

import React from 'react';
import {
  convertDateRangeToGranularityString,
  convertGranularityToSeconds,
} from '@hyperdx/common-utils/dist/core/utils';
import { useDocumentVisibility } from '@mantine/hooks';

import { getRelativeInterval } from '@/timeQuery';

export const useDashboardRefresh = ({
  searchedTimeRange,
  onTimeRangeSelect,
  isLive,
  refreshIntervalSeconds,
}: {
  onTimeRangeSelect: (start: Date, end: Date, displayValue?: string) => void;
  searchedTimeRange: [Date, Date];
  isLive: boolean;
  refreshIntervalSeconds?: number | null;
}) => {
  const [manualRefreshCooloff, setManualRefreshCooloff] = React.useState(false);

  const isTabVisible = useDocumentVisibility() === 'visible';

  const isRefreshEnabled = React.useMemo(() => {
    return isTabVisible && isLive;
  }, [isTabVisible, isLive]);

  const refresh = React.useCallback(() => {
    const timeDiff =
      searchedTimeRange[1].getTime() - searchedTimeRange[0].getTime();
    const timeDiffRoundedToSecond = Math.round(timeDiff / 1000) * 1000;
    // eslint-disable-next-line no-restricted-syntax
    const newEnd = new Date();
    const newStart = new Date(newEnd.getTime() - timeDiffRoundedToSecond);
    onTimeRangeSelect(
      newStart,
      newEnd,
      isLive
        ? getRelativeInterval(newStart, newEnd) ||
            `Past ${timeDiffRoundedToSecond / 1000}s`
        : undefined,
    );
    setManualRefreshCooloff(true);
    setTimeout(() => {
      setManualRefreshCooloff(false);
    }, 1000);
  }, [onTimeRangeSelect, searchedTimeRange, isLive]);

  const granularityOverride =
    convertDateRangeToGranularityString(searchedTimeRange);
  const refreshInterval =
    refreshIntervalSeconds ?? convertGranularityToSeconds(granularityOverride);

  const wasRefreshEnabledRef = React.useRef(false);
  React.useEffect(() => {
    if (isRefreshEnabled && !wasRefreshEnabledRef.current) refresh();
    wasRefreshEnabledRef.current = isRefreshEnabled;
  }, [isRefreshEnabled, refresh]);

  // Auto-refresh interval
  const intervalRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (isRefreshEnabled) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(() => {
        refresh();
      }, refreshInterval * 1000);
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRefreshEnabled, refreshInterval, refresh]);

  return {
    granularityOverride,
    refreshInterval,
    isRefreshEnabled,
    manualRefreshCooloff,
    refresh,
  };
};
