import {
  DEFAULT_TIME_WINDOWS_SECONDS,
  generateTimeWindowsAscending,
  generateTimeWindowsDescending,
  SMALL_FIRST_WINDOW_SECONDS,
} from './searchWindows';

it.each([1, 7, 30, 365])(
  'covers a %i-day range without gaps or overlapping windows',
  days => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date(start.getTime() + days * 86400000);
    const durations = [
      SMALL_FIRST_WINDOW_SECONDS,
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
