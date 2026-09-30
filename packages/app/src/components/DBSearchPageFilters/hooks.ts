import { useCallback, useEffect, useMemo, useState } from 'react';
import produce from 'immer';
import {
  TableConnection,
  tcFromSource,
} from '@hyperdx/common-utils/dist/core/metadata';
import {
  FilterState,
  filtersToQuery,
  serializeFilterState,
} from '@hyperdx/common-utils/dist/filters';
import {
  BuilderChartConfigWithDateRange,
  isMetricSource,
  TSource,
} from '@hyperdx/common-utils/dist/types';

import {
  Facet,
  useAllFields,
  useColumns,
  useDateTimeColumns,
  useGetKeyValues,
  useJsonColumns,
  useMapColumns,
  useMetadataWithSettings,
} from '@/hooks/useMetadata';
import { escapeFilterStateKeys, usePinnedFilters } from '@/searchFilters';
import { useSource } from '@/source';
import { mergePath } from '@/utils';

import { isDefaultVisibleFilter } from './personalFilterDefaults';
import { useQueriedFields } from './useQueriedFields';
import { toQuotedClickHouseKeyExpression } from './utils';

const INITIAL_LOAD_LIMIT = 20;

/* The maximum number of values per filter to load when "Load More" is clicked */
const LOAD_MORE_LOAD_LIMIT = 10000;

export function mergeLatestFacets(previous: Facet[], latest: Facet[]): Facet[] {
  const merged = new Map(previous.map(facet => [facet.key, facet]));
  for (const facet of latest) merged.set(facet.key, facet);
  return Array.from(merged.values());
}

/**
 * Decide which table key-value discovery reads from.
 *
 * The source stays authoritative whenever we have one, so its metadata
 * materialized views keep serving discovery. `fallback` — the table connection
 * a caller passes — is consulted in the two cases the source can't answer:
 *
 *  - No source id is provided
 *  - A metric source, in which case the fallback provides the metric type's table name
 */
export function resolveTableConnection(
  source: TSource | undefined,
  fallback: TableConnection | undefined,
): TableConnection {
  const isFallbackUsable =
    !!fallback?.databaseName && !!fallback.tableName && !!fallback.connectionId;
  if (!source) {
    return isFallbackUsable ? fallback : tcFromSource(undefined);
  }
  if (isMetricSource(source) && isFallbackUsable) {
    return fallback;
  }
  return tcFromSource(source);
}

