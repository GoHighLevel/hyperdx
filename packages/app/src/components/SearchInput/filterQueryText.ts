import { filtersToQuery, parseQuery } from '@hyperdx/common-utils/dist/filters';
import type { Filter } from '@hyperdx/common-utils/dist/types';

import { filterKeyPath } from '@/components/DBSearchPageFilters/utils';
import { formatColumnEquals } from '@/utils';

/** A copyable query matching the SQL selections, including literal dotted JSON keys. */
export function filterQueryText(
  where: string,
  filters: Filter[],
  language: 'sql' | 'lucene',
) {
  return filterQueryPresentation(where, filters, language).text;
}

export function filterQueryPresentation(
  where: string,
  filters: Filter[],
  language: 'sql' | 'lucene',
) {
  const remainingFilters: Filter[] = [];
  const clauses = filters.flatMap(filter => {
    if (
      filter.type === 'sql_ast' ||
      (language === 'sql' && filter.type !== 'sql')
    ) {
      remainingFilters.push(filter);
      return [];
    }
    if (language === 'sql') return [filter.condition];
    if (filter.type === 'lucene') return [filter.condition];
    const state = parseQuery([filter]).filters;
    // Only transfer expressions our sidebar can round-trip losslessly.
    // Arbitrary saved SQL predicates must remain active when editing the text.
    const roundTrip = filtersToQuery(state);
    if (
      roundTrip.length !== 1 ||
      !('condition' in roundTrip[0]) ||
      roundTrip[0].condition !== filter.condition
    ) {
      remainingFilters.push(filter);
      return [];
    }
    return Object.entries(state).flatMap(([key, values]) => {
      const field = filterKeyPath(key)
        .map(part => part.replace(/([\\.+!():^[\]"{}~*?\s/])/g, '\\$1'))
        .join('.');
      const include = [...values.included].map(value =>
        formatColumnEquals(field, String(value), false),
      );
      const exclude = [...values.excluded].map(
        value => `NOT ${formatColumnEquals(field, String(value), false)}`,
      );
      return [
        ...(include.length ? [include.join(' OR ')] : []),
        ...exclude,
        ...(values.range
          ? [`${field}:[${values.range.min} TO ${values.range.max}]`]
          : []),
      ];
    });
  });
  return {
    text: clauses.length
      ? [where, ...clauses]
          .filter(Boolean)
          .map(part => `(${part})`)
          .join(' AND\n')
      : where,
    remainingFilters,
  };
}
