import {
  acquirePrometheusQuery,
  parsePrometheusProxySettings,
  prometheusProxySettings,
  resolvePrometheusHost,
} from '@/utils/prometheusProxySettings';

describe('Prometheus proxy policy', () => {
  it.each([
    { 'http://source/?extra_label=tenant:a': 'http://target/' },
    { 'http://user:secret@source/': 'http://target/' },
    {
      'http://source/?extra_label=tenant:a':
        'http://target/?extra_label=tenant:b',
    },
  ])(
    'rejects an override that drops or changes source isolation/authentication',
    upstreams => {
      expect(() =>
        parsePrometheusProxySettings({
          PROMETHEUS_UPSTREAM_URL_MAP: JSON.stringify(upstreams),
        }),
      ).toThrow('Invalid Prometheus proxy configuration.');
    },
  );
  it('validates limits without exposing URL credentials', () => {
    expect(() =>
      parsePrometheusProxySettings({
        PROMETHEUS_PROXY_TIMEOUT_MS: 'NaN',
        PROMETHEUS_UPSTREAM_URL_MAP: '{secret',
      }),
    ).toThrow('Invalid Prometheus proxy configuration.');
    expect(() =>
      parsePrometheusProxySettings({
        PROMETHEUS_UPSTREAM_URL_MAP: '{"http://old":"file:///secret"}',
      }),
    ).toThrow('Invalid Prometheus proxy configuration.');
    expect(parsePrometheusProxySettings({})).toMatchObject({
      timeoutMs: 90000,
      maxConcurrent: 8,
    });
  });

  it('only remaps the exact saved URL, including its tenant parameters', () => {
    const source = 'http://thanos/?extra_label=team:a';
    prometheusProxySettings.upstreams[source] =
      'http://vm/select/100/prometheus?extra_label=team:a&deny_partial_response=1';
    expect(resolvePrometheusHost(source)).toContain('/select/100/prometheus');
    expect(resolvePrometheusHost('http://thanos/?extra_label=team:b')).toBe(
      'http://thanos/?extra_label=team:b',
    );
    expect(resolvePrometheusHost('http://thanos/')).toBe('http://thanos/');
    delete prometheusProxySettings.upstreams[source];
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
