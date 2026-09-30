import React from 'react';
import { SourceKind } from '@hyperdx/common-utils/dist/types';
import { MantineProvider } from '@mantine/core';
import { act, render, screen, waitFor } from '@testing-library/react';

import { DBSearchPage } from '@/DBSearchPage';

const mockRouterPush = jest.fn();
const mockSetSearchedConfig = jest.fn();
const mockSetDirectTraceId = jest.fn();
const mockSetAnalysisMode = jest.fn();
const mockSetIsLive = jest.fn();
const mockOnSearch = jest.fn();
const mockOnTimeRangeSelect = jest.fn();

let mockDirectTraceId: string | null = null;
let mockSearchedConfig: Record<string, any> = {};
let mockSources: any[] = [];
// When true, useSources() reports the list as still loading, so tests can
// exercise what the page does before and after the source list arrives.
let mockSourcesLoading = false;
let latestDirectTracePanelProps: Record<string, any> | null = null;
let latestRowTableProps: Record<string, any> | null = null;

jest.mock('@/layout', () => ({
  withAppNav: (component: unknown) => component,
}));

jest.mock('next/router', () => ({
  __esModule: true,
  default: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

jest.mock('nuqs', () => ({
  parseAsBoolean: {
    withDefault: () => 'parseAsBoolean',
  },
  parseAsInteger: {
    withDefault: () => 'parseAsInteger',
  },
  parseAsString: 'parseAsString',
  parseAsStringEnum: () => ({
    withDefault: () => 'parseAsStringEnum',
  }),
  useQueryState: (key: string) => {
    switch (key) {
      case 'traceId':
        return [mockDirectTraceId, mockSetDirectTraceId];
      case 'mode':
        return ['results', mockSetAnalysisMode];
      case 'isLive':
        return [true, mockSetIsLive];
      case 'denoise':
        return [false, jest.fn()];
      default:
        return [null, jest.fn()];
    }
  },
  useQueryStates: () => {
    const React = jest.requireActual('react');
    const [, rerender] = React.useReducer((value: number) => value + 1, 0);
    const setConfig = React.useCallback((change: Record<string, unknown>) => {
      mockSetSearchedConfig(change);
      const next = { ...mockSearchedConfig, ...change };
      if (JSON.stringify(next) !== JSON.stringify(mockSearchedConfig)) {
        mockSearchedConfig = next;
        rerender();
      }
    }, []);
    return [mockSearchedConfig, setConfig];
  },
}));

jest.mock('@/source', () => ({
  getEventBody: () => 'Body',
  getFirstTimestampValueExpression: () => 'Timestamp',
  useSources: () => ({
    data: mockSourcesLoading ? undefined : mockSources,
  }),
  useSource: ({ id }: { id?: string | null }) => ({
    data: mockSourcesLoading
      ? undefined
      : mockSources.find(source => source.id === id),
    isLoading: mockSourcesLoading,
  }),
}));

jest.mock('@/timeQuery', () => ({
  parseRelativeTimeQuery: () => [new Date(0), new Date(1)],
  parseTimeQuery: () => [new Date(0), new Date(1)],
  useDefaultTimeRange: () => [new Date(0), new Date(1)],
  useNewTimeQuery: () => ({
    isReady: true,
    searchedTimeRange: [
      new Date('2024-04-01T00:00:00.000Z'),
      new Date('2024-04-02T00:00:00.000Z'),
    ],
    onSearch: mockOnSearch,
    onTimeRangeSelect: mockOnTimeRangeSelect,
  }),
}));

jest.mock('@/savedSearch', () => ({
  useCreateSavedSearch: () => ({ mutate: jest.fn() }),
  useDeleteSavedSearch: () => ({ mutate: jest.fn() }),
  useSavedSearch: () => ({ data: undefined }),
  useUpdateSavedSearch: () => ({ mutate: jest.fn() }),
}));

// Dashboard permissions/export are unrelated network boundaries for these
// source-resolution and trace-navigation fixtures.
jest.mock('@/dashboardFolders', () => ({
  useCanEditDashboard: () => true,
}));
jest.mock('@/dashboard', () => ({
  ...jest.requireActual('@/dashboard'),
  useUpdateDashboard: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
  useDeleteDashboard: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/useSearchDashboardExport', () => ({
  useSearchDashboardExport: () => ({
    exportView: jest.fn(),
    saveView: jest.fn(),
  }),
}));

jest.mock('@/searchFilters', () => ({
  useSearchPageFilterState: () => ({
    filters: [],
    whereSuggestions: [],
    setFilterValue: jest.fn(),
    clearAllFilters: jest.fn(),
  }),
}));

jest.mock('@/hooks/useChartConfig', () => ({
  useAliasMapFromChartConfig: () => ({ data: {} }),
}));

jest.mock('@/hooks/useExplainQuery', () => ({
  useExplainQuery: () => ({}),
}));

jest.mock('@/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ themeName: 'hyperdx' }),
  useBrandDisplayName: () => 'HyperDX',
}));

jest.mock('../hooks/useMetadata', () => ({
  ...jest.requireActual('../hooks/useMetadata'),
  useTableMetadata: () => ({
    data: { sorting_key: 'Timestamp' },
    isLoading: false,
  }),
  useColumns: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

jest.mock('../hooks/useSqlSuggestions', () => ({
  useSqlSuggestions: () => [],
}));

jest.mock('../components/Search/DirectTraceSidePanel', () => ({
  __esModule: true,
  default: (props: Record<string, any>) => {
    latestDirectTracePanelProps = props;
    return (
      <div data-testid="direct-trace-panel">
        <button onClick={() => props.onClose()}>close-trace</button>
        <button onClick={() => props.onSourceChange('trace-source')}>
          select-trace-source
        </button>
      </div>
    );
  },
}));

jest.mock('@/components/DBSearchPageFilters', () => ({
  DBSearchPageFilters: () => <div />,
}));

jest.mock('@/components/DBTimeChart', () => ({
  DBTimeChart: () => <div />,
}));

jest.mock('@/components/ActiveFilterPills', () => ({
  ActiveFilterPills: () => <div />,
}));
jest.mock('@/components/ContactSupportText', () => ({
  ContactSupportText: () => <div />,
}));
jest.mock('@/components/FavoriteButton', () => ({
  FavoriteButton: () => <div />,
}));
jest.mock('@/components/InputControlled', () => ({
  InputControlled: () => <div />,
}));
jest.mock('@/components/OnboardingModal', () => () => <div />);
jest.mock('@/components/SearchInput/SearchWhereInput', () => ({
  __esModule: true,
  default: () => <div />,
  getStoredLanguage: () => 'lucene',
}));
jest.mock('@/components/SearchPageActionBar', () => () => <div />);
jest.mock('@/components/SearchTotalCountChart', () => () => <div />);
jest.mock('@/components/Sources/SourceForm', () => ({
  TableSourceForm: () => <div />,
}));
jest.mock('@/components/SourceSelect', () => ({
  SourceSelectControlled: () => <div />,
}));
jest.mock('@/components/SQLEditor/SQLInlineEditor', () => ({
  SQLInlineEditorControlled: () => <div />,
}));
jest.mock('@/components/Tags', () => ({
  Tags: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/TimePicker', () => ({
  TimePicker: () => <div />,
}));
jest.mock('../components/ChartSQLPreview', () => ({
  SQLPreview: () => <div />,
}));
jest.mock(
  '../components/DBSqlRowTableWithSidebar',
  () => (props: Record<string, unknown>) => {
    latestRowTableProps = props;
    return <div />;
  },
);
jest.mock('../components/PatternTable', () => () => <div />);
jest.mock('../components/Search/DBSearchHeatmapChart', () => ({
  DBSearchHeatmapChart: () => <div />,
}));
jest.mock('../components/SourceSchemaPreview', () => ({
  __esModule: true,
  default: () => <div />,
  isSourceSchemaPreviewEnabled: () => false,
  getSourceSchemaTables: () => [],
}));
jest.mock('../components/Error/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../utils/queryParsers', () => ({
  parseAsJsonEncoded: () => 'parseAsJsonEncoded',
  parseAsSortingStateString: {
    parse: () => null,
  },
  parseAsStringEncoded: 'parseAsStringEncoded',
}));

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    useMe: () => ({
      data: { team: {} },
      isSuccess: true,
    }),
  },
}));

