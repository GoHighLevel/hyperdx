import { resolveField, resolveMessage } from './resolveFields';

function recognizedLevel(value: string | undefined) {
  const level = value?.trim().toLowerCase();
  return level &&
    /^(trace|verbose|debug|info|information|notice|ok|warn|warning|error|err|fatal|critical|crit|alert|emergency|emerg)$/.test(
      level,
    )
    ? level
    : undefined;
}

export function resolveSeverity(row: object, levelColumn?: string) {
  for (const path of [
    levelColumn,
    'log_level',
    'SeverityText',
    'severity',
    'log.level',
    'log.severity',
    'json_payload.level',
    'json_payload.severity',
  ]) {
    if (!path) continue;
    const level = recognizedLevel(resolveField(row, [path])?.text);
    if (level) return { level, inferred: false };
  }

  // OTel/Zap console output: RFC3339 timestamp, then a severity token.
  // Do not classify a message just because it mentions an error or warning.
  const message = resolveMessage(row)?.text;
  const match = message?.match(
    /^\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s+([a-z]+)\s/i,
  );
  const level = recognizedLevel(match?.[1]);
  return level
    ? { level, inferred: true }
    : { level: 'unknown', inferred: false };
}
