// Fetch only schema-backed roots. Never interpolate a custom field as SQL.
export function summaryProjection(
  columns: { name: string }[],
  paths: string[],
) {
  const candidates = [
    ...paths,
    'log',
    'log_message',
    'json_payload',
    'Body',
    'body',
    'message',
    'msg',
    'textPayload',
    'log_level',
    'SeverityText',
    'severity',
    'timestamp',
    'Timestamp',
    'trace_id',
    'TraceId',
    'trace.id',
    'logging.googleapis.com/trace',
  ];
  return columns
    .filter(column =>
      candidates.some(
        path => path === column.name || path.startsWith(`${column.name}.`),
      ),
    )
    .map(
      column =>
        `\`${column.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``,
    );
}
