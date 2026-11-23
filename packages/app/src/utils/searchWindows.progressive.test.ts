import {
  DEFAULT_TIME_WINDOWS_SECONDS,
  generateTimeWindowsAscending,
  generateTimeWindowsDescending,
  getLogSearchWindowDurations,
  SMALL_FIRST_WINDOW_DURATIONS_SECONDS,
} from './searchWindows';

it('keeps a tiny keyword preview but skips the serial staircase for older matches', () => {
  expect(getLogSearchWindowDurations(true, true, false).slice(0, 2)).toEqual([
    10, 300,
  ]);
  expect(getLogSearchWindowDurations(true, false, true)[0]).toBe(1800);
  expect(getLogSearchWindowDurations(true, false, false).slice(0, 5)).toEqual([
    10, 20, 90, 180, 600,
  ]);
});

it.each([1, 7, 30, 365])(
  'covers a %i-day range without gaps or overlapping windows',
  days => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date(start.getTime() + days * 86400000);
    const durations = [
      ...SMALL_FIRST_WINDOW_DURATIONS_SECONDS,
      ...DEFAULT_TIME_WINDOWS_SECONDS,
    ];
    const asc = generateTimeWindowsAscending(start, end, durations);
    const desc = generateTimeWindowsDescending(start, end, durations);
    expect(asc[0].startTime).toEqual(start);
    expect(asc.at(-1)?.endTime).toEqual(end);
    expect(desc[0].endTime).toEqual(end);
    expect(desc.at(-1)?.startTime).toEqual(start);
    expect(asc[0].endTime.getTime() - asc[0].startTime.getTime()).toBe(10000);
    for (let i = 1; i < asc.length; i++)
      expect(asc[i].startTime).toEqual(asc[i - 1].endTime);
    for (let i = 1; i < desc.length; i++)
      expect(desc[i].endTime).toEqual(desc[i - 1].startTime);
    expect(
      asc.reduce(
        (ms, w) => ms + w.endTime.getTime() - w.startTime.getTime(),
        0,
      ),
    ).toBe(end.getTime() - start.getTime());
  },
);

it('uses short contiguous fallback windows before scanning broader history', () => {
  const end = new Date('2026-11-19T12:30:00Z');
  const windows = generateTimeWindowsDescending(
    new Date(end.getTime() - 1800000),
    end,
    [...SMALL_FIRST_WINDOW_DURATIONS_SECONDS, ...DEFAULT_TIME_WINDOWS_SECONDS],
  );
  expect(
    windows
      .slice(0, 5)
      .map(w => (w.endTime.getTime() - w.startTime.getTime()) / 1000),
  ).toEqual([10, 20, 90, 180, 600]);
  expect(windows[4].startTime).toEqual(new Date('2026-11-19T12:15:00Z'));
});
