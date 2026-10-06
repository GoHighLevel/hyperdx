# Production capacity dashboard: recorded metrics

Status: review artifact, not imported into production.

The export at
[`dashboard-exports/prd/prd-gke-node-capacity-demand-2-recorded.json`](../../dashboard-exports/prd/prd-gke-node-capacity-demand-2-recorded.json)
replaces repeated pod/container joins in **GKE node capacity vs demand —
Production - 2** with the `hyperdx_capacity_v1:*` recordings. It targets
existing dashboard `6abfcbe48fd3a6a9e246ae1c`. Import only after the companion
recording deployment and historical backfill have passed the gates below.
Merging this file does not change the live dashboard and requires no application
image build.

## Evidence from 6 October 2026

The tested range was Unix seconds **1783519424–1791295424**, with six-hour
steps. Production was running `2.38.0-custom.58`; its metrics connection already
used the internal Thanos service.

| Query / path                                         | Observed result                            |
| ---------------------------------------------------- | ------------------------------------------ |
| Cluster CPU capacity, workload and warm-up / HyperDX | HTTP 504, `stream timeout`, 120.29 s       |
| Application unschedulable CPU / HyperDX              | HTTP 200, 86.374 s                         |
| Application unschedulable count / direct Thanos      | HTTP 200, 97.95 s                          |
| Servers all-pool CPU headroom / HyperDX              | HTTP 200, 16.706 s                         |
| `vector(1)` at 15-second steps / HyperDX             | HTTP 400, exceeds 11,000 points per series |

A simple direct-VM capacity query returned in 3.42 s, but its first returned
sample was around August 8. This does not establish 90 days of history for every
metric. Retention, available source history, query cost and output-point limits
are separate concerns. Cache state was uncontrolled; these are observations, not
a comparative benchmark. The outer 120-second failure is observed; the precise
interaction with the app's 90-second proxy timeout remains unproven.

## Preserved behavior and deliberate differences

All 24 tiles (23 graphs), filters, layout, node-level drilldown, pool mappings,
and separate application/buffer sections are preserved. Graph legends continue
to use the application's Min / Max / Last display. No new static explanatory
panel replaces a graph. Unknown historical IGM mappings remain visible as
`UNMAPPED IGM ...`; current nodes are not used to relabel vanished nodes.

The expressions query one-minute recordings through `default_rollup(...[2m])`.
This respects live stale markers and prevents a missing recorded node from
remaining visible throughout a coarse six-hour lookback. Native vmalert replay
does not create the same stale markers as live evaluation, so disappearance can
remain visible for up to two minutes; verify those boundaries before cutover. No
raw-query fallback is embedded: it would reintroduce the same expensive 90-day
joins. Do not import the export before its history exists.

The request calculations retain the original regular-plus-active-init upper
bound; they are not exact scheduler effective Pod requests. Backlog CPU remains
regular-container CPU. Recording at one-minute cadence can miss shorter events.
Min/Max/Last summarize returned graph points, not all retained raw samples.
Ninety-day Auto remains six hours; an explicit 90-day/15-second chart still
exceeds the supported point limit. Zoom into a short range for raw detail.

## Dependencies and cutover

1. Merge the companion Helm values for `capacity-recording` and its Argo
   registration, then explicitly approve the new child application's sync. It is
   isolated from existing alerts and has no automatic sync or replay hook.
2. Follow the Helm repository's
   `helm-overrides/gke-platform-prd-usc1/capacity-recording/README.md` for live
   health checks, separately approved bounded historical replay, and coverage
   verification for **all 11 recordings**. Do not fill missing history with
   zero.
3. Export the existing production dashboard for rollback. With approval, import
   this JSON using the existing import flow and verify source resolution points
   to the production Prometheus source, not a staging connection. Keep the
   existing source field values from the baseline export.
4. Compare old and new results at identical timestamps for all clusters and pool
   filters; check node churn, draining/cordoned nodes, init requests, missing
   metrics and application versus buffer backlog. Minute-aligned readings should
   match, allowing only documented sampling and two-minute stale-bound
   differences.
5. Exercise all panels at 1h, 24h, 30d and 90d through the authenticated
   browser. Record request statuses/timings and current screenshots including
   node-level and backlog sections. Require no partial results, timeouts or
   unexplained gaps/zeros. Restore the saved original dashboard if acceptance
   fails.

## Validation status

- All 23 rewritten expressions parse with the deployed VM/vmalert v1.110.0.
- Independent review confirmed tile IDs, pool maps and aggregation semantics
  against the existing export; its six backlog/target recordings preserve the
  original subexpressions.
- All 11 raw recording expressions returned successful, non-partial production
  instant results at timestamp 1791296520. Sequential elapsed time: 14.78 s.
- The companion Helm change contains local rule fixtures for deduplication, node
  eligibility, init-container handling, missing demand, separate backlogs,
  observed zeros and live/replayed disappearance.
- **Not yet verified:** deployed recording health, historical backfill parity,
  rendered new dashboard screenshots or 90-day performance after cutover.
  Production was not modified for this PR. Other heavy dashboards require their
  own aggregates; this export targets the reproduced capacity query path.

Related:
[long-range query resolution](../../agent_docs/promql-range-queries.md).
