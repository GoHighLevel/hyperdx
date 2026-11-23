import { z } from 'zod';

const allowedParameters = new Set([
  'source',
  'view',
  'where',
  'whereLanguage',
  'select',
  'filters',
  'orderBy',
  'from',
  'to',
  'isLive',
  'liveInterval',
  'refreshFrequency',
  'mode',
  'denoise',
  'granularity',
  'rowWhere',
  'rowSource',
  'aliasWith',
  'eventRowWhere',
  'eventSource',
  'traceId',
  'traceSourceId',
  'summaryFields',
]);
const localOrigin = 'https://hyperdx.invalid';

export const LogShareTargetSchema = z
  .string()
  .max(32_000)
  .refine(target => {
    if (
      !target.startsWith('/') ||
      target.startsWith('//') ||
      target.includes('\\')
    )
      return false;
    try {
      const url = new URL(target, localOrigin);
      if (
        url.origin !== localOrigin ||
        url.hash ||
        !/^\/(?:search|dashboards\/[a-f0-9]{24})$/.test(url.pathname)
      )
        return false;
      const keys = [...url.searchParams.keys()];
      if (
        new Set(keys).size !== keys.length ||
        keys.some(key => !allowedParameters.has(key))
      )
        return false;
      const source = url.searchParams.get('source');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      return (
        /^[a-f0-9]{24}$/i.test(source ?? '') &&
        /^\d+$/.test(from ?? '') &&
        /^\d+$/.test(to ?? '') &&
        Number.isSafeInteger(Number(from)) &&
        Number.isSafeInteger(Number(to)) &&
        Number(from) <= Number(to) &&
        url.searchParams.get('isLive') === 'false'
      );
    } catch {
      return false;
    }
  }, 'Invalid frozen log search');

/** Keep the existing encoded query state; freeze only time and live mode. */
export function freezeLogShareTarget(
  target: string,
  range: readonly [Date, Date],
) {
  const url = new URL(target, localOrigin);
  if (url.origin !== localOrigin)
    throw new Error('Share target must be internal');
  for (const key of [...url.searchParams.keys()]) {
    if (!allowedParameters.has(key)) url.searchParams.delete(key);
  }
  url.searchParams.set('from', String(range[0].getTime()));
  url.searchParams.set('to', String(range[1].getTime()));
  url.searchParams.set('isLive', 'false');
  url.searchParams.set('view', 'developer');
  return LogShareTargetSchema.parse(`${url.pathname}${url.search}`);
}
