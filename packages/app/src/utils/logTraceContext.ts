function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonemptyId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && !/^0+$/.test(value.trim())
    ? value.trim()
    : undefined;
}

// Configured aliases are authoritative. Fallbacks only inspect conventional
// telemetry containers, not arbitrary nested application payloads.
export function getLogTraceContext(row?: Record<string, unknown> | null): {
  traceId?: string;
  spanId?: string;
} {
  if (!row) return {};
  const configured = nonemptyId(row.__hdx_trace_id);
  if (configured)
    return { traceId: configured, spanId: nonemptyId(row.__hdx_span_id) };
  for (const value of [row, row.json_payload, row.__hdx_body, row.log]) {
    const record = asRecord(value);
    if (!record) continue;
    const raw = nonemptyId(
      record.trace_id ??
        record.TraceId ??
        record['trace.id'] ??
        record['logging.googleapis.com/trace'],
    );
    const traceId = raw?.replace(/^projects\/[^/]+\/traces\//, '');
    if (!traceId || !/^[a-f\d]{32}$/i.test(traceId) || /^0+$/.test(traceId))
      continue;
    const span = nonemptyId(
      record.span_id ?? record.SpanId ?? record['span.id'],
    );
    return {
      traceId,
      spanId: span && /^[a-f\d]{16}$/i.test(span) ? span : undefined,
    };
  }
  return {};
}