function useFacets({
  chartConfig,
  sourceId,
  tableConnection: tableConnectionFallback,
  mode,
  dateRange,
  filterState,
  expandedFacetKeys,
  enabled,
  disableValues,
}: {
  chartConfig: BuilderChartConfigWithDateRange;
  sourceId: string | null;
  /**
   * A table where keys and values are discovered. Used when sourceId
   * is not provided or references a metrics source.
   */
  tableConnection?: TableConnection;
  mode: 'all' | 'exact';
  dateRange: [Date, Date];
  filterState?: FilterState;
  expandedFacetKeys?: readonly string[];
  enabled?: boolean;
  disableValues?: boolean;
}) {
  const { data: source } = useSource({
    id: sourceId,
  });
  const tableConnection = useMemo(
    () => resolveTableConnection(source, tableConnectionFallback),
    [source, tableConnectionFallback],
  );
  const { data: columns, isLoading: isColumnsLoading } =
    useColumns(tableConnection);
  const dateTimeColumns = useDateTimeColumns(columns);
  const knownColumns = useMemo(
    () => (columns ? new Set(columns.map(c => c.name)) : new Set<string>()),
    [columns],
  );
  const { data: jsonColumns } = useJsonColumns(tableConnection);
  const { data: mapColumns } = useMapColumns(tableConnection);
  const { data: queriedFields } = useQueriedFields(
    chartConfig,
    tableConnection,
    !!columns && enabled !== false,
  );

  const {
    data: allFields,
    error: allFieldsError,
    isLoading: isAllFieldsLoading,
  } = useAllFields(tableConnection, {
    dateRange,
    timestampValueExpression: source?.timestampValueExpression,
    enabled,
  });

  const { isFieldPinned, isSharedFieldPinned, getPinnedFields } =
    usePinnedFilters(sourceId ?? null);

  const availableFacetKeys = useMemo(() => {
    const aliases = new Set(chartConfig.with?.map(clause => clause.name));
    const hasLevelAlias = aliases.has('Level');
    return [...(allFields ?? [])]
      .sort((a, b) => {
        // First show low cardinality fields
        const isLowCardinality = (type: string) =>
          type.includes('LowCardinality');
        return (
          (isLowCardinality(b.type) ? 1 : 0) -
          (isLowCardinality(a.type) ? 1 : 0)
        );
      })
      .filter(
        field => field.jsType && ['string'].includes(field.jsType),
        // todo: add number type with sliders :D
      )
      .map(({ path, type }) => {
        return {
          type,
          path:
            hasLevelAlias && path.length === 1 && path[0] === 'log_level'
              ? 'Level'
              : mergePath(path, jsonColumns ?? [], mapColumns ?? []),
          isMapSubField: path.length > 1,
        };
      })
      .map(({ path }) => path)
      .filter(
        path =>
          !['body', 'timestamp', '_hdx_body'].includes(path.toLowerCase()),
      );
  }, [allFields, chartConfig.with, jsonColumns, mapColumns]);

  const keysToFetch = useMemo(() => {
    const aliases = new Set(chartConfig.with?.map(clause => clause.name));
    const isEagerField = (field: string) =>
      isDefaultVisibleFilter(field) ||
      (filterState && Object.keys(filterState).includes(field)) ||
      isFieldPinned(field) ||
      isSharedFieldPinned(field);

    const expandedDiscoveredKeys = (expandedFacetKeys ?? []).flatMap(
      expandedKey => {
        const discoveredKey = availableFacetKeys.find(
          field =>
            expandedKey === field || expandedKey === `toString(${field})`,
        );
        return discoveredKey ? [discoveredKey] : [];
      },
    );
    const eagerDiscoveredKeys = availableFacetKeys.filter(isEagerField);
    // A field selected from a log may be absent from sampled metadata (or be
    // a JSONExtract expression). Keep it queryable after the filter is cleared.
    return Array.from(
      new Set([
        ...expandedDiscoveredKeys.slice(0, 1),
        ...Object.keys(filterState ?? {}),
        ...getPinnedFields(),
        ...(queriedFields ?? []),
        ...eagerDiscoveredKeys,
        ...expandedDiscoveredKeys.slice(1),
      ]),
    ).filter(
      key =>
        !['Level', 'Message'].includes(key) ||
        aliases.has(key) ||
        knownColumns.has(key),
    );
  }, [
    availableFacetKeys,
    chartConfig.with,
    knownColumns,
    filterState,
    expandedFacetKeys,
    isFieldPinned,
    isSharedFieldPinned,
    getPinnedFields,
    queriedFields,
  ]);

  const isFacetValueQueryable = useMemo(() => {
    const aliases = new Set(chartConfig.with?.map(clause => clause.name));
    const discovered = new Set(
      (allFields ?? [])
        .filter(field => field.jsType && ['string'].includes(field.jsType))
        .map(({ path }) =>
          mergePath(path, jsonColumns ?? [], mapColumns ?? []),
        ),
    );
    const queried = new Set(queriedFields ?? []);
    const bare = /^[A-Za-z_][A-Za-z0-9_]*$/;
    const quoted = /^`([^`]+)`$/;
    const pathExpression = /^(?:`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*))(?:\.|\[)/;
    const normalize = (value: string) => {
      const trimmed = value.trim();
      return trimmed.match(quoted)?.[1] ?? trimmed;
    };
    const containers = new Set(
      [
        ...(columns
          ?.filter(
            column =>
              column.type === 'JSON' ||
              column.type.startsWith('JSON(') ||
              column.type.startsWith('Map('),
          )
          .map(column => column.name) ?? []),
        source && 'eventAttributesExpression' in source
          ? source.eventAttributesExpression
          : undefined,
        source && 'resourceAttributesExpression' in source
          ? source.resourceAttributesExpression
          : undefined,
      ]
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        )
        .flatMap(value => {
          const trimmed = value.trim();
          return [trimmed, normalize(trimmed)];
        }),
    );
    const canQuery = (value: string): boolean => {
      const trimmed = value.trim();
      const normalized = normalize(trimmed);
      if (containers.has(trimmed) || containers.has(normalized)) return false;
      if (
        knownColumns.has(trimmed) ||
        knownColumns.has(normalized) ||
        aliases.has(trimmed) ||
        aliases.has(normalized)
      )
        return true;
      const toStringMatch = trimmed.match(/^toString\((.*)\)$/);
      if (toStringMatch) return canQuery(toStringMatch[1]);
      const castMatch = trimmed.match(/^CAST\((.*)\s+AS\s+[^)]+\)$/i);
      if (castMatch) return canQuery(castMatch[1]);
      if (bare.test(trimmed) || quoted.test(trimmed)) return false;
      const pathMatch = trimmed.match(pathExpression);
      if (pathMatch) {
        const root = pathMatch[1] ?? pathMatch[2];
        if (knownColumns.has(root) || aliases.has(root)) return true;
      }
      if (discovered.has(trimmed) || queried.has(trimmed)) return true;
      const extractionMatch = trimmed.match(
        /^(?:JSONExtract\w*|arrayElement|mapElement)\(\s*(?:`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*))\s*,/,
      );
      if (extractionMatch) {
        const root = extractionMatch[1] ?? extractionMatch[2];
        return knownColumns.has(root) || aliases.has(root);
      }
      return false;
    };
    return canQuery;
  }, [
    chartConfig.with,
    allFields,
    jsonColumns,
    mapColumns,
    columns,
    source,
    knownColumns,
    queriedFields,
  ]);

  const { escapedKeysToFetch, sqlKeyToUiKey } = useMemo(() => {
    // Don't fetch any keys until the column list is loaded,
    // since we need the real column names to escape correctly.
    if (isColumnsLoading) {
      return { escapedKeysToFetch: [], sqlKeyToUiKey: new Map() };
    }

    const sqlKeyToUiKey = new Map<string, string>();
    const escapedKeysToFetch = keysToFetch
      .filter(isFacetValueQueryable)
      .map(key => {
        const sqlKey = toQuotedClickHouseKeyExpression(key, knownColumns);
        sqlKeyToUiKey.set(sqlKey, key);
        return sqlKey;
      });
    return { escapedKeysToFetch, sqlKeyToUiKey };
  }, [isColumnsLoading, keysToFetch, knownColumns, isFacetValueQueryable]);

  const facetsChartConfig = useMemo(
    () =>
      mode === 'all'
        ? { ...chartConfig, dateRange, where: '', filters: [] }
        : { ...chartConfig, dateRange },
    [chartConfig, dateRange, mode],
  );

  const { data: rawFacets, ...rest } = useGetKeyValues(
    {
      chartConfig: facetsChartConfig,
      limit: INITIAL_LOAD_LIMIT,
      keys: escapedKeysToFetch,
      mode,
    },
    { enabled: enabled && !disableValues },
  );

  // Map the (escaped) result keys back to the original UI keys.
  const facets = useMemo<Facet[] | undefined>(
    () =>
      rawFacets?.map(f => ({
        ...f,
        key: sqlKeyToUiKey.get(f.key) ?? f.key,
        value: f.value.map(String),
      })),
    [rawFacets, sqlKeyToUiKey],
  );

  const metadata = useMetadataWithSettings();
  const loadMoreFacetsForKey = useCallback(
    async (key: string): Promise<Facet | undefined> => {
      if (!isFacetValueQueryable(key)) return;
      try {
        const sqlKey = toQuotedClickHouseKeyExpression(key, knownColumns);
        if (mode === 'exact') {
          const strippedFilterState: FilterState = { ...filterState };
          delete strippedFilterState[key];
          if (sqlKey !== key) delete strippedFilterState[sqlKey];
          const newKeyVals = await metadata.getKeyValuesWithMVs({
            chartConfig: {
              ...chartConfig,
              dateRange,
              filters: filtersToQuery(
                escapeFilterStateKeys(strippedFilterState, knownColumns),
                { dateTimeColumns },
              ),
            },
            keys: [sqlKey],
            limit: LOAD_MORE_LOAD_LIMIT,
            disableRowLimit: true,
            source,
          });
          return {
            key,
            value: newKeyVals[0].value?.map(val => val.toString()) ?? [],
          };
        }

        if (
          !tableConnection.databaseName ||
          !tableConnection.tableName ||
          !tableConnection.connectionId
        ) {
          throw new Error(
            'loadMoreFacetsForKey: a source or table connection must be defined',
          );
        }
        const newKeyVals = await metadata.getAllKeyValues({
          databaseName: tableConnection.databaseName,
          tableName: tableConnection.tableName,
          connectionId: tableConnection.connectionId,
          metadataMVs: tableConnection.metadataMVs,
          keyExpressions: [sqlKey],
          maxValuesPerKey: LOAD_MORE_LOAD_LIMIT,
          dateRange,
          timestampValueExpression:
            source?.timestampValueExpression ??
            chartConfig.timestampValueExpression ??
            '',
        });
        return {
          key,
          value:
            newKeyVals.length > 0
              ? (newKeyVals[0].value?.map(val => val.toString()) ?? [])
              : [],
        };
      } catch (error) {
        console.error('failed to fetch more keys', error);
      }
      return undefined;
    },
    [
      mode,
      tableConnection,
      metadata,
      chartConfig,
      dateRange,
      knownColumns,
      source,
      filterState,
      dateTimeColumns,
      isFacetValueQueryable,
    ],
  );

  return {
    ...rest,
    error: allFieldsError ?? rest.error,
    data: {
      keys: allFields,
      keyValues: facets,
      facetKeys: availableFacetKeys,
    },
    queriedFields,
    isLoading: isAllFieldsLoading || rest.isLoading,
    loadMoreFacetsForKey,
    isFacetValueQueryable,
    facetQueryGuardVersion: 'hyperdx-facet-query-guard-v1',
  };
}

export function useFetchFacets({
  chartConfig,
  sourceId,
  tableConnection,
  dateRange,
  mode,
  filterState,
  expandedFacetKeys,
  disableValues,
}: {
  chartConfig: BuilderChartConfigWithDateRange;
  sourceId: string | null;
  /**
   * A table where keys and values are discovered. Used when sourceId
   * is not provided or references a metrics source.
   */
  tableConnection?: TableConnection;
  dateRange: [Date, Date];
  mode: 'all' | 'exact';
  filterState?: FilterState;
  expandedFacetKeys?: readonly string[];
  disableValues?: boolean;
}) {
  const facetsQuery = useFacets({
    chartConfig,
    sourceId,
    tableConnection,
    mode,
    dateRange,
    filterState,
    expandedFacetKeys,
    enabled: true,
    disableValues,
  });

  // `useGetKeyValues` caps the requested key list at the team's configured
  // limit. Keep the most recent result for every key in the current query
  // scope so prioritizing a newly expanded field does not evict values that
  // were already loaded for another field.
  const facetScope = JSON.stringify({
    sourceId,
    tableConnection,
    dateRange: dateRange.map(date => date.toISOString()),
    mode,
    filterState: serializeFilterState(filterState ?? {}),
    chartConfig,
    disableValues,
  });
  const [cachedQueryFacets, setCachedQueryFacets] = useState<{
    scope: string;
    facets: Facet[];
  }>({ scope: facetScope, facets: [] });

  useEffect(() => {
    const latest = facetsQuery.data.keyValues;
    if (latest === undefined || facetsQuery.isPlaceholderData) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCachedQueryFacets(previous => ({
      scope: facetScope,
      facets: mergeLatestFacets(
        previous.scope === facetScope ? previous.facets : [],
        latest,
      ),
    }));
  }, [facetScope, facetsQuery.data.keyValues, facetsQuery.isPlaceholderData]);

  const queryFacets = useMemo(() => {
    const previous =
      cachedQueryFacets.scope === facetScope ? cachedQueryFacets.facets : [];
    const latest = facetsQuery.isPlaceholderData
      ? []
      : (facetsQuery.data.keyValues ?? []);
    if (previous.length === 0 && latest.length === 0) {
      return facetsQuery.data.keyValues === undefined ? undefined : [];
    }
    return mergeLatestFacets(previous, latest);
  }, [cachedQueryFacets, facetScope, facetsQuery]);

  const [extraFacets, setExtraFacets] = useState<Facet[] | null>(null);
  const facets = useMemo<Facet[] | undefined>(() => {
    const base = queryFacets;
    const hasExtras = !!extraFacets && extraFacets.length > 0;

    if (base === undefined && !hasExtras) return undefined;
    if (!hasExtras) return base;
    if (base === undefined) return extraFacets ?? undefined;

    const seenFacets = new Set<string>();
    const output: Facet[] = [];
    for (const facet of base) {
      seenFacets.add(facet.key);
      const extraFacet = extraFacets!.find(ef => ef.key === facet.key);
      if (extraFacet) {
        // Union values: primary is query-scoped and must not be overridden;
        // extras from "Load More" only append (see PR #2329, commit 8938b05ef).
        const seenValues = new Set(facet.value);
        const merged = [...facet.value];
        for (const v of extraFacet.value) {
          if (!seenValues.has(v)) {
            seenValues.add(v);
            merged.push(v);
          }
        }
        output.push({ key: facet.key, value: merged });
      } else {
        output.push(facet);
      }
    }
    for (const extraFacet of extraFacets) {
      if (!seenFacets.has(extraFacet.key)) {
        output.push(extraFacet);
      }
    }
    return output;
  }, [queryFacets, extraFacets]);

  const [extraFacetKeys, setExtraFacetKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadMoreLoadingKeys, setLoadMoreLoadingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const areExtraFacetsLoading = loadMoreLoadingKeys.size > 0;
  const loadMoreFacetsForKey = useCallback(
    async (key: string) => {
      const strategy = facetsQuery.loadMoreFacetsForKey;
      setLoadMoreLoadingKeys(prev =>
        produce(prev, draft => {
          draft.add(key);
        }),
      );
      const newFacet = await strategy(key);
      if (newFacet) {
        setExtraFacets(prev => [...(prev ?? []), newFacet]);
        setExtraFacetKeys(prev =>
          produce(prev, draft => {
            draft.add(key);
          }),
        );
      }
      setLoadMoreLoadingKeys(prev =>
        produce(prev, draft => {
          draft.delete(key);
        }),
      );
    },
    [facetsQuery.loadMoreFacetsForKey],
  );

  // Clear extras when the query scope that produced them changes; otherwise
  // they'd persist against a query they were never fetched for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExtraFacets(null);
    setExtraFacetKeys(new Set());
  }, [facetScope]);

  return {
    ...facetsQuery,
    data: {
      keys: facetsQuery.data.keys,
      keyValues: facets,
      facetKeys: facetsQuery.data.facetKeys,
    },
    loadMoreFacetsForKey,
    areExtraFacetsLoading,
    loadMoreLoadingKeys,
    extraFacetKeys,
  };
}
