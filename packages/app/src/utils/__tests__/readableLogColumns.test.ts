import { readableLogColumns } from '@/utils/readableLogColumns';

describe('readableLogColumns', () => {
  const columns = new Set(['timestamp', 'log', 'log_message', 'log_level']);
  it('uses message, msg and raw text fallbacks without duplicate message columns', () => {
    const select = readableLogColumns(
      'timestamp, log_level, log, log_message',
      columns,
    );
    expect(select.match(/AS Message/g)).toHaveLength(1);
    expect(select).toContain("nullIf(log_message, '')");
    expect(select).toContain("JSONExtractString(log, 'msg')");
    expect(select).toContain("nullIf(log, '')");
    expect(select).toContain("'unknown')");
    expect(select).toContain('AS Level');
  });
  it('preserves explicit admin expressions and other schemas', () => {
    const select = 'Timestamp, SeverityText, Body';
    expect(readableLogColumns(select, new Set(['Body']))).toBe(select);
    expect(
      readableLogColumns("timestamp, concat(log, '!') AS custom", columns),
    ).toBe("timestamp, concat(log, '!') AS custom");
  });
  it('does not refer to absent optional columns', () => {
    const result = readableLogColumns('log', new Set(['log']));
    expect(result).not.toContain('log_message');
    expect(result).not.toContain('log_level');
  });
});
