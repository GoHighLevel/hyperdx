import {
  resolvePromqlDashboardGranularity,
  resolvePromqlQueryStep,
} from '@/utils/promqlQueryStep';

const end = new Date('2026-09-16T16:53:14.098Z');
const range = (days: number): [Date, Date] => [
  new Date(end.getTime() - days * 86_400_000),
  end,
];

describe('PromQL query resolution', () => {
  it.each([
    [1, '300s'],
    [14, '1800s'],
    [30, '3600s'],
    [90, '21600s'],
  ])('bounds Auto for %i days', (days, expectedStep) => {
    expect(resolvePromqlQueryStep(range(days), 'auto')).toBe(expectedStep);
    expect(resolvePromqlQueryStep(range(days), undefined)).toBe(expectedStep);
    const points = Math.floor((days * 86400) / parseInt(expectedStep)) + 1;
    expect(points).toBeLessThanOrEqual(1001);
  });

  it.each([
    '15 second',
    '30 second',
    '1 hour',
    '2 day',
    '7 day',
    '30 day',
  ] as const)(
    'preserves the explicit interval %s, including intervals missing from the old map',
    interval => {
      const expected = {
        '15 second': '15s',
        '30 second': '30s',
        '1 hour': '3600s',
        '2 day': '172800s',
        '7 day': '604800s',
        '30 day': '2592000s',
      };
      expect(resolvePromqlQueryStep(range(1), interval)).toBe(
        expected[interval],
      );
    },
  );

  it('does not silently coarsen an explicitly requested oversized query', () => {
    expect(() => resolvePromqlQueryStep(range(90), '15 second')).toThrow(
      '518401 points per series',
    );
    expect(() => resolvePromqlQueryStep(range(90), '30 second')).toThrow(
      '259201 points per series',
    );
  });

  it('counts the inclusive end point in its request budget', () => {
    const start = new Date(0);
    expect(
      resolvePromqlQueryStep([start, new Date(10999 * 15000)], '15 second'),
    ).toBe('15s');
    expect(() =>
      resolvePromqlQueryStep([start, new Date(11000 * 15000)], '15 second'),
    ).toThrow('11001 points');
  });

  it('rejects invalid or reversed ranges', () => {
    expect(() => resolvePromqlQueryStep([end, new Date(NaN)], 'auto')).toThrow(
      'Invalid PromQL time range',
    );
    expect(() => resolvePromqlQueryStep([end, new Date(0)], 'auto')).toThrow(
      'Invalid PromQL time range',
    );
  });

  it('allows a single timestamp without dividing by zero', () => {
    expect(resolvePromqlQueryStep([end, end], 'auto')).toBe('15s');
  });
});

describe('dashboard and panel interval precedence', () => {
  it.each(['auto', undefined] as const)(
    'inherits a saved panel interval when the dashboard interval is %s',
    dashboard => {
      expect(resolvePromqlDashboardGranularity(dashboard, '1 hour')).toBe(
        '1 hour',
      );
      expect(resolvePromqlDashboardGranularity(dashboard, 'auto')).toBe('auto');
      expect(resolvePromqlDashboardGranularity(dashboard, undefined)).toBe(
        'auto',
      );
    },
  );

  it('gives an explicit dashboard or fullscreen interval priority', () => {
    expect(resolvePromqlDashboardGranularity('30 second', '1 hour')).toBe(
      '30 second',
    );
    expect(resolvePromqlDashboardGranularity('1 hour', '15 second')).toBe(
      '1 hour',
    );
  });
});
