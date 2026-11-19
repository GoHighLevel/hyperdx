# Validation — 16 September 2026

## Passed

- All five JSONs pass the fork's `DashboardTemplateSchema`, including panel configurations, filters and containers. No panel configuration properties are stripped by parsing.
- All **45 PromQL panels** returned nonempty results from the existing production querier, with `status=success` and `isPartial=false`. Revised top-15 queries were rechecked. The shared queries were executed once and reused for identical panels. Numeric results, exact queries, evaluation timestamps and VM execution statistics are in [validation-results.json](evidence/validation-results.json).
- Three representative **24-hour range queries at the configured one-hour step** succeeded: logging current/baseline (50 points), workload ranking (375 points across 28 changing top-15 members), and VM ingestion by cluster (175 points). See [range-validation.json](evidence/range-validation.json). A top-15-at-each-time ranking may have more than 15 distinct series across a day; panels allow up to 100 historical series.
- All three logging SQL queries passed **EXPLAIN PLAN** on the real ClickHouse connection. See [sql-validation.json](evidence/sql-validation.json).
- All three logging SQL queries executed successfully for one minute of `contacts-get-internal-api`, namespace `default`, cluster `servers-usc1-prd-cluster`: 30 repeated-prefix rows, 100 application-log rows, and 100 event rows. No raw customer messages were retained in the validation artifacts. See [sql-execution.json](evidence/sql-execution.json) for exact time/filter scope and read statistics.

The repeated-prefix query read about 2.79 million rows / 152 MB; the application-log query about 1.34 million rows / 102 MB; the event query about 289,000 rows / 252 MB. Server elapsed times were approximately 1.54s, 0.84s and 2.10s respectively. These are measured query executions, not UI load-time guarantees. The exported SQL bounds evidence to one minute and fails rather than truncates when its read/time/memory limits are exceeded.

The SQL validation supplied a one-minute range. The initial template had a 15-minute ceiling; the final ceiling was reduced to one minute, which produces the same effective time predicate for the tested inputs. Final queries remain in the dashboard JSON, with literal filter/time bindings recorded in the execution evidence.

## Source findings

The production query route was the existing Kubernetes service proxy for `thanos-query-frontend-platform-prd:9090`, namespace `victoriametrics-platform-prd`, context `gke_highlevel-backend_us-central1_gke-platform-prd-usc1`. Only read queries were made. ClickHouse connection credentials stayed inside the existing HyperDX application process environment/MongoDB connection; they were not copied into the exports.

The metric-name discovery returned Cloud Logging billing-byte metrics, application-specific AI cost counters and some Kubecost usage metrics. It did not identify a GCP invoice/net-cost metric. A targeted query for common node/PV hourly cost and allocation series returned none. This is a bounded discovery result, not proof that no financial data exists anywhere in the organization. Discovery responses are retained alongside the other [evidence](evidence/).

Logging billing bytes returned a prior-day baseline, but the same metric at the instant seven days earlier returned no series. Therefore these exports compare with yesterday and do not invent a weekly baseline. The recently added metrics do not backfill June; historical financial reporting still needs the billing data discussed in the README.

## Not performed

- No dashboard was imported or published, and no browser/UI rendering or filter-dropdown interaction was tested; the request was for JSON files.
- The importer schema was validated locally, not a full authenticated import transaction. The import must resolve `Production Metrics`, `Production Metrics Querier` and `ClickHouse Cloud` to the existing production sources/connections.
- No full 30-day query/load test or exhaustive range test of every tile was run. Actual cost reconciliation and automated causal attribution were not possible from the discovered metrics.
- No application code, runtime, deployment, collection configuration or billing-export setup was changed. Application unit/E2E suites and restarts were unnecessary for these export/documentation files; formatting and schema checks were scoped to the new files.
