# Developer debugging review — September 13, 2026

Scope: log expansion, trace correlation, service maps, live refresh, and sharing. Reviewed current code, read staging source metadata, and exercised an isolated local API/MongoDB/ClickHouse/browser stack as a developer. This is a bounded workflow review, not a complete product or production-load audit.

## Findings addressed

| Finding | Impact | Change |
| --- | --- | --- |
| Staging log source references a deleted trace source | Disabled View Trace and blank service map | Prefer the configured trace source; if unavailable, recover exactly one trace source whose logSourceId points back to these logs. Never guess between multiple matches. |
| Navigation requires the log's exact span | A missing span blocks access to other stored spans in the same trace | Open by trace ID while preserving the log timestamp for the lookup window. |
| Inline log expansion has no service map or trace action | Extra drawer navigation during investigation | Add both actions and load map/trace queries only when opened. |
| Unmapped JSON trace context is invisible to correlation | Valid trace IDs in raw log content don't enable navigation | Read conventional trace fields in json_payload and log/body JSON. Explicit configured aliases retain priority. |
| Missing source produces a blank map | Configuration failures look like absent telemetry | Show loading/error/missing-link states and offer a personal trace-source selection. Shared source configuration remains admin-controlled. |
| Table ignores the supplied search query prefix | Live refresh doesn't consistently account for a running results-table query | Forward the prefix into table queries so search request tracking includes them. |

## Recommended next changes

| Priority | Recommendation | Evidence and acceptance criteria |
| --- | --- | --- |
| P0 workflow | Show last successful refresh and newest event age separately | Live mode reflects a refresh policy, not ingestion health. DBSearchPage shows Live Tail and query timing but no explicit last-success/newest-event pair. Simulate a failed refresh and delayed ingestion: retain old rows, label them stale, show retry and the last successful timestamp. |
| P0 workflow | Add “Copy incident link” with a frozen range | DBRowSidePanel currently copies window.location.href, including live-mode state. Generate a separate absolute-range link with isLive=false, source, query, and trace/row context; opening it later must reproduce the same investigation window. Preserve the sender's live session. |
| P1 | Validate source relationships when saving or deleting sources | Staging had a dangling forward link despite a valid reverse link. Warn admins about affected sources and invalid trace/span/timestamp mappings; do not silently select an unrelated source. |
| P1 | Explain trace-data gaps and allow deliberate range expansion | A log trace ID does not guarantee stored spans. Distinguish missing configuration, query failure, no spans, and no client/server relationships. Offer a wider time range explicitly instead of silently launching repeated large scans. |
| P1 | Extend admin-controlled developer navigation | Existing developer settings cover search sections; the full app navigation still exposes several destinations. Let admins hide unused destinations while retaining direct access to useful trace/service-map investigation flows. Keep authorization enforced on the server. |

## Staging configuration finding

Read-only inspection found `Staging-All-Clusters-Logs` (`6a153dd786a5f5d3cc7526f5`) pointing to missing trace source `6a9676b274eda3e465f4d8b8`. The current `Staging-workloads-traces` source (`6aa514ce15ba2e73bd1e292b`) links back to those logs and queries `stgLogs.otel_traces`.

The code recovery handles this case. To repair the stored configuration directly, an admin can edit the logs source in Team Settings → Sources and choose Staging-workloads-traces as its correlated trace source. No cluster or staging database writes were performed for this task. The existence of the screenshot's particular trace in ClickHouse was not verified.

Correlation requires configured source relationships ([ClickStack configuration](https://github.com/ClickHouse/clickhouse-docs/blob/main/docs/use-cases/observability/clickstack/config.md)); sampling controls which spans are recorded/exported ([OpenTelemetry tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/)). UI correlation cannot recreate telemetry that was never stored.

## Verification

- 352 tests passed across 22 suites covering sources, row details, inline trace actions, source error states, trace navigation/breadcrumbs, search queries, and filters. Two older test mocks were updated for current permissions/chart helpers.
- App TypeScript check passed. Root `yarn lint:fix` passed with warnings and no errors.
- Local browser tests as a developer passed: stale-link recovery, inline service map, full-details and inline trace navigation with a missing exact span, JSON-only trace context, manual trace-source selection without shared configuration writes, new log arrivals while a row stays expanded, explicit pause, and resume.
- Visually inspected light and dark service maps. The temporary local services and databases were removed after verification.
- No production-load test, image build/push, deployment, or cluster mutation was performed. Recommendations above are not implemented unless listed under “Findings addressed.”
