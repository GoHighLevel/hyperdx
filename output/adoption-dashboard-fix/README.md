# Production adoption dashboard correction — 17 September 2026

Dashboard `6aa79aa2cc20292fe2beb0af` opened successfully but returned empty usage metrics for the supplied range, `1789631642551`–`1789653242551`.

## Verified cause

All ten SQL panels queried `prod_logs.fluentLogsAllClusters_v`. Its live `SHOW CREATE TABLE` returned a UNION of ServersCluster, WorkersCluster, WebUsersServersCluster and ServersNewCluster tables. It excludes `fluentLogsPlatformCluster`, where production HyperDX runs. A namespace-filtered query against the view returned no rows; the same period in `fluentLogsPlatformCluster` contained 21,424 app records, including 17,361 API-prefixed records and 10,584 records with userEmail. Pod stdout independently confirmed authenticated API logs are being emitted in the expected format. This is a dashboard table-selection defect, not missing usage or a folder-release failure.

## Correction and verification

- Changed all ten SQL panels to `prod_logs.fluentLogsPlatformCluster`; updated the inaccurate missing-coverage note.
- Updated the existing live dashboard through its authenticated API; preserved ID, folder, panels and selected time window. Saved the original in `production-before.json` before mutation and checked for concurrent tile edits.
- Updated `dashboard-exports/prd/hyperdx-adoption-usage.json` and validated it with DashboardTemplateSchema.
- Executed all ten corrected queries successfully: 10 users, 4,959 ClickHouse query requests, 32 search patterns, 881 failed query requests. Failure counts include HTTP errors in ClickHouse proxy requests; they are not an application-availability percentage.
- Verified the metrics and trends in the authenticated production browser. Scrolled through tables to trigger lazy loading and verified their rows. Browser evidence: `production-fixed.png`; query results: `query-validation.json`.
- PromQL requests and live registration totals remain outside this dashboard's defined coverage. No application rebuild, deployment or global ClickHouse view change was required.

The all-clusters view's name is broader than its actual table membership; verify membership before using it for platform-cluster investigations. This fix intentionally queries the platform table directly instead of broadening the shared view used by unrelated dashboards.
