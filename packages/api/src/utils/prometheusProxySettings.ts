import z from 'zod';

const httpUrl = z
  .string()
  .url()
  .refine(value => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.hash;
  });

// Operator configuration, never request parameters. Match the complete saved
// connection URL so a tenant/auth query parameter cannot accidentally be lost.
export function parsePrometheusProxySettings(env: NodeJS.ProcessEnv) {
  try {
    return z
      .object({
        timeoutMs: z.coerce.number().int().min(20000).max(600000),
        maxConcurrent: z.coerce.number().int().min(1).max(64),
        upstreams: z.record(httpUrl, httpUrl).refine(mapping =>
          Object.entries(mapping).every(([source, target]) => {
            const from = new URL(source);
            const to = new URL(target);
            return (
              from.username === to.username &&
              from.password === to.password &&
              [...new Set(from.searchParams.keys())].every(
                key =>
                  JSON.stringify(from.searchParams.getAll(key)) ===
                  JSON.stringify(to.searchParams.getAll(key)),
              )
            );
          }),
        ),
      })
      .parse({
        timeoutMs: env.PROMETHEUS_PROXY_TIMEOUT_MS ?? 90000,
        maxConcurrent: env.PROMETHEUS_PROXY_MAX_CONCURRENT ?? 8,
        upstreams: JSON.parse(env.PROMETHEUS_UPSTREAM_URL_MAP ?? '{}'),
      });
  } catch {
    // Config validation errors can include credentials embedded in URLs.
    throw new Error(
      'Invalid Prometheus proxy configuration. Check timeout, concurrency and upstream URL map.',
    );
  }
}

export const prometheusProxySettings = parsePrometheusProxySettings(
  process.env,
);

export function resolvePrometheusHost(host: string): string {
  return Object.hasOwn(prometheusProxySettings.upstreams, host)
    ? prometheusProxySettings.upstreams[host]
    : host;
}

// Bound the whole API process, including aliases and multiple connections to
// the same cluster. No server queue: browser admission happens before HTTP.
let active = 0;
export function acquirePrometheusQuery(): (() => void) | undefined {
  if (active >= prometheusProxySettings.maxConcurrent) return undefined;
  active++;
  let released = false;
  return () => {
    if (!released) active--;
    released = true;
  };
}
