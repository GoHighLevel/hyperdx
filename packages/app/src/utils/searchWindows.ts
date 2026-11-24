export const ONE_MIN_WINDOW = 1 * 60;
export const SMALL_FIRST_WINDOW_SECONDS = 10;
export const SMALL_FIRST_WINDOW_DURATIONS_SECONDS = [
  SMALL_FIRST_WINDOW_SECONDS,
  20,
  90,
  180,
  600,
];
export const DEFAULT_TIME_WINDOWS_SECONDS = [
  15 * 60, // 15m
  6 * 60 * 60, // 6h
  6 * 60 * 60, // 6h
  12 * 60 * 60, // 12h
  24 * 60 * 60, // 24h
];

export type TimeWindow = {
  startTime: Date;
  endTime: Date;
  windowIndex: number;
  direction: 'ASC' | 'DESC';
};

export function getLogSearchWindowDurations(
  smallFirstWindow: boolean,
  keyword: boolean,
  exactId: boolean,
): number[] {
  if (exactId) return [1800, ...DEFAULT_TIME_WINDOWS_SECONDS.slice(1)];
  if (smallFirstWindow && keyword)
    return [10, 300, 900, 1800, ...DEFAULT_TIME_WINDOWS_SECONDS.slice(1)];
  return smallFirstWindow
    ? [...SMALL_FIRST_WINDOW_DURATIONS_SECONDS, ...DEFAULT_TIME_WINDOWS_SECONDS]
    : DEFAULT_TIME_WINDOWS_SECONDS.slice();
}

// Generate time windows from date range using progressive bucketing, starting at the end of the date range
export function generateTimeWindowsDescending(
  startDate: Date,
  endDate: Date,
  windowDurationsSeconds: number[] = DEFAULT_TIME_WINDOWS_SECONDS,
): TimeWindow[] {
  if (startDate.getTime() === endDate.getTime()) {
    return [
      {
        startTime: startDate,
        endTime: endDate,
        windowIndex: 0,
        direction: 'DESC',
      },
    ];
  }

  const windows: TimeWindow[] = [];
  let currentEnd = new Date(endDate);
  let windowIndex = 0;

  while (currentEnd > startDate) {
    const windowSizeSeconds =
      windowDurationsSeconds[windowIndex] ||
      windowDurationsSeconds[windowDurationsSeconds.length - 1]; // use largest window size
    const windowSizeMs = windowSizeSeconds * 1000;
    const windowStart = new Date(
      Math.max(currentEnd.getTime() - windowSizeMs, startDate.getTime()),
    );

    windows.push({
      endTime: new Date(currentEnd),
      startTime: windowStart,
      windowIndex,
      direction: 'DESC',
    });

    currentEnd = windowStart;
    windowIndex++;
  }

  return windows;
}

// Generate time windows from date range using progressive bucketing, starting at the beginning of the date range
export function generateTimeWindowsAscending(
  startDate: Date,
  endDate: Date,
  windowDurationsSeconds: number[] = DEFAULT_TIME_WINDOWS_SECONDS,
): TimeWindow[] {
  if (startDate.getTime() === endDate.getTime()) {
    return [
      {
        startTime: startDate,
        endTime: endDate,
        windowIndex: 0,
        direction: 'ASC',
      },
    ];
  }

  const windows: TimeWindow[] = [];
  let currentStart = new Date(startDate);
  let windowIndex = 0;

  while (currentStart < endDate) {
    const windowSizeSeconds =
      windowDurationsSeconds[windowIndex] ||
      windowDurationsSeconds[windowDurationsSeconds.length - 1]; // use largest window size
    const windowSizeMs = windowSizeSeconds * 1000;
    const windowEnd = new Date(
      Math.min(currentStart.getTime() + windowSizeMs, endDate.getTime()),
    );

    windows.push({
      startTime: new Date(currentStart),
      endTime: windowEnd,
      windowIndex,
      direction: 'ASC',
    });

    currentStart = windowEnd;
    windowIndex++;
  }

  return windows;
}
