import { SourceKind } from '@hyperdx/common-utils/dist/types';
import { renderHook } from '@testing-library/react';

import {
  buildSavedSearchNavigationUrl,
  getDefaultSourceId,
  useDefaultOrderBy,
} from '@/DBSearchPage';
import * as metadataModule from '@/hooks/useMetadata';
import * as sourceModule from '@/source';

// Mock the dependencies
jest.mock('@/layout', () => ({
  withAppNav: (component: any) => component,
}));

describe('buildSavedSearchNavigationUrl', () => {
  it('drops saved-search query state when the source uses the default relative range', () => {
    expect(
      buildSavedSearchNavigationUrl(
        '/clickstack',
        'saved-search-id',
        '?where=service%3Aapi&orderBy=timestamp',
      ),
    ).toBe('/clickstack/search/saved-search-id');
  });

  it('keeps an absolute range out of live-tail mode', () => {
    expect(
      buildSavedSearchNavigationUrl(
        '/clickstack',
        'saved-search-id',
        '?from=100&to=200&isLive=false&where=service%3Aapi&orderBy=timestamp',
      ),
    ).toBe('/clickstack/search/saved-search-id?from=100&to=200&isLive=false');
  });
});

describe('useDefaultOrderBy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('optimizeOrderBy function', () => {
    it.each([
      {
        kind: SourceKind.Trace,
        orderByExpression: undefined,
        expected: 'Timestamp DESC',
      },
      {
        kind: SourceKind.Trace,
        orderByExpression: 'Timestamp DESC',
        expected: 'Timestamp DESC',
      },
      {
        kind: SourceKind.Log,
        orderByExpression: 'Timestamp DESC',
        expected: 'Timestamp ASC',
      },
      {
        kind: SourceKind.Log,
        orderByExpression: 'SeverityText DESC',
        expected: 'SeverityText DESC',
      },
    ])(
      'preserves source-specific ordering: $kind / $orderByExpression',
      ({ kind, orderByExpression, expected }) => {
        jest.spyOn(sourceModule, 'useSource').mockReturnValue({
          data: {
            kind,
            timestampValueExpression: 'Timestamp',
            orderByExpression,
          },
          isLoading: false,
          error: null,
        } as any);
        jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
          data: { sorting_key: 'Timestamp' },
          isLoading: false,
          error: null,
        } as any);
        const { result } = renderHook(() => useDefaultOrderBy('source-id'));
        expect(result.current).toBe(expected);
      },
    );

    describe('should handle', () => {
      const testCases = [
        {
          sortingKey: undefined,
          expected: 'Timestamp ASC',
        },
        {
          sortingKey: '',
          expected: 'Timestamp ASC',
        },
        {
          sortingKey: 'ServiceName, SpanName, toDateTime(Timestamp)',
          expected: '(toDateTime(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey:
            'toStartOfHour(Timestamp), ServiceName, SpanName, toDateTime(Timestamp)',
          expected:
            '(toStartOfHour(Timestamp), toDateTime(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey:
            'toStartOfHour(Timestamp), ServiceName, SpanName, toDateTime(Timestamp)',
          expected:
            '(toStartOfHour(Timestamp), toDateTime(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toDateTime(Timestamp), ServiceName, SpanName, Timestamp',
          expected: '(toDateTime(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toDateTime(Timestamp), ServiceName, SpanName',
          expected: '(toDateTime(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfHour(Timestamp), other_column, Timestamp',
          expected: '(toStartOfHour(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'Timestamp, other_column',
          expected: 'Timestamp ASC',
        },
        {
          sortingKey: 'user_id, toStartOfHour(Timestamp), status, Timestamp',
          expected: '(toStartOfHour(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey:
            'toStartOfMinute(Timestamp), user_id, status, toUnixTimestamp(Timestamp)',
          expected:
            '(toStartOfMinute(Timestamp), toUnixTimestamp(Timestamp), Timestamp) ASC',
        },
        {
          // test variation of toUnixTimestamp
          sortingKey:
            'toStartOfMinute(Timestamp), user_id, status, toUnixTimestamp64Nano(Timestamp)',
          expected:
            '(toStartOfMinute(Timestamp), toUnixTimestamp64Nano(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey:
            'toUnixTimestamp(toStartOfMinute(Timestamp)), user_id, status, Timestamp',
          expected:
            '(toUnixTimestamp(toStartOfMinute(Timestamp)), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfMinute(Timestamp), user_id, status, Timestamp',
          timestampValueExpression: 'Timestamp, toStartOfMinute(Timestamp)',
          expected: '(toStartOfMinute(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfMinute(Timestamp), user_id, status, Timestamp',
          timestampValueExpression: 'toStartOfMinute(Timestamp), Timestamp',
          expected: '(toStartOfMinute(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfMinute(Timestamp), user_id, status, Timestamp',
          expected: '(toStartOfMinute(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfMinute(Timestamp), user_id, status',
          expected: '(toStartOfMinute(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'toStartOfMinute(Timestamp), user_id, status',
          timestampValueExpression: 'toStartOfMinute(Timestamp), Timestamp',
          expected: '(toStartOfMinute(Timestamp), Timestamp) ASC',
        },
        {
          sortingKey: 'Timestamp',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey: 'Timestamp',
          displayedTimestampValueExpression: 'Timestamp64 ',
          expected: '(Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey: 'Timestamp',
          expected: 'Timestamp ASC',
        },
        {
          sortingKey: 'Timestamp',
          displayedTimestampValueExpression: '',
          expected: 'Timestamp ASC',
        },
        {
          sortingKey: 'Timestamp, ServiceName, Timestamp64',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey:
            'toStartOfMinute(Timestamp), Timestamp, ServiceName, Timestamp64',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(toStartOfMinute(Timestamp), Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey:
            'toStartOfMinute(Timestamp), Timestamp64, ServiceName, Timestamp',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(toStartOfMinute(Timestamp), Timestamp64, Timestamp) ASC',
        },
        {
          sortingKey: 'SomeOtherTimeColumn',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey: '',
          displayedTimestampValueExpression: 'Timestamp64',
          expected: '(Timestamp, Timestamp64) ASC',
        },
        {
          sortingKey: 'ServiceName, TimestampTime, Timestamp',
          timestampValueExpression: 'TimestampTime, Timestamp',
          expected: '(TimestampTime, Timestamp) ASC',
        },
        {
          sortingKey: 'ServiceName, TimestampTime, Timestamp',
          timestampValueExpression: 'Timestamp, TimestampTime',
          expected: '(TimestampTime, Timestamp) ASC',
        },
        {
          sortingKey: 'ServiceName, TimestampTime, Timestamp',
          expected: '(TimestampTime, Timestamp) ASC',
        },
      ];
      for (const testCase of testCases) {
        it(`${testCase.sortingKey}`, () => {
          const mockSource = {
            kind: SourceKind.Log,
            timestampValueExpression:
              testCase.timestampValueExpression || 'Timestamp',
            displayedTimestampValueExpression:
              testCase.displayedTimestampValueExpression,
          };

          const mockTableMetadata = {
            sorting_key: testCase.sortingKey,
          };

          jest.spyOn(sourceModule, 'useSource').mockReturnValue({
            data: mockSource,
            isLoading: false,
            error: null,
          } as any);

          jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
            data: mockTableMetadata,
            isLoading: false,
            error: null,
          } as any);

          const { result } = renderHook(() => useDefaultOrderBy('source-id'));

          expect(result.current).toBe(testCase.expected);
        });
      }
    });

    it('should handle null source ungracefully', () => {
      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy(null));

      expect(result.current).toBe(undefined);
    });

    it('should handle undefined sourceID ungracefully', () => {
      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy(undefined));

      expect(result.current).toBe(undefined);
    });

    it('should return orderByExpression when set on the source', () => {
      const mockSource = {
        kind: SourceKind.Log,
        timestampValueExpression: 'Timestamp',
        orderByExpression: 'Timestamp ASC',
      };

      const mockTableMetadata = {
        sorting_key: 'toStartOfMinute(Timestamp), Timestamp',
      };

      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: mockSource,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: mockTableMetadata,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy('source-id'));

      expect(result.current).toBe('Timestamp ASC');
    });

    it('should fall back to optimized order when orderByExpression is empty', () => {
      const mockSource = {
        kind: SourceKind.Log,
        timestampValueExpression: 'Timestamp',
        orderByExpression: '',
      };

      const mockTableMetadata = {
        sorting_key: 'toStartOfHour(Timestamp), Timestamp',
      };

      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: mockSource,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: mockTableMetadata,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy('source-id'));

      expect(result.current).toBe('(toStartOfHour(Timestamp), Timestamp) ASC');
    });

    it('should fall back to optimized order when orderByExpression is undefined', () => {
      const mockSource = {
        kind: SourceKind.Log,
        timestampValueExpression: 'Timestamp',
      };

      const mockTableMetadata = {
        sorting_key: 'toStartOfHour(Timestamp), Timestamp',
      };

      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: mockSource,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: mockTableMetadata,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy('source-id'));

      expect(result.current).toBe('(toStartOfHour(Timestamp), Timestamp) ASC');
    });

    it('should handle complex Timestamp expressions', () => {
      const mockSource = {
        kind: SourceKind.Log,
        timestampValueExpression: 'toDateTime(timestamp_ms / 1000)',
      };

      const mockTableMetadata = {
        sorting_key:
          'toStartOfHour(toDateTime(timestamp_ms / 1000)), toDateTime(timestamp_ms / 1000)',
      };

      jest.spyOn(sourceModule, 'useSource').mockReturnValue({
        data: mockSource,
        isLoading: false,
        error: null,
      } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: mockTableMetadata,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useDefaultOrderBy('source-id'));

      expect(result.current).toBe(
        '(toStartOfHour(toDateTime(timestamp_ms / 1000)), toDateTime(timestamp_ms / 1000)) ASC',
      );
    });

    it('should memoize result correctly when dependencies change', () => {
      const mockSource1 = {
        kind: SourceKind.Log,
        timestampValueExpression: 'timestamp1',
      };

      const mockSource2 = {
        kind: SourceKind.Log,
        timestampValueExpression: 'timestamp2',
      };

      const useSourceSpy = jest
        .spyOn(sourceModule, 'useSource')
        .mockReturnValue({
          data: mockSource1,
          isLoading: false,
          error: null,
        } as any);

      jest.spyOn(metadataModule, 'useTableMetadata').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      const { result, rerender } = renderHook(() =>
        useDefaultOrderBy('source-id'),
      );

      expect(result.current).toBe('timestamp1 ASC');

      // Update the mock to return different data
      useSourceSpy.mockReturnValue({
        data: mockSource2,
        isLoading: false,
        error: null,
      } as any);

      rerender();

      expect(result.current).toBe('timestamp2 ASC');
    });
  });
});

