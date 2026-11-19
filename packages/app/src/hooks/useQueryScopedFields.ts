import { useMemo } from 'react';
import {
  chSql,
  ColumnMetaType,
  convertCHDataTypeToJSType,
  JSDataType,
} from '@hyperdx/common-utils/dist/clickhouse';
import type { Field } from '@hyperdx/common-utils/dist/core/metadata';
import { renderChartConfig } from '@hyperdx/common-utils/dist/core/renderChartConfig';
import type {
  BuilderChartConfigWithDateRange,
  TSource,
} from '@hyperdx/common-utils/dist/types';
import { useQuery } from '@tanstack/react-query';

import { getClickhouseClient } from '@/clickhouse';
import { useMetadataWithSettings } from '@/hooks/useMetadata';

/** Discovery is a bounded sample, separate from complete search results. */
export function extractSampledFields(
  rows: Record<string, unknown>[],
  columns: ColumnMetaType[],
): Field[] {
  const fields = new Map<string, Field>();
  const add = (path: string[], type: string) => {
    fields.set(JSON.stringify(path), {
      path,
      type,
      jsType: convertCHDataTypeToJSType(type),
    });
  };
  for (const row of rows) {
    for (const column of columns) {
      const value = row[column.name];
      if (value == null || value === '') continue;
      const jsType = convertCHDataTypeToJSType(column.type);
      if (jsType === JSDataType.Map && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (child != null && child !== '') add([column.name, key], 'String');
        }
      } else if (jsType === JSDataType.JSON && typeof value === 'object') {
        const visit = (node: unknown, path: string[], depth: number) => {
          if (depth > 12 || node == null || node === '') return;
          if (typeof node === 'object' && !Array.isArray(node)) {
            for (const [key, child] of Object.entries(node))
              visit(child, [...path, key], depth + 1);
          } else if (!Array.isArray(node)) {
            add(
              path,
              typeof node === 'number'
                ? 'Float64'
                : typeof node === 'boolean'
                  ? 'Bool'
                  : 'String',
            );
          }
        };
        visit(value, [column.name], 0);
      } else if (jsType === JSDataType.String) add([column.name], column.type);
    }
  }
  return [...fields.values()];
}

export function useQueryScopedFields(
  config: BuilderChartConfigWithDateRange,
  columns: ColumnMetaType[] | undefined,
  enabled: boolean,
  querySettings?: TSource['querySettings'],
) {
  const metadata = useMetadataWithSettings();
  const sampledColumns = useMemo(
    () =>
      (columns ?? []).filter(column => {
        const type = convertCHDataTypeToJSType(column.type);
        return (
          type != null &&
          [JSDataType.String, JSDataType.Map, JSDataType.JSON].includes(type) &&
          !['log', 'raw_log', 'body', 'message', '_hdx_body'].includes(
            column.name.toLowerCase(),
          )
        );
      }),
    [columns],
  );
  const sampleConfig = {
    ...config,
    select: sampledColumns
      .map(column => chSql`${{ Identifier: column.name }}`.sql)
      .join(', '),
    groupBy: undefined,
    orderBy: undefined,
    limit: { limit: 200 },
  };
  return useQuery({
    queryKey: [
      'query-scoped-fields',
      sampleConfig,
      sampledColumns,
      querySettings,
    ],
    enabled: enabled && sampledColumns.length > 0,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const query = await renderChartConfig(
        sampleConfig,
        metadata,
        querySettings,
      );
      const result = await getClickhouseClient({
        queryTimeout: 5,
      }).query<'JSONEachRow'>({
        query: query.sql,
        query_params: query.params,
        connectionId: config.connection,
        abort_signal: signal,
        format: 'JSONEachRow',
        clickhouse_settings: {
          max_rows_to_read: '200000',
          read_overflow_mode: 'break',
          max_execution_time: 5,
          timeout_overflow_mode: 'break',
          max_threads: 2,
          max_block_size: '64',
        },
      });
      return extractSampledFields(
        await result.json<Record<string, unknown>>(),
        sampledColumns,
      );
    },
  });
}
