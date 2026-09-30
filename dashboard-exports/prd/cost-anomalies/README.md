# Production cost-anomaly dashboards

Import the five `prd-*.json` files through **Dashboards → Import**. They use the existing **Production Metrics / Production Metrics Querier** connection. The logging evidence tables also use **ClickHouse Cloud**, table `prod_logs.fluentLogsAllClusters_v`. Do not import the validation evidence files as dashboards.

| Dashboard | Question answered |
| --- | --- |
| [Cost anomaly overview](prd-cost-anomaly-overview.json) | Which measured driver changed: logging billing bytes, reserved CPU, metric ingestion or sent traffic? |
| [Logging cost investigation](prd-logging-cost-investigation.json) | Which workloads/streams increased, was it more entries or larger records, and what messages/events provide evidence? |
| [Compute cost investigation](prd-compute-cost-investigation.json) | Which zones/instances added reserved CPU capacity? |
| [Monitoring cost investigation](prd-monitoring-cost-investigation.json) | Did metric input, series churn, scrape volume or physical storage grow? |
| [Network cost investigation](prd-network-cost-investigation.json) | Which instances/zones increased sent traffic? |

## How to investigate

1. Start with the overview. Compare percentage **and absolute volume**, then open the corresponding investigation dashboard and copy the same time range. These JSON exports cannot link to dashboard IDs until they have been imported.
2. In Logging, use the project-wide rankings to identify cluster, namespace and container. Select those three filters to load the workload charts and evidence tables. Empty selections intentionally block only the panels requiring them; they do not block project-wide rankings.
3. Move the range end to the suspected incident and expand **Log and Kubernetes event evidence**. Those queries read only the final minute, or a shorter selected range. This is a bounded evidence window, not a whole-incident total. They stop with an error rather than return partial results at their scan/time/memory limits.
4. Correlate repeated messages, volume/entry changes and events with the actual code/configuration change. A chart shows a symptom or contributor; it does not automatically prove the initiating cause.

For example, an `events-worker` loop should raise entry volume and workload byte contribution and expose repeated message prefixes, provided that loop and its logs fall within the retained data. Larger records with steady entry volume would instead prompt investigation of payload/enrichment changes. `stdout` growth alone does not prove a Winston setting changed.

## What the percentages mean

- Default comparison: the latest-hour mean versus the same hour **yesterday**, evaluated at each chart time. Number cards use the selected range's end. The dashboards default to 24 hours and refresh every five minutes.
- Orange above 10% and red above 25% are transparent review thresholds, not statistical anomaly detection or alert rules. A changed traffic schedule can legitimately cross them.
- A zero or absent baseline produces no percentage. New workloads/instances appear separately. Missing telemetry is never substituted with zero.
- Logging's contribution chart is each matched workload's share of **positive measured stored-byte growth**. It excludes unmatched/new workloads and is **not** a percentage of the bill. Top-15 charts can omit smaller contributors, and their membership can change over time.
- Different components use different units and can describe the same underlying activity. Never sum their percentages or present them as invoice shares.

## Measurement details

The existing Stackdriver exporter exposes GCP DELTA metrics as gauges without accumulating them. The queries deliberately do **not** apply `rate()`, `increase()` or a time sum to those gauges. They average observed interval values after workload aggregation, sampled every five minutes over an hour. This is an approximate activity comparison, not an exact daily/monthly integrated byte total. The logging and GCE sent-byte metrics describe native minute intervals; collection delay and missed/repeated observations can affect the displayed means. Genuine VM counters use `rate()`.

GCP workload labels are `cluster_name`, `namespace_name`, `container_name` and `pod_name`. The exporter's `cluster` label identifies where the exporter runs and must not be used to attribute application logging. Queries remove duplicate scrape labels using the maximum for a resource identity before summing; they are not a reconciliation of all source events.

`logging/.../billing/bytes_ingested` is billing-volume telemetry, not currency. Kubernetes `byte_count` is stored-byte telemetry and does not reconcile exactly to that project-wide billing series. The no-workload-identity card exposes attribution gaps. ClickHouse message bytes exclude the GCP envelope; they cannot prove the billable size of Kubernetes labels. See [Google's metric definitions](https://docs.cloud.google.com/monitoring/api/metrics_gcp_i_o).

The repeated-message table groups the first 240 characters, counts entries, and computes entry share over all prefixes in its bounded query window before taking the top 30. Distinct messages with the same prefix are grouped. The Kubernetes event table matches the chosen container name to `deployment_name`; workloads using different names need that predicate adjusted. Event updates and their cumulative `count` are not independent incidents.

## Actual dollars: what to add

**Recommended:** GCP Cloud Billing export → daily service/SKU aggregates → ClickHouse → HyperDX. Use an existing export if available; otherwise enable the export first. This is a proposed addition, not something this dashboard import deploys.

Retain usage date, invoice month, project ID, service ID/name, SKU ID/name, currency, usage amount/unit, cost, credit total and net cost (`cost + credits`). Aggregate credit arrays within each billing row before summing so credit joins do not duplicate cost. Keep invoice-month reporting separate from usage-date reporting. Use detailed export resource fields when available; do not assume billing rows identify every Kubernetes workload.

Refresh an aggregate of the current and previous invoice months daily to capture late-arriving usage and adjustments; periodically reconcile older invoice months too. Retain billing-data freshness alongside every cost panel. This supports:

- Daily/monthly spend by service and SKU, with the same elapsed-period comparison for incomplete months.
- Absolute cost increase and each service's share of the total increase, with credits/discount changes separated from usage changes.
- A financially grounded overview pointing to the existing usage/log evidence dashboards.

Google's [standard export](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/standard-usage) includes cost, credits, service/SKU and project dimensions. [Detailed export](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery) adds supported resource-level detail. Export is delivered regularly but [has no delivery/latency guarantee](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables); it is not real-time billing.

If everything must stay in VM, use a small exporter for those preaggregated costs and let the existing vmagent scrape it. Expose clearly named **gauges** for current/previous-month and yesterday net cost, grouped by project/service/SKU/currency, plus export freshness. Costs can be corrected downward, so they must not be modeled as monotonic counters. Keep billing-date history in BigQuery/ClickHouse rather than creating a new date-labeled time series for every row. Merely adding scrape lines to Stackdriver will not produce the invoice data currently missing from VM.

## Coverage and validation

These are production exports. They cover four available usage drivers, not every GCP product, storage SKU, tracing backend or external vendor. No prices, historical dollar snapshots, or invented billing metrics are embedded. No cloud resources, alerts, dashboards or deployments are changed by creating these files.

See [VALIDATION.md](VALIDATION.md) and its retained query results for the exact checks and remaining limits.
