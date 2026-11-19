import { resolveSeverity } from '@/components/LogSummaryDemo/resolveSeverity';

describe('summary severity', () => {
  it.each(['warn', 'debug'])('recognizes collector %s output', level => {
    expect(
      resolveSeverity({
        log_level: 'unknown',
        log: `2026-09-16T06:26:54.743Z\t${level}\tinternal/collector.go:20 Scrape failed`,
      }),
    ).toEqual({ level, inferred: true });
  });

  it('prefers valid structured severity over message text', () => {
    expect(
      resolveSeverity({
        SeverityText: ' ERROR ',
        log: '2026-09-16T06:26:54.743Z debug Request failed',
      }),
    ).toEqual({ level: 'error', inferred: false });
  });

  it('checks nested levels when a projected level is unknown', () => {
    expect(
      resolveSeverity({
        log_level: 'unknown',
        log: '{"level":"warn","msg":"slow"}',
      }),
    ).toEqual({ level: 'warn', inferred: false });
    expect(
      resolveSeverity(
        { custom_level: 'fatal', log_level: 'info' },
        'custom_level',
      ),
    ).toEqual({ level: 'fatal', inferred: false });
  });

  it.each([
    'Request finished without error',
    '2026-09-16T06:26:54.743Z Request mentions warn later',
    '{"message":"debug inside the payload"}',
    '',
  ])('leaves unclassified messages unknown: %s', log => {
    expect(resolveSeverity({ log })).toEqual({
      level: 'unknown',
      inferred: false,
    });
  });

  it('supports explicit timezone offsets and keeps the original row intact', () => {
    const row = { log: '2026-09-16T11:56:54+05:30 WARN Scrape failed' };
    expect(resolveSeverity(row)).toEqual({ level: 'warn', inferred: true });
    expect(row.log).toBe('2026-09-16T11:56:54+05:30 WARN Scrape failed');
  });
});
