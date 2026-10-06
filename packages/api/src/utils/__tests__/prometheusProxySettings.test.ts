import {
  acquirePrometheusQuery,
  parsePrometheusProxySettings,
} from '@/utils/prometheusProxySettings';

describe('Prometheus proxy policy', () => {
  it.each([
    { PROMETHEUS_PROXY_TIMEOUT_MS: 'NaN' },
    { PROMETHEUS_PROXY_TIMEOUT_MS: '19999' },
    { PROMETHEUS_PROXY_TIMEOUT_MS: '600001' },
    { PROMETHEUS_PROXY_MAX_CONCURRENT: '0' },
    { PROMETHEUS_PROXY_MAX_CONCURRENT: '65' },
  ])('rejects invalid operator limits: %j', env => {
    expect(() => parsePrometheusProxySettings(env)).toThrow(
      'Invalid Prometheus proxy configuration.',
    );
  });
  it('preserves the default deadline and accepts an explicit longer budget', () => {
    expect(parsePrometheusProxySettings({})).toEqual({
      timeoutMs: 90000,
      maxConcurrent: 8,
    });
    expect(
      parsePrometheusProxySettings({ PROMETHEUS_PROXY_TIMEOUT_MS: '600000' }),
    ).toEqual({ timeoutMs: 600000, maxConcurrent: 8 });
  });

  it('caps active queries and releases slots once after success, failure or cancellation', () => {
    const releases = Array.from({ length: 8 }, () => acquirePrometheusQuery());
    expect(releases.every(Boolean)).toBe(true);
    expect(acquirePrometheusQuery()).toBeUndefined();
    releases[0]?.();
    releases[0]?.();
    const extra = acquirePrometheusQuery();
    expect(extra).toBeDefined();
    expect(acquirePrometheusQuery()).toBeUndefined();
    releases.forEach(release => release?.());
    extra?.();
  });
});
