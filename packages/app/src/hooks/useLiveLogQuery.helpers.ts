import { classifyTimestampType } from '@hyperdx/common-utils/dist/core/utils';
import { isBuilderChartConfig } from '@hyperdx/common-utils/dist/guards';
import type { ChartConfigWithOptTimestamp } from '@hyperdx/common-utils/dist/types';

import type useOffsetPaginatedQuery from './useOffsetPaginatedQuery';

type Data = NonNullable<ReturnType<typeof useOffsetPaginatedQuery>['data']>;

export function rowKey(row: Record<string, unknown>) {
  return JSON.stringify(row, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return value;
  });
}

export function sortChronologically(
  rows: Record<string, unknown>[],
  data: Data,
  config: ChartConfigWithOptTimestamp,
) {
  const preciseColumns = data.meta
    .flatMap(column => {
      const timestamp = classifyTimestampType(column.type);
      return timestamp && timestamp.kind !== 'date'
        ? [{ name: column.name, precision: timestamp.precision }]
        : [];
    })
    .sort((a, b) => b.precision - a.precision);
  const projectedTimestamp = preciseColumns.find(column =>
    column.name.startsWith('__hdx_timestamp_value_'),
  );
  const column =
    projectedTimestamp?.name ??
    (rows.some(row => row.__hdx_timestamp != null)
      ? '__hdx_timestamp'
      : undefined) ??
    (isBuilderChartConfig(config)
      ? config.timestampValueExpression
      : undefined) ??
    preciseColumns[0]?.name;
  if (!column) return rows;
  // ClickHouse serializes a timestamp column in one consistent format. Compare
  // those strings directly: Date conversion would erase sub-millisecond order.
  return rows.sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (left == null || right == null) return 0;
    if (typeof left === 'number' && typeof right === 'number')
      return left - right;
    const first = String(left);
    const second = String(right);
    return first < second ? -1 : first > second ? 1 : 0;
  });
}
