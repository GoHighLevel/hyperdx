import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { splitAndTrimWithBracket } from '@hyperdx/common-utils/dist/core/utils';
import { isBuilderChartConfig } from '@hyperdx/common-utils/dist/guards';
import type {
  ChartConfigWithOptDateRange,
  ChartConfigWithOptTimestamp,
} from '@hyperdx/common-utils/dist/types';

import { rowKey, sortChronologically } from './useLiveLogQuery.helpers';
import useOffsetPaginatedQuery from './useOffsetPaginatedQuery';

type Options = {
  isLive?: boolean;
  fallbackIsLive?: boolean;
  paused?: boolean;
  enabled?: boolean;
  queryKeyPrefix?: string;
  enableSmallFirstWindow?: boolean;
  scopeKey?: string;
  manualNavigation?: boolean;
};

type EdgeNavigation = {
  id: number;
  edge: 'start' | 'latest';
  status: 'loading' | 'success' | 'error';
};

type QueryResult = ReturnType<typeof useOffsetPaginatedQuery>;
type Data = QueryResult['data'];
type Batch = {
  config: ChartConfigWithOptTimestamp;
  complete: boolean;
  consumed: number;
  requested: boolean;
  beforeRequest: Data;
  beforeError: QueryResult['error'];
  replace?: boolean;
  latestSnapshot?: boolean;
};
type Session = {
  scope: string;
  generation: number;
  batch: Batch;
  data: Data;
  cursor: number | undefined;
  dropped: number;
  edgeNavigation?: EdgeNavigation;
  latestInRange: boolean;
};

const MAX_RETAINED_ROWS = 5000;

function orderedConfig<
  T extends ChartConfigWithOptTimestamp | ChartConfigWithOptDateRange,
>(config: T, ordering: 'ASC' | 'DESC'): T {
  if (!isBuilderChartConfig(config)) return config;
  // Live is enabled by the caller only for timestamp-ordered log queries.
  // Preserve the timestamp expression (including optimized timestamp tuples).
  const orderBy =
    typeof config.orderBy === 'string'
      ? splitAndTrimWithBracket(config.orderBy)
          .map(item => item.replace(/\s+(ASC|DESC)\s*$/i, '') + ` ${ordering}`)
          .join(', ')
      : config.orderBy?.map(item => ({ ...item, ordering }));
  return { ...config, orderBy };
}

export function chronologicalLogConfig<
  T extends ChartConfigWithOptTimestamp | ChartConfigWithOptDateRange,
>(config: T): T {
  return orderedConfig(config, 'ASC');
}

function createSession(
  scope: string,
  config: ChartConfigWithOptTimestamp,
  generation = 0,
): Session {
  return {
    scope,
    generation,
    batch: {
      config: chronologicalLogConfig(config),
      complete: false,
      consumed: 0,
      requested: true,
      beforeRequest: null,
      beforeError: null,
    },
    data: null,
    cursor: undefined,
    dropped: 0,
    latestInRange: false,
  };
}

