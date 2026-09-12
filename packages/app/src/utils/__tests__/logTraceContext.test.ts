import { getLogTraceContext } from '@/utils/logTraceContext';

const traceId = '7316d5a2ab0dc2efa72258f64a98a405';
describe('getLogTraceContext', () => {
  it('prefers configured aliases', () => {
    expect(
      getLogTraceContext({
        __hdx_trace_id: 'custom-id',
        __hdx_span_id: 'custom-span',
        log: JSON.stringify({ trace_id: traceId }),
      }),
    ).toEqual({ traceId: 'custom-id', spanId: 'custom-span' });
  });
  it.each(['json_payload', 'log', '__hdx_body'])(
    'reads conventional trace fields from %s',
    field => {
      expect(
        getLogTraceContext({
          [field]: JSON.stringify({
            trace_id: traceId,
            span_id: '752f898f64922b30',
          }),
        }),
      ).toEqual({ traceId, spanId: '752f898f64922b30' });
    },
  );
  it('normalizes a Google Cloud trace resource', () => {
    expect(
      getLogTraceContext({
        json_payload: {
          'logging.googleapis.com/trace': `projects/staging/traces/${traceId}`,
        },
      }).traceId,
    ).toBe(traceId);
  });
  it('does not invent context from malformed, zero, or nested business values', () => {
    for (const row of [
      { log: '{invalid' },
      { trace_id: '0'.repeat(32) },
      { trace_id: 'not-an-id' },
      { log: { payload: { trace_id: traceId } } },
    ]) {
      expect(getLogTraceContext(row).traceId).toBeUndefined();
    }
  });
});
