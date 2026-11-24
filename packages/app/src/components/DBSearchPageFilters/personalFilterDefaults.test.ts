import { sharedFilterFieldsForColumns } from './personalFilterDefaults';

describe('GKE shared sidebar fields', () => {
  const columns = new Set([
    'deployment_name',
    'pod_name',
    'log_level',
    'json_payload',
    'labels',
  ]);
  it('keeps only workload, pod and severity as shared fields', () => {
    expect(sharedFilterFieldsForColumns('log', columns)).toEqual([
      'deployment_name',
      'pod_name',
      'log_level',
    ]);
  });
  it('preserves non-GKE and non-log shared filter behavior', () => {
    expect(
      sharedFilterFieldsForColumns(
        'log',
        new Set(['service_name', 'json_payload']),
      ),
    ).toBeUndefined();
    expect(sharedFilterFieldsForColumns('trace', columns)).toBeUndefined();
    expect(sharedFilterFieldsForColumns(undefined, new Set())).toEqual([]);
    expect(sharedFilterFieldsForColumns('log', undefined)).toEqual([]);
  });
});