describe('getDefaultSourceId', () => {
  it('returns empty string if sources is undefined', () => {
    expect(getDefaultSourceId(undefined, undefined)).toBe('');
  });

  it('returns empty string if sources is empty', () => {
    expect(getDefaultSourceId([], undefined)).toBe('');
  });

  it('returns empty string if sources is empty but lastSelectedSourceId is a string', () => {
    expect(getDefaultSourceId([], 'some-id')).toBe('');
  });

  it('returns lastSelectedSourceId if it exists in sources', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log },
      { id: 'b', kind: SourceKind.Log },
      { id: 'c', kind: SourceKind.Log },
    ];
    expect(getDefaultSourceId(sources, 'b')).toBe('b');
  });

  it('returns first source id if lastSelectedSourceId is not in sources', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log },
      { id: 'b', kind: SourceKind.Log },
    ];
    expect(getDefaultSourceId(sources, 'z')).toBe('a');
  });

  it('returns first source id if lastSelectedSourceId is undefined', () => {
    const sources = [
      { id: 'x', kind: SourceKind.Log },
      { id: 'y', kind: SourceKind.Log },
    ];
    expect(getDefaultSourceId(sources, undefined)).toBe('x');
  });

  it('returns "" when sources is undefined', () => {
    expect(getDefaultSourceId(undefined, undefined)).toBe('');
  });

  it('returns "" when sources is empty', () => {
    expect(getDefaultSourceId([], undefined)).toBe('');
  });

  it('returns "" when there is no searchable (log/trace) source', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Metric },
      { id: 'b', kind: SourceKind.Session },
    ];
    expect(getDefaultSourceId(sources, 'a')).toBe('');
  });

  it('returns "" when there is no enabled source', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log, disabled: true },
      { id: 'b', kind: SourceKind.Log, disabled: true },
    ];
    expect(getDefaultSourceId(sources, 'a')).toBe('');
  });

  it('skips metric/session sources and defaults to the first log/trace source', () => {
    const sources = [
      { id: 'metrics', kind: SourceKind.Metric },
      { id: 'sessions', kind: SourceKind.Session },
      { id: 'logs', kind: SourceKind.Log },
      { id: 'traces', kind: SourceKind.Trace },
    ];
    expect(getDefaultSourceId(sources, undefined)).toBe('logs');
  });

  it('prefers an enabled log/trace source over an earlier disabled one', () => {
    const sources = [
      { id: 'metrics', kind: SourceKind.Metric },
      { id: 'logs', kind: SourceKind.Log, disabled: true },
      { id: 'traces', kind: SourceKind.Trace, disabled: false },
    ];
    expect(getDefaultSourceId(sources, undefined)).toBe('traces');
  });

  it('ignores a last-selected source of an incompatible kind', () => {
    const sources = [
      { id: 'metrics', kind: SourceKind.Metric },
      { id: 'logs', kind: SourceKind.Log },
    ];
    expect(getDefaultSourceId(sources, 'metrics')).toBe('logs');
  });

  it('returns the last-selected source when it is enabled', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log, disabled: false },
      { id: 'b', kind: SourceKind.Log, disabled: false },
      { id: 'c', kind: SourceKind.Log }, // disabled is undefined => treated as enabled
    ];
    expect(getDefaultSourceId(sources, 'b')).toBe('b');
    expect(getDefaultSourceId(sources, 'c')).toBe('c');
  });

  it('falls back to the first enabled source when last-selected is disabled', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log, disabled: true },
      { id: 'b', kind: SourceKind.Log, disabled: false },
      { id: 'c', kind: SourceKind.Log, disabled: false },
    ];
    expect(getDefaultSourceId(sources, 'a')).toBe('b');
  });

  it('falls back to the first enabled source when last-selected is unknown', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log, disabled: true },
      { id: 'b', kind: SourceKind.Log, disabled: false },
    ];
    expect(getDefaultSourceId(sources, 'unknown-id')).toBe('b');
  });

  it('returns the first enabled source when last-selected is undefined and the list is mixed', () => {
    const sources = [
      { id: 'a', kind: SourceKind.Log, disabled: true },
      { id: 'b', kind: SourceKind.Log, disabled: false },
      { id: 'c', kind: SourceKind.Log, disabled: false },
    ];
    expect(getDefaultSourceId(sources, undefined)).toBe('b');
  });
});
