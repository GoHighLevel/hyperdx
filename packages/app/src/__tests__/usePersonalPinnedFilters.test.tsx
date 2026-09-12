import { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { usePersonalPinnedFilters } from '@/usePersonalPinnedFilters';

let mockUserId = 'alice';
const mockWrites: unknown[] = [];
const mockSaved = new Map<string, unknown>();
jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: { id: mockUserId } }) },
  hdxServer: (
    path: string,
    options?: {
      method?: string;
      json?: { source: string; fields: string[]; filters: object };
    },
  ) => {
    if (options?.method === 'PUT' && options.json) {
      mockWrites.push(options.json);
      mockSaved.set(`${mockUserId}:${options.json.source}`, {
        fields: options.json.fields,
        filters: options.json.filters,
      });
    }
    return Object.assign(Promise.resolve(), {
      json: () =>
        Promise.resolve(
          mockSaved.get(`${mockUserId}:${path.split('source=')[1]}`) ?? {
            fields: [],
            filters: {},
          },
        ),
    });
  },
}));
jest.mock('@/config', () => ({ IS_LOCAL_MODE: false }));
jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

describe('personal filter preferences', () => {
  beforeEach(() => {
    mockUserId = 'alice';
    mockWrites.length = 0;
    mockSaved.clear();
  });

  function setup() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  }

  it('remembers fields without remembering the active query values', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => usePersonalPinnedFilters('logs'), {
      wrapper,
    });
    await waitFor(() =>
      expect(
        client.getQueryData(['personal-pinned-filters', 'alice', 'logs']),
      ).toBeDefined(),
    );
    act(() => result.current.rememberFields(['label_team']));
    await waitFor(() => expect(mockWrites).toHaveLength(1));
    expect(mockWrites[0]).toEqual({
      source: 'logs',
      fields: ['label_team'],
      filters: {},
    });
    act(() => result.current.rememberFields(['label_team']));
    expect(mockWrites).toHaveLength(1);
    client.clear();
  });

  it('isolates accounts and sources in the same browser', async () => {
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ source }) => usePersonalPinnedFilters(source),
      { wrapper, initialProps: { source: 'logs' } },
    );
    await waitFor(() =>
      expect(
        client.getQueryData(['personal-pinned-filters', 'alice', 'logs']),
      ).toBeDefined(),
    );
    act(() => result.current.rememberFields(['label_team']));
    await waitFor(() => expect(result.current.fields).toEqual(['label_team']));
    mockUserId = 'bob';
    rerender({ source: 'logs' });
    expect(result.current.fields).toEqual([]);
    mockUserId = 'alice';
    rerender({ source: 'traces' });
    expect(result.current.fields).toEqual([]);
    rerender({ source: 'logs' });
    expect(result.current.fields).toEqual(['label_team']);
    client.clear();
  });

  it('combines rapid updates from multiple sidebar consumers', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => ({
        first: usePersonalPinnedFilters('logs'),
        second: usePersonalPinnedFilters('logs'),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(
        client.getQueryData(['personal-pinned-filters', 'alice', 'logs']),
      ).toBeDefined(),
    );
    act(() => {
      result.current.first.rememberFields(['label_team']);
      result.current.second.rememberFields(['host']);
    });
    await waitFor(() => expect(mockWrites).toHaveLength(2));
    expect(mockWrites[1]).toEqual({
      source: 'logs',
      fields: ['label_team', 'host'],
      filters: {},
    });
    client.clear();
  });
});