jest.mock('@/utils', () => ({
  QUERY_LOCAL_STORAGE: 'query-local-storage',
  useLocalStorage: (_key: string, initialValue: unknown) => [
    initialValue,
    jest.fn(),
  ],
  usePrevious: (value: unknown) => value,
}));

jest.mock('@tanstack/react-query', () => ({
  useIsFetching: () => 0,
}));

describe('DBSearchPage direct trace flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestDirectTracePanelProps = null;
    latestRowTableProps = null;
    mockSourcesLoading = false;
    mockDirectTraceId = 'trace-123';
    mockSearchedConfig = {
      source: undefined,
      where: '',
      select: '',
      whereLanguage: undefined,
      filters: [],
      orderBy: '',
    };
    mockSources = [
      {
        id: 'trace-source',
        kind: SourceKind.Trace,
        name: 'Trace Source',
        traceIdExpression: 'TraceId',
        from: { databaseName: 'db', tableName: 'traces' },
        timestampValueExpression: 'Timestamp',
        defaultTableSelectExpression: 'Timestamp',
        implicitColumnExpression: 'Body',
        connection: 'conn',
        logSourceId: 'log-source',
      },
      {
        id: 'log-source',
        kind: SourceKind.Log,
        name: 'Log Source',
        from: { databaseName: 'db', tableName: 'logs' },
        timestampValueExpression: 'Timestamp',
        defaultTableSelectExpression: 'Timestamp',
        implicitColumnExpression: 'Body',
        connection: 'conn',
      },
    ];
  });

  it('opens the direct trace panel with no selected source when none is provided', async () => {
    window.history.pushState({}, '', '/search?traceId=trace-123');

    renderWithMantine(<DBSearchPage />);

    await waitFor(() => {
      expect(latestDirectTracePanelProps).toEqual(
        expect.objectContaining({
          traceId: 'trace-123',
          traceSourceId: null,
        }),
      );
    });
  });

  it('applies a direct trace filter when a valid trace source is present', async () => {
    mockSearchedConfig = {
      ...mockSearchedConfig,
      source: 'trace-source',
    };
    window.history.pushState(
      {},
      '',
      '/search?traceId=trace-123&source=trace-source',
    );

    renderWithMantine(<DBSearchPage />);

    await waitFor(() => {
      expect(mockSetSearchedConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'trace-source',
          where: "TraceId = 'trace-123'",
          whereLanguage: 'sql',
          filters: [],
        }),
      );
    });
  });

  it('applies the default 14-day range only when from/to are absent', async () => {
    window.history.pushState({}, '', '/search?traceId=trace-123');

    await act(async () => renderWithMantine(<DBSearchPage />));

    expect(mockOnTimeRangeSelect).toHaveBeenCalled();

    jest.clearAllMocks();
    window.history.pushState({}, '', '/search?traceId=trace-123&from=1&to=2');

    await act(async () => renderWithMantine(<DBSearchPage />));

    expect(mockOnTimeRangeSelect).not.toHaveBeenCalled();
  });

  it('lets the direct trace panel update the selected source', async () => {
    window.history.pushState({}, '', '/search?traceId=trace-123');

    renderWithMantine(<DBSearchPage />);

    await waitFor(() => {
      expect(screen.getByTestId('direct-trace-panel')).toBeInTheDocument();
    });

    act(() => screen.getByText('select-trace-source').click());

    expect(mockSetSearchedConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'trace-source',
        where: "TraceId = 'trace-123'",
        whereLanguage: 'sql',
        filters: [],
      }),
    );
  });

  it('clears the direct trace mode when the panel closes', async () => {
    window.history.pushState({}, '', '/search?traceId=trace-123');

    renderWithMantine(<DBSearchPage />);

    await waitFor(() => {
      expect(screen.getByTestId('direct-trace-panel')).toBeInTheDocument();
    });

    act(() => screen.getByText('close-trace').click());

    expect(mockSetDirectTraceId).toHaveBeenCalledWith(null);
  });

  it('resolves a source *name* in the source param to its id', async () => {
    mockSearchedConfig = {
      ...mockSearchedConfig,
      source: 'Trace Source',
    };
    window.history.pushState(
      {},
      '',
      '/search?traceId=trace-123&source=Trace%20Source',
    );

    renderWithMantine(<DBSearchPage />);

    // The direct trace filter only applies once the param resolves to a real
    // trace source, so this asserts the name was resolved to its id.
    await waitFor(() => {
      expect(mockSetSearchedConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'trace-source',
          where: "TraceId = 'trace-123'",
          whereLanguage: 'sql',
        }),
      );
    });
  });

  // Renders through the source-list load so the form's `source` value goes from
  // empty to the resolved ID, the way a cold page load does. A wrapper (rather
  // than renderWithMantine) is used so `rerender` keeps the provider tree, and
  // with it the page's own state and refs.
  async function renderThroughSourceLoad() {
    jest.useFakeTimers();
    const { rerender } = render(<DBSearchPage />, {
      wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
    });

    mockSourcesLoading = false;
    await act(async () => {
      rerender(<DBSearchPage />);
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    jest.useRealTimers();
  }

  it('canonicalizes a source name to its id without touching the rest of the config', async () => {
    mockDirectTraceId = null;
    mockSourcesLoading = true;
    mockSearchedConfig = {
      source: 'Log Source',
      where: '',
      select: 'Timestamp, Body',
      whereLanguage: undefined,
      filters: [],
      orderBy: '',
    };
    window.history.pushState(
      {},
      '',
      '/search?source=Log%20Source&select=Timestamp%2C%20Body',
    );

    await renderThroughSourceLoad();

    // The name is replaced by its id, and nothing else: a source-switch would
    // have cleared select/orderBy/filters and submitted the whole config.
    expect(mockSetSearchedConfig).toHaveBeenCalledTimes(1);
    expect(mockSetSearchedConfig).toHaveBeenCalledWith({
      source: 'log-source',
    });
  });

  it('leaves the config alone when the param is already a source id', async () => {
    mockDirectTraceId = null;
    mockSourcesLoading = true;
    mockSearchedConfig = {
      source: 'log-source',
      where: '',
      select: 'Timestamp, Body',
      whereLanguage: undefined,
      filters: [],
      orderBy: '',
    };
    window.history.pushState(
      {},
      '',
      '/search?source=log-source&select=Timestamp%2C%20Body',
    );

    await renderThroughSourceLoad();

    expect(mockSetSearchedConfig).not.toHaveBeenCalled();
  });

  it('leaves an unresolvable source param alone instead of picking a default', async () => {
    mockDirectTraceId = null;
    mockSourcesLoading = true;
    mockSearchedConfig = {
      source: 'Deleted Source',
      where: '',
      select: '',
      whereLanguage: undefined,
      filters: [],
      orderBy: '',
    };
    window.history.pushState({}, '', '/search?source=Deleted%20Source');

    await renderThroughSourceLoad();

    // Neither the default-source effect nor the form fallback may overwrite a
    // link whose source no longer exists — the user gets a notification and an
    // empty source picker instead.
    expect(mockSetSearchedConfig).not.toHaveBeenCalled();
  });

  it('still selects a default source when there is no source param', async () => {
    mockDirectTraceId = null;
    mockSourcesLoading = true;
    mockSearchedConfig = {
      source: null,
      where: '',
      select: '',
      whereLanguage: undefined,
      filters: [],
      orderBy: '',
    };
    window.history.pushState({}, '', '/search');

    await renderThroughSourceLoad();

    expect(mockSetSearchedConfig).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'trace-source' }),
    );
  });

  it('retains a saved-search link configuration while normalizing log chronology', async () => {
    // On `/search/<savedSearchId>` the source is written to the URL by the
    // saved-search effect, so the form catches up to it on a cold load. The
    // Order normalization must preserve the bookmarked SELECT and source.
    mockDirectTraceId = null;
    mockSourcesLoading = true;
    mockSearchedConfig = {
      source: 'log-source',
      where: '',
      select: 'Timestamp, Body, lower(Body) as body_lower',
      whereLanguage: undefined,
      filters: [],
      orderBy: 'Timestamp DESC',
    };
    window.history.pushState(
      {},
      '',
      '/search/saved-1?source=log-source&select=Timestamp%2C%20Body%2C%20lower(Body)%20as%20body_lower&orderBy=Timestamp%20DESC',
    );

    await renderThroughSourceLoad();

    expect(mockSearchedConfig).toEqual(
      expect.objectContaining({
        source: 'log-source',
        select: 'Timestamp, Body, lower(Body) as body_lower',
        orderBy: 'Timestamp ASC',
      }),
    );
    expect(latestRowTableProps).toEqual(
      expect.objectContaining({
        sourceId: 'log-source',
        enabled: true,
        config: expect.objectContaining({
          orderBy: 'Timestamp ASC',
          select: 'Timestamp, Body, lower(Body) as body_lower',
        }),
      }),
    );
    // Nothing may land that empties them.
    for (const [config] of mockSetSearchedConfig.mock.calls) {
      expect(config).not.toMatchObject({ select: '' });
      expect(config).not.toMatchObject({ orderBy: '' });
    }
  });

  it('does not render a top refresh-interval dropdown in live log search', async () => {
    mockDirectTraceId = null;
    mockSearchedConfig = { ...mockSearchedConfig, source: 'log-source' };
    window.history.pushState({}, '', '/search?source=log-source');
    await act(async () => renderWithMantine(<DBSearchPage />));
    // Source and time controls are fixture boundaries; the real page previously
    // added its own Mantine Select here when Live was enabled.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('does not advance the log range on a background refresh timer', async () => {
    jest.useFakeTimers();
    try {
      mockDirectTraceId = null;
      mockSearchedConfig = { ...mockSearchedConfig, source: 'log-source' };
      window.history.pushState({}, '', '/search?source=log-source');
      await act(async () => renderWithMantine(<DBSearchPage />));
      mockOnTimeRangeSelect.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });
      expect(mockOnTimeRangeSelect).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
