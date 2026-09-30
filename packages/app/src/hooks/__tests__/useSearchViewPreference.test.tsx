import { PropsWithChildren } from 'react';
import { SearchViewSchema } from '@hyperdx/common-utils/dist/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import SearchViewProvider from '@/components/Search/SearchViewProvider';
import { useSearchViewPreference } from '@/hooks/useSearchViewPreference';
import { useSearchView } from '@/SearchViewContext';
import { usePersonalPinnedFilters } from '@/usePersonalPinnedFilters';

let mockUserId = 'alice';
const mockRequest = jest.fn();
jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: { id: mockUserId } }) },
  hdxServer: (...args: unknown[]) => mockRequest(...args),
}));
jest.mock('@/config', () => ({ IS_LOCAL_MODE: false }));

const view = SearchViewSchema.parse({
  version: 1,
  search: {
    source: 'logs',
    select: 'timestamp',
    where: '',
    whereLanguage: 'lucene',
  },
  time: {
    from: 1,
    to: 2,
    isLive: false,
    liveInterval: 900000,
    refreshFrequency: 10000,
  },
  analysisMode: 'results',
  denoise: false,
  preferences: { 'log-table-wrap-lines': true },
  userPreferences: {
    isUTC: false,
    timeFormat: '12h',
    font: 'IBM Plex Mono',
    logFontSize: 16,
  },
  sharedPins: { fields: ['service'], filters: {} },
  personalPins: { fields: ['trace_id'], filters: {} },
});

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <SearchViewProvider view={view} dashboardId="copy">
        {children}
      </SearchViewProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockRequest.mockClear();
  mockUserId = 'alice';
});

it('restores portable layout keys without overwriting ordinary search preferences', () => {
  localStorage.setItem('new-id-wrap-lines', 'false');
  const { result } = renderHook(
    () => ({
      setting: useSearchViewPreference<boolean>(
        'new-id-wrap-lines',
        false,
        true,
        'log-table-wrap-lines',
      ),
      view: useSearchView(),
    }),
    { wrapper },
  );
  expect(result.current.setting[0]).toBe(true);
  act(() => result.current.setting[1](false));
  expect(result.current.view?.preferences['log-table-wrap-lines']).toBe(false);
  expect(localStorage.getItem('new-id-wrap-lines')).toBe('false');
});

it('isolates a dashboard viewer’s personal changes and restores them on reopening', () => {
  const first = renderHook(() => usePersonalPinnedFilters('logs'), { wrapper });
  expect(first.result.current.fields).toEqual(['trace_id']);
  act(() => first.result.current.removeField('trace_id'));
  expect(first.result.current.fields).toEqual([]);
  expect(mockRequest).not.toHaveBeenCalled();
  first.unmount();
  const reopened = renderHook(() => usePersonalPinnedFilters('logs'), {
    wrapper,
  });
  expect(reopened.result.current.fields).toEqual([]);
  reopened.unmount();
  mockUserId = 'bob';
  const other = renderHook(() => usePersonalPinnedFilters('logs'), { wrapper });
  expect(other.result.current.fields).toEqual(['trace_id']);
  expect(mockRequest).not.toHaveBeenCalled();
});
