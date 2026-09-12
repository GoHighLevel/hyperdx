import { getLuceneFields } from '@/queryParser';

describe('getLuceneFields', () => {
  it('extracts fields from existence, ranges, groups and multiline queries', () => {
    expect(
      getLuceneFields(
        'json_payload.trace_id:*\nAND status:[400 TO 599] AND -service:(api OR worker) AND status:500',
      ),
    ).toEqual(['json_payload.trace_id', 'status', 'service']);
  });

  it('preserves escaped paths and ignores bare text and field-like quoted values', () => {
    expect(
      getLuceneFields('"trace_id:foo" AND log.request\\.id:"req:123"'),
    ).toEqual(['log.request\\.id']);
  });

  it('tolerates empty or incomplete queries', () => {
    expect(getLuceneFields('')).toEqual([]);
    expect(getLuceneFields('trace_id:(')).toEqual([]);
  });
});
