import { filtersToQuery } from '@hyperdx/common-utils/dist/filters';
import { parse } from '@hyperdx/common-utils/dist/queryParser';

import {
  filterQueryPresentation,
  filterQueryText,
} from '@/components/SearchInput/filterQueryText';

describe('filter query text', () => {
  it('preserves arbitrary SQL filters when transferring the editable Lucene text', () => {
    const filter = { type: 'sql' as const, condition: 'length(log) > 10' };
    expect(filterQueryPresentation('error', [filter], 'lucene')).toEqual({
      text: 'error',
      remainingFilters: [filter],
    });
  });
  it('groups selections with OR and preserves an existing OR query', () => {
    const query = filterQueryText(
      'error OR timeout',
      filtersToQuery({
        namespace_name: {
          included: new Set(['api', 'workers']),
          excluded: new Set(['system']),
        },
      }),
      'lucene',
    );
    expect(query).toBe(
      '(error OR timeout) AND\n(namespace_name:"api" OR namespace_name:"workers") AND\n(NOT namespace_name:"system")',
    );
    expect(() => parse(query)).not.toThrow();
  });
  it('renders escaped JSON keys, numeric ranges and quoted values', () => {
    const query = filterQueryText(
      '',
      filtersToQuery({
        "JSONExtractString(log, 'request.id')": {
          included: new Set(['a"b\\c']),
          excluded: new Set(),
        },
        "JSONExtractFloat(log, 'status_code')": {
          included: new Set(),
          excluded: new Set(),
          range: { min: 400, max: 499 },
        },
      }),
      'lucene',
    );
    expect(query).toContain('log.request\\.id:"a\\"b\\\\c"');
    expect(query).toContain('log.status_code:[400 TO 499]');
    expect(() => parse(query)).not.toThrow();
  });
  it('shows SQL selections in SQL mode', () => {
    expect(
      filterQueryText(
        'a = 1 OR b = 2',
        [{ type: 'sql', condition: "level IN ('error')" }],
        'sql',
      ),
    ).toBe("(a = 1 OR b = 2) AND\n(level IN ('error'))");
  });
});
