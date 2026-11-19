import {
  resolveField,
  resolveMessage,
  SUMMARY_FIELDS,
} from '@/components/LogSummaryDemo/resolveFields';

describe('summary field resolution', () => {
  it('prefers message, then msg, then the original log', () => {
    expect(
      resolveMessage({ log: { message: 'first', msg: 'second' } })?.text,
    ).toBe('first');
    expect(resolveMessage({ log: '{"message":"","msg":"second"}' })).toEqual({
      text: 'second',
      path: 'log.msg',
    });
    expect(resolveMessage({ log: 'original plain text' })).toEqual({
      text: 'original plain text',
      path: 'log',
    });
  });

  it('supports dotted keys, nested objects and flattened payload maps', () => {
    expect(resolveMessage({ 'log.message': 'flat' })?.text).toBe('flat');
    expect(
      resolveField({ json_payload: { 'httpRequest.status': '201' } }, [
        'json_payload.httpRequest.status',
      ])?.text,
    ).toBe('201');
    expect(
      resolveField({ resource: { labels: { container_name: 'api' } } }, [
        'resource.labels.container_name',
      ])?.text,
    ).toBe('api');
  });

  it('skips blank values but preserves zero and false', () => {
    expect(
      resolveField({ first: '  ', second: 0 }, ['first', 'second'])?.text,
    ).toBe('0');
    expect(resolveField({ value: false }, ['value'])?.text).toBe('false');
  });

  it('keeps deployment, container and pod identities separate', () => {
    const row = {
      deployment_name: '',
      container_name: 'api',
      pod_name: 'api-123',
    };
    const values = SUMMARY_FIELDS.slice(0, 3).map(
      field => resolveField(row, field.paths)?.text,
    );
    expect(values).toEqual([undefined, 'api', 'api-123']);
    expect(SUMMARY_FIELDS.some(field => field.id === 'resource')).toBe(false);
  });

  it('prefers node identity and supports host and OTel node fields', () => {
    const paths = SUMMARY_FIELDS.find(field => field.id === 'node_name')!.paths;
    expect(
      resolveField({ node_name: 'node-01', host: 'other' }, paths)?.text,
    ).toBe('node-01');
    expect(resolveField({ node_name: '', host: 'node-02' }, paths)).toEqual({
      text: 'node-02',
      path: 'host',
    });
    expect(
      resolveField(
        { ResourceAttributes: { 'k8s.node.name': 'node-03' } },
        paths,
      )?.text,
    ).toBe('node-03');
  });

  it('preserves raw malformed JSON and does not invent missing data', () => {
    expect(resolveMessage({ log: '{invalid JSON' })?.text).toBe(
      '{invalid JSON',
    );
    expect(resolveMessage({ log: { request_id: 'abc' } })?.text).toBe(
      '{"request_id":"abc"}',
    );
    expect(
      resolveField({ cluster_name: 'staging' }, ['deployment_name']),
    ).toBeUndefined();
  });

  it('does not read inherited properties or mutate source data', () => {
    const row = { log: '{"msg":"hello"}' };
    expect(resolveField(row, ['constructor.name'])).toBeUndefined();
    resolveMessage(row);
    expect(row.log).toBe('{"msg":"hello"}');
  });
});
