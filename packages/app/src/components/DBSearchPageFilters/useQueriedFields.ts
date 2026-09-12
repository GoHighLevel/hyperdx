import { TableConnection } from '@hyperdx/common-utils/dist/core/metadata';
import {
  CustomSchemaSQLSerializerV2,
  getLuceneFields,
} from '@hyperdx/common-utils/dist/queryParser';
import { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';
import { useQuery } from '@tanstack/react-query';

import { useMetadataWithSettings } from '@/hooks/useMetadata';

const EMPTY_FIELDS: string[] = [];

/** Resolve explicit query fields through the same schema rules as Lucene search. */
export function useQueriedFields(
  chartConfig: BuilderChartConfigWithDateRange,
  table: TableConnection,
  enabled: boolean,
) {
  const metadata = useMetadataWithSettings();
  const fields =
    chartConfig.whereLanguage === 'lucene'
      ? getLuceneFields(chartConfig.where ?? '')
      : EMPTY_FIELDS;
  const aliases = chartConfig.with?.map(clause => clause.name) ?? [];
  return useQuery({
    queryKey: ['queried-filter-fields', table, fields, aliases],
    enabled: enabled && fields.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const serializer = new CustomSchemaSQLSerializerV2({
        metadata,
        ...table,
      });
      const resolved = await Promise.all(
        fields.map(async field => {
          if (aliases.includes(field)) return field;
          const column = await serializer.getColumnForField(field, {});
          if (!column.found || column.isArray) return undefined;
          const expression = column.columnJSON?.string ?? column.column;
          // Match discovery's canonical spelling without unquoting special names.
          return expression?.replace(/`([a-zA-Z_][a-zA-Z_0-9]*)`/g, '$1');
        }),
      );
      return [...new Set(resolved.filter((field): field is string => !!field))];
    },
    select: data => (fields.length ? data : EMPTY_FIELDS),
  });
}
