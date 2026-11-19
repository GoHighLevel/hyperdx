import type { ComponentProps } from 'react';
import { SourceKind, TSource } from '@hyperdx/common-utils/dist/types';
import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { RawLogTable } from '@/components/DBRowTable';
import LogScrollButtons from '@/components/LogScrollButtons';
import * as useChartConfigModule from '@/hooks/useChartConfig';

jest.mock('@/usePermissions', () => ({
  usePermissions: () => ({ canManageShared: true }),
}));
jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: { email: 'scroll@example.com' } }) },
}));
jest.mock('nuqs', () => ({
  ...jest.requireActual('nuqs'),
  useQueryState: () => [null, jest.fn()],
}));

beforeEach(() => {
  window.localStorage.clear();
  jest
    .spyOn(useChartConfigModule, 'useAliasMapFromChartConfig')
    .mockReturnValue({
      data: {},
      isLoading: false,
      error: null,
    } as any);
});
afterEach(() => jest.restoreAllMocks());

function setup(
  paused = false,
  props: Partial<ComponentProps<typeof RawLogTable>> = {},
) {
  const fetchNextPage = jest.fn().mockResolvedValue(undefined);
  render(
    <MantineProvider>
      <RawLogTable
        displayedColumns={['log']}
        rows={[{ log: 'First matching event' }]}
        source={{ id: 'scroll-logs', kind: SourceKind.Log } as TSource}
        columnTypeMap={new Map()}
        generateRowId={() => ({ where: 'id=1', aliasWith: [] })}
        onRowDetailsClick={jest.fn()}
        dateRange={[
          new Date('2026-09-17T15:33:00Z'),
          new Date('2026-09-17T16:03:00Z'),
        ]}
        loadOnScroll
        isLive
        loadingPaused={paused}
        fetchNextPage={fetchNextPage}
        hasNextPage
        isLoading={false}
        {...props}
      />
    </MantineProvider>,
  );
  return { fetchNextPage, table: screen.getByTestId('search-results-table') };
}

