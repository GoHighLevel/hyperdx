import { freezeLogShareTarget, LogShareTargetSchema } from '@/logShare';

const source = '6aa77741acd7321c4deda7ba';
it('freezes the search without changing encoded Lucene, filters or selected columns', () => {
  const input = `/search?source=${source}&where=message%253A%2522hello%2520world%2522&select=timestamp%252Clog&isLive=true`;
  const target = freezeLogShareTarget(input, [new Date(100), new Date(200)]);
  const params = new URL(target, 'http://local.invalid').searchParams;
  expect(params.get('where')).toBe('message%3A%22hello%20world%22');
  expect(params.get('select')).toBe('timestamp%2Clog');
  expect(params.get('from')).toBe('100');
  expect(params.get('to')).toBe('200');
  expect(params.get('isLive')).toBe('false');
  expect(params.get('view')).toBe('developer');
  expect(LogShareTargetSchema.parse(target)).toBe(target);
});

it.each([
  'https://evil.example/search',
  '//evil.example/search',
  '/login',
  '/search?source=bad',
  `/search?source=${source}&from=200&to=100&isLive=false`,
  `/search?source=${source}&from=1&to=2&isLive=true`,
])('rejects unsafe or unreproducible share target %s', target => {
  expect(LogShareTargetSchema.safeParse(target).success).toBe(false);
});

it('rejects duplicate parameters, credentials and unknown redirect parameters', () => {
  const base = `/search?source=${source}&from=1&to=2&isLive=false`;
  for (const suffix of [
    '&source=' + source,
    '&token=secret',
    '&redirect=https://evil.example',
  ])
    expect(LogShareTargetSchema.safeParse(base + suffix).success).toBe(false);
});
