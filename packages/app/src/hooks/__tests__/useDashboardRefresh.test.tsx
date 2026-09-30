import { act, renderHook } from '@testing-library/react';

import { useDashboardRefresh } from '@/hooks/useDashboardRefresh';

jest.mock('@mantine/hooks', () => ({
  useDocumentVisibility: () => 'visible',
}));

describe('dashboard live refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('advances both endpoints at the configured cadence while keeping a relative label', () => {
    const onTimeRangeSelect = jest.fn();
    const { result } = renderHook(() =>
      useDashboardRefresh({
        searchedTimeRange: [
          new Date('2026-09-13T10:00:00Z'),
          new Date('2026-09-13T10:15:00Z'),
        ],
        onTimeRangeSelect,
        isLive: true,
        refreshIntervalSeconds: 30,
      }),
    );
    expect(result.current.refreshInterval).toBe(30);
    expect(onTimeRangeSelect).toHaveBeenLastCalledWith(
      new Date('2026-09-13T11:45:00Z'),
      new Date('2026-09-13T12:00:00Z'),
      'Past 15 minutes',
    );
    act(() => jest.advanceTimersByTime(30000));
    expect(onTimeRangeSelect).toHaveBeenLastCalledWith(
      new Date('2026-09-13T11:45:30Z'),
      new Date('2026-09-13T12:00:30Z'),
      'Past 15 minutes',
    );
  });

  it('holds a paused window and stops the timer when paused or unmounted', () => {
    const onTimeRangeSelect = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ isLive }) =>
        useDashboardRefresh({
          searchedTimeRange: [new Date(0), new Date(900000)],
          onTimeRangeSelect,
          isLive,
          refreshIntervalSeconds: 30,
        }),
      { initialProps: { isLive: false } },
    );
    act(() => jest.advanceTimersByTime(60000));
    expect(onTimeRangeSelect).not.toHaveBeenCalled();
    rerender({ isLive: true });
    expect(onTimeRangeSelect).toHaveBeenCalledTimes(1);
    rerender({ isLive: false });
    act(() => jest.advanceTimersByTime(60000));
    expect(onTimeRangeSelect).toHaveBeenCalledTimes(1);
    unmount();
    act(() => jest.advanceTimersByTime(60000));
    expect(onTimeRangeSelect).toHaveBeenCalledTimes(1);
  });
});
