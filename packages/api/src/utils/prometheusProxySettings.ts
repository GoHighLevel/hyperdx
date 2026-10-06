import z from 'zod';

// Operator configuration, never request parameters. Saved connections retain
// their existing upstream, tenant and authentication settings.
export function parsePrometheusProxySettings(env: NodeJS.ProcessEnv) {
  try {
    return z
      .object({
        timeoutMs: z.coerce.number().int().min(20000).max(600000),
        maxConcurrent: z.coerce.number().int().min(1).max(64),
      })
      .parse({
        timeoutMs: env.PROMETHEUS_PROXY_TIMEOUT_MS ?? 90000,
        maxConcurrent: env.PROMETHEUS_PROXY_MAX_CONCURRENT ?? 8,
      });
  } catch {
    throw new Error(
      'Invalid Prometheus proxy configuration. Check timeout and concurrency.',
    );
  }
}

export const prometheusProxySettings = parsePrometheusProxySettings(
  process.env,
);

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