it('does not fetch on mount, stationary bottom scroll events, or resize', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.scroll(table);
  fireEvent(window, new Event('resize'));
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('moves to the top and bottom without fetching, even after recent scroll intent', () => {
  const { table, fetchNextPage } = setup();
  Object.defineProperty(table, 'scrollHeight', { value: 2000 });
  Object.defineProperty(table, 'clientHeight', { value: 400 });
  table.scrollTop = 500;
  fireEvent.wheel(table, { deltaY: 100 });
  fireEvent.click(screen.getByRole('button', { name: 'Go to bottom' }));
  expect(table.scrollTop).toBe(1600);
  fireEvent.scroll(table);
  expect(fetchNextPage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Go to top' }));
  expect(table.scrollTop).toBe(0);
  fireEvent.scroll(table);
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('allows navigation while log loading is paused for inspection', () => {
  const { table, fetchNextPage } = setup(true);
  Object.defineProperty(table, 'scrollHeight', { value: 2000 });
  Object.defineProperty(table, 'clientHeight', { value: 400 });
  fireEvent.click(screen.getByRole('button', { name: 'Go to bottom' }));
  expect(table.scrollTop).toBe(1600);
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('settles after virtual row heights change and yields to a new user gesture', () => {
  let pendingFrame: FrameRequestCallback | undefined;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    pendingFrame = callback;
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    pendingFrame = undefined;
  });
  const { table, fetchNextPage } = setup();
  let height = 2000;
  Object.defineProperty(table, 'scrollHeight', { get: () => height });
  Object.defineProperty(table, 'clientHeight', { value: 400 });
  fireEvent.click(screen.getByRole('button', { name: 'Go to bottom' }));
  expect(table.scrollTop).toBe(1600);
  height = 3000;
  act(() => pendingFrame?.(16));
  expect(table.scrollTop).toBe(2600);
  fireEvent.wheel(table, { deltaY: -100 });
  expect(pendingFrame).toBeUndefined();
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('loads once for a downward gesture and ignores repeated momentum events', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.wheel(table, { deltaY: 100 });
  fireEvent.wheel(table, { deltaY: 60 });
  fireEvent.scroll(table);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('ignores upward and horizontal gestures', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.wheel(table, { deltaY: -100 });
  fireEvent.wheel(table, { deltaX: 100 });
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('requires reaching the bottom before loading', () => {
  const { table, fetchNextPage } = setup();
  Object.defineProperty(table, 'scrollHeight', { value: 2000 });
  Object.defineProperty(table, 'clientHeight', { value: 400 });
  fireEvent.wheel(table, { deltaY: 100 });
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('provides an accessible one-row range/footer action', () => {
  const { fetchNextPage } = setup();
  fireEvent.click(
    screen.getByRole('button', { name: /Scroll down to show latest logs/i }),
  );
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('log-range-footer')).toHaveTextContent(
    /Event time unavailable.*More logs remain in range/,
  );
  expect(screen.getByTestId('log-range-footer')).toHaveAttribute(
    'title',
    expect.stringContaining('Search range'),
  );
});

it('labels the actual loaded timestamps rather than implying the selected range is loaded', () => {
  setup(false, {
    displayedColumns: ['timestamp', 'log'],
    rows: [{ timestamp: '2026-09-17T15:33:01Z', log: 'First page' }],
  });
  const footer = screen.getByTestId('log-range-footer');
  expect(footer).toHaveTextContent('Last shown');
  expect(footer).toHaveTextContent('More logs remain in range');
  expect(footer).not.toHaveTextContent('Reached end of range');
  expect(footer).not.toHaveTextContent('Unknown date');
});

it('distinguishes the last event from a later successful live search', () => {
  setup(false, {
    displayedColumns: ['timestamp', 'log'],
    rows: [{ timestamp: '2026-09-17T18:55:36Z', log: 'Quiet service' }],
    dateRange: [
      new Date('2026-09-17T18:50:00Z'),
      new Date('2026-09-17T18:55:00Z'),
    ],
    latestInRange: true,
    hasNextPage: false,
    refreshedUntil: Date.parse('2026-09-17T18:56:00Z'),
  });
  const footer = screen.getByTestId('log-range-footer');
  expect(footer).not.toHaveTextContent(/Showing|1 log/);
  expect(footer).toHaveTextContent('Latest event');
  expect(footer).toHaveTextContent('Searched through');
  expect(footer).not.toHaveTextContent('Reached end of range');
  expect(footer).not.toHaveTextContent('Unknown date');
  const times = footer.textContent?.match(
    /Latest event (.*?) · Searched through (.*?)Scroll/,
  );
  expect(times).not.toBeNull();
  expect(times?.[1]).not.toEqual(times?.[2]);
});

it('blocks query navigation during log inspection', () => {
  const jumpToLatest = jest.fn();
  setup(true, { jumpToLatest });
  expect(
    screen.getByRole('button', { name: 'Go to latest logs' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Go to latest logs' }));
  expect(jumpToLatest).not.toHaveBeenCalled();
});

it('fetches the latest page before scrolling, preserves position on failure, and permits retry', () => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'scrollHeight', { value: 2000 });
  Object.defineProperty(container, 'clientHeight', { value: 400 });
  container.scrollTop = 300;
  const onJumpToLatest = jest.fn();
  const beforeScroll = jest.fn();
  const show = (status?: 'loading' | 'error' | 'success', disabled = false) => (
    <MantineProvider>
      <LogScrollButtons
        container={container}
        disabled={disabled}
        beforeScroll={beforeScroll}
        onJumpToLatest={onJumpToLatest}
        navigation={status ? { id: 1, edge: 'latest', status } : undefined}
      />
    </MantineProvider>
  );
  const view = render(show());
  fireEvent.click(screen.getByRole('button', { name: 'Go to latest logs' }));
  expect(onJumpToLatest).toHaveBeenCalledTimes(1);
  expect(container.scrollTop).toBe(300);
  view.rerender(show('loading'));
  expect(
    screen.getByRole('button', { name: 'Go to latest logs' }),
  ).toBeDisabled();
  expect(container.scrollTop).toBe(300);
  view.rerender(show('error'));
  expect(container.scrollTop).toBe(300);
  fireEvent.click(screen.getByRole('button', { name: 'Go to latest logs' }));
  expect(onJumpToLatest).toHaveBeenCalledTimes(2);
  view.rerender(show('success', true));
  expect(container.scrollTop).toBe(300);
  view.rerender(show('success'));
  expect(container.scrollTop).toBe(1600);
  expect(beforeScroll).toHaveBeenCalled();
});

it('blocks gestures while inspecting a log', () => {
  const { table, fetchNextPage } = setup(true);
  fireEvent.wheel(table, { deltaY: 100 });
  fireEvent.keyDown(table, { key: 'PageDown' });
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('supports keyboard downward intent', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.keyDown(table, { key: 'PageDown' });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('supports a touch gesture at the bottom', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.touchStart(table, { touches: [{ clientY: 200 }] });
  fireEvent.touchMove(table, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(table, { touches: [{ clientY: 50 }] });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('does not treat typing inside the table as load intent', () => {
  const { table, fetchNextPage } = setup();
  const input = document.createElement('input');
  table.appendChild(input);
  fireEvent.keyDown(input, { key: ' ' });
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('does not load after a scrollbar is released outside the table', () => {
  const { table, fetchNextPage } = setup();
  fireEvent.pointerDown(table);
  fireEvent.pointerUp(document.body);
  Object.defineProperty(table, 'scrollTop', { value: 100, configurable: true });
  fireEvent.scroll(table);
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('does not treat a pause within the same touch gesture as a new request', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const { table, fetchNextPage } = setup();
  fireEvent.touchStart(table, { touches: [{ clientY: 200 }] });
  await act(async () => {
    fireEvent.touchMove(table, { touches: [{ clientY: 150 }] });
  });
  now.mockReturnValue(2000);
  fireEvent.touchMove(table, { touches: [{ clientY: 100 }] });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});