export default function useLiveLogQuery(
  config: ChartConfigWithOptTimestamp,
  {
    isLive = false,
    fallbackIsLive = false,
    paused = false,
    enabled = true,
    queryKeyPrefix = '',
    enableSmallFirstWindow,
    scopeKey,
    manualNavigation = false,
  }: Options = {},
) {
  // A new mount must start at the selected beginning, even when an earlier
  // mounted table left several pages in the short-lived query cache.
  const instanceId = useId();
  const scope = JSON.stringify([queryKeyPrefix, scopeKey, config]);
  const range = JSON.stringify(config.dateRange);
  const [mode, setMode] = useState({ live: isLive, range, scope, hold: false });
  const hold =
    !isLive &&
    (mode.live || mode.hold) &&
    mode.range === range &&
    mode.scope === scope;
  const resumeFromHistorical =
    !manualNavigation && isLive && !mode.live && !mode.hold;
  if (
    mode.live !== isLive ||
    mode.range !== range ||
    mode.scope !== scope ||
    mode.hold !== hold
  ) {
    setMode({ live: isLive, range, scope, hold });
  }
  const [session, setSession] = useState(() => createSession(scope, config));
  // Reset before issuing a query, so a source/filter change cannot briefly
  // request another page from the previous investigation.
  const current =
    session.scope === scope && !resumeFromHistorical
      ? session
      : createSession(scope, config, session.generation + 1);
  if (current !== session) setSession(current);

  const usesSession = manualNavigation || isLive || hold;
  const canRequest = (manualNavigation || isLive) && enabled && !paused;
  const active = canRequest && current.batch.requested;
  const requestLockRef = useRef(false);
  const query = useOffsetPaginatedQuery(
    usesSession ? current.batch.config : config,
    {
      isLive: usesSession ? false : fallbackIsLive,
      enabled: usesSession
        ? active &&
          current.batch.beforeRequest == null &&
          current.batch.beforeError == null
        : enabled,
      queryKeyPrefix: usesSession
        ? `${queryKeyPrefix}:live-log:${instanceId}:${current.generation}`
        : queryKeyPrefix,
      enableSmallFirstWindow,
      gcTime: usesSession ? 30000 : undefined,
    },
  );
  useEffect(() => {
    if (!active) return;
    if (query.isError) {
      if (query.isFetching || query.error === current.batch.beforeError) return;
      requestLockRef.current = false;
      setSession(previous =>
        previous.generation !== current.generation || previous.scope !== scope
          ? previous
          : {
              ...previous,
              batch: { ...previous.batch, requested: false },
              edgeNavigation:
                previous.edgeNavigation?.status === 'loading'
                  ? { ...previous.edgeNavigation, status: 'error' }
                  : previous.edgeNavigation,
            },
      );
      return;
    }
    // Streaming progress and an in-flight result stay invisible while paused.
    // Only completed pages can advance the cursor or enter the retained buffer.
    if (
      query.isFetching ||
      !query.data ||
      query.data === current.batch.beforeRequest
    )
      return;
    const added = query.data.data.slice(current.batch.consumed);
    // DESC pagination points toward older records. A latest-edge snapshot stops
    // at its first nonempty page even when millions of older records remain.
    const complete =
      !query.hasNextPage ||
      (current.batch.latestSnapshot === true && added.length > 0);
    const continueEmptyWindow = added.length === 0 && !complete;
    requestLockRef.current = continueEmptyWindow;

    setSession(previous => {
      if (
        previous.generation !== current.generation ||
        previous.scope !== scope
      )
        return previous;
      const replace = previous.batch.replace;
      const rows = replace ? [] : (previous.data?.data ?? []);
      const seen = new Set(rows.map(rowKey));
      const unique = added.filter(row => {
        const key = rowKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = sortChronologically(
        [...rows, ...unique],
        query.data!,
        current.batch.config,
      );
      const dropped = Math.max(0, merged.length - MAX_RETAINED_ROWS);
      return {
        ...previous,
        batch: {
          ...previous.batch,
          consumed: query.data!.data.length,
          complete,
          requested: continueEmptyWindow,
          beforeRequest: query.data,
          replace: continueEmptyWindow ? replace : false,
        },
        data:
          continueEmptyWindow && replace
            ? previous.data
            : {
                ...query.data!,
                data: dropped ? merged.slice(dropped) : merged,
              },
        cursor: complete
          ? previous.batch.config.dateRange[1].getTime()
          : !continueEmptyWindow && replace
            ? undefined
            : previous.cursor,
        dropped: (replace ? 0 : previous.dropped) + dropped,
        latestInRange: continueEmptyWindow
          ? previous.latestInRange
          : complete &&
            previous.batch.config.dateRange[1].getTime() >=
              config.dateRange[1].getTime(),
        edgeNavigation:
          !continueEmptyWindow && previous.edgeNavigation?.status === 'loading'
            ? { ...previous.edgeNavigation, status: 'success' }
            : previous.edgeNavigation,
      };
    });
    // One requested page may cross empty time windows, but a nonempty page
    // always stops. Merely staying at the bottom never drains the interval.
    if (continueEmptyWindow) {
      void query.fetchNextPage({ cancelRefetch: false });
    }
  }, [active, current, query, scope, config.dateRange]);

  useEffect(() => {
    requestLockRef.current = false;
  }, [current.generation]);

  const jumpToEdge = useCallback(
    (edge: 'start' | 'latest') => {
      if (!canRequest) return;
      requestLockRef.current = true;
      // A relative live range is evaluated when the user requests fresh logs,
      // never by an idle timer. Fixed ranges keep their original boundaries.
      const end =
        isLive && edge === 'latest'
          ? // eslint-disable-next-line no-restricted-syntax
            Math.max(config.dateRange[1].getTime(), Date.now())
          : config.dateRange[1].getTime();
      const rangeDuration =
        config.dateRange[1].getTime() - config.dateRange[0].getTime();
      const latestConfig = {
        ...config,
        dateRange: [new Date(end - rangeDuration), new Date(end)] as [
          Date,
          Date,
        ],
      };
      setSession(previous => {
        const next = createSession(scope, config, previous.generation + 1);
        return {
          ...next,
          data: previous.data,
          cursor: previous.cursor,
          dropped: previous.dropped,
          latestInRange: previous.latestInRange,
          edgeNavigation: { id: next.generation, edge, status: 'loading' },
          batch: {
            ...next.batch,
            config: orderedConfig(
              edge === 'latest' ? latestConfig : config,
              edge === 'latest' ? 'DESC' : 'ASC',
            ),
            replace: true,
            latestSnapshot: edge === 'latest',
          },
        };
      });
    },
    [canRequest, scope, config, isLive],
  );

  return useMemo(
    () =>
      usesSession
        ? {
            ...query,
            data: current.data,
            isFetching: active && query.isFetching,
            isLoading: active && query.isLoading && current.data == null,
            hasNextPage: !current.batch.complete && query.hasNextPage,
            fetchNextPage: ((
              ...args: Parameters<QueryResult['fetchNextPage']>
            ) => {
              if (
                !canRequest ||
                query.isFetching ||
                current.batch.requested ||
                requestLockRef.current
              )
                return Promise.resolve(undefined);
              requestLockRef.current = true;
              if (isLive && !query.isError) {
                jumpToEdge('latest');
                return Promise.resolve(undefined);
              }
              if (!current.batch.complete || query.isError) {
                setSession(previous => ({
                  ...previous,
                  batch: {
                    ...previous.batch,
                    requested: true,
                    beforeRequest: query.data,
                    beforeError: query.error,
                  },
                  edgeNavigation:
                    previous.edgeNavigation?.status === 'error'
                      ? { ...previous.edgeNavigation, status: 'loading' }
                      : previous.edgeNavigation,
                }));
                const finishError = () => {
                  requestLockRef.current = false;
                  setSession(previous =>
                    previous.generation === current.generation
                      ? {
                          ...previous,
                          batch: { ...previous.batch, requested: false },
                          edgeNavigation:
                            previous.edgeNavigation?.status === 'loading'
                              ? { ...previous.edgeNavigation, status: 'error' }
                              : previous.edgeNavigation,
                        }
                      : previous,
                  );
                };
                return query.fetchNextPage(...args)?.then(
                  result => {
                    if (result.isError) finishError();
                    return result;
                  },
                  error => {
                    finishError();
                    throw error;
                  },
                );
              }
              requestLockRef.current = false;
              return Promise.resolve(undefined);
            }) as QueryResult['fetchNextPage'],
            refreshedUntil: current.cursor,
            retainedRowsDropped: current.dropped,
            requestedRange: current.batch.config.dateRange,
            jumpToLatest: () => jumpToEdge('latest'),
            jumpToStart: () => jumpToEdge('start'),
            edgeNavigation: current.edgeNavigation,
            latestInRange: current.latestInRange,
          }
        : {
            ...query,
            retainedRowsDropped: 0,
            requestedRange: config.dateRange,
            jumpToLatest: undefined,
            jumpToStart: undefined,
            edgeNavigation: undefined,
            latestInRange: false,
          },
    [
      usesSession,
      query,
      current,
      active,
      isLive,
      canRequest,
      config,
      jumpToEdge,
    ],
  );
}
