# HyperDX dashboard exports

Import files from the matching environment folder through **Dashboards → Import**.
These are HyperDX JSON exports, not Grafana JSON. Use the current custom HyperDX
build; the full logging view requires `2.38.0-custom.10` or later.

Production service debugging is now split into **P0 overview**, **Capacity and
startup**, and **Request investigation**. Start with the
[production debugging guide](prd/DEBUGGING.md) for live links, incident replay,
filter scope and the panel-consolidation map. The former full export is archived
under `prd/archive/`.

Production service debugging is now split into **P0 overview**, **Capacity and
startup**, and **Request investigation**. Start with the
[production debugging guide](prd/DEBUGGING.md) for live links, incident replay,
filter scope and the panel-consolidation map. The former full export is archived
under `prd/archive/`.

| Dashboard                           | Staging                                                    | Production                                                 |
| --- | --- | --- |
| Full logging view                   | [JSON](stg/logging-dashboard-default.json)                 | [JSON](prd/logging-dashboard-default.json)                 |
| Service debugging / P0 overview     | [JSON](stg/stg-service-debugging.json)                     | [JSON](prd/prd-service-debugging.json)                     |
| Capacity and startup                | Included in staging service debugging                     | [JSON](prd/prd-capacity-startup.json)                       |
| Request investigation               | Included in staging service debugging                     | [JSON](prd/prd-request-investigation.json)                  |
| Kubernetes deployment resources     | [JSON](stg/stg-resource-monitoring-deployment-promql.json) | [JSON](prd/prd-resource-monitoring-deployment-promql.json) |
| HyperDX adoption and usage | [JSON](stg/hyperdx-adoption-usage.json) | [JSON](prd/hyperdx-adoption-usage.json) |

## Environment mapping

| Reference | Staging | Production |
| --- | --- | --- |
| HyperDX | `hyperdx.servers.stg.msgsndr.net` | `hyperdx.platform.prd.msgsndr.net` |
| Log source | `Staging-All-Clusters-Logs` | `Production All Clusters` |
| Log connection | `Clickhouse-Staging` | `ClickHouse Cloud` |
| Metrics source | `Staging Metrics` | `Production Metrics` |
| Metrics connection | `Staging Metrics Querier` | `Production Metrics Querier` |

Imports reference existing source/connection names and do not contain credentials.
Confirm these mappings in the import dialog. Production uses
`prod_logs.fluentLogsAllClusters_v` and the `log` body column.

The four staging files were moved without changing their contents. Production
dashboard titles and tags identify Production. Production debugging and resource
dashboards default to `store-api`, namespace `default`, cluster
`servers-usc1-prd-cluster`, with a rolling 15-minute window and 30-second refresh.
The full logging view retains its rolling 15-minute window and 10-second refresh.
For resource node panels, select Node and Node IP after selecting the workload;
these are intentionally not pinned to an ephemeral production node.

The production service-debugging dashboard includes an expanded HPA section:
min/max/desired/current replicas, replica trends, and current versus configured
target metrics. HPA selection follows its Deployment scale-target reference.
Metric legends retain their target type: `utilization` is percent, while
`average` and `value` use the metric's native units. Workload health compares
desired/running/ready/available pods and shows per-pod restarts without expanding
Infrastructure details. Running pods are not necessarily ready.

Log tables explicitly default to `timestamp DESC`. Header clicks still perform
database sorting; sorting a non-time column disables incremental time-window
fetching and uses the complete selected time range. A 200-row page limit does
not cap rows scanned. For focused sorting, pause Live and narrow the time range
and workload/pod filters. This export does not implement client-side sorting or
change full-range query semantics. A bounded two-minute comparison returned only
10 logs: timestamp sort took 6.90s and pod sort 1.85s server-side. This single
comparison did not reproduce a sort-specific regression and does not establish
a performance improvement; browser profiling and representative slow queries
are still needed to identify the full cause of the reported delay.

## Initial export validation — 2026-09-14, before the dashboard split

- All eight files passed the current `DashboardTemplateSchema` used by the
  importer. Production source and connection names match the live configuration.
- All 40 production debugging PromQL queries returned series using the default
  workload. All 61 resource PromQL queries executed successfully; 47 returned
  series with a sampled workload node. The remaining 14 node-exporter / `eth0`
  network panels had no matching series. They require the corresponding metrics.
- Production has no configured stored-span source. Its two trace investigation
  tabs show logs with trace IDs and error logs with trace IDs. They do not replace
  a span waterfall, span-duration analysis, or service topology. Staging keeps
  its existing span panels.
- Adoption SQL passed ClickHouse query planning. No HyperDX app logs were found
  in the five-minute production sample. A broader one-hour discovery query hit
  its read limit, so historical coverage is unverified. Verify collection from
  `hyperdx-platform-prd` before using the report for management. Missing input
  produces unavailable metrics rather than zero-user claims. Registered-user
  totals remain omitted. Query counts include ClickHouse background refreshes
  and retries, and exclude PromQL requests.
- Validation used read-only queries, short metric windows and bounded log reads.
  That initial export-validation pass did not import dashboards into a live team.
  Browser rendering and full-range usage-query execution were not tested.

## Production capacity delivery — 2026-09-14, before the dashboard split

The capacity section described below has since moved to
`prd/prd-capacity-startup.json`. The current layout, live links and validation are
documented in [Production debugging](prd/DEBUGGING.md).

The production service-debugging export and existing live dashboard
`6aa7a14a466e0dad1781775b` now include **Capacity delivery**:

- Desired, created, scheduled, Running pods, running application containers,
  Ready and Available capacity on one chart.
- Pending versus unscheduled pods, application waiting reasons, oldest pending
  age, and hosting nodes registered within the last 15 minutes.
- Gateway RPM over a rolling 2-minute window and application restarts over 5 minutes.
- An incident replay link and Cloud Logging links to scheduling, image-pull
  and liveness-restart evidence. The exact image-pull duration is event evidence,
  not a metric calculated by this dashboard.

Cluster / Namespace / Deployment scope the section; Pod, API route, severity and
trace filters do not narrow it. Application container names are matched to the
selected deployment names. Pod state counts use ReplicaSet ownership, remove
terminating/terminal pods, and deduplicate scrape series. The existing Workload
health pod overview now uses the same counting. Sparse waiting/error series stay
unavailable; Running does not imply Ready. Pending age includes all elapsed time
since creation, not only scheduling or downloading.

[Replay the contacts incident in HyperDX](https://hyperdx.platform.prd.msgsndr.net/dashboards/6aa7a14a466e0dad1781775b?granularity=1+minute&filters=%255B%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522cluster%2522%252C%2522values%2522%253A%255B%2522servers-usc1-prd-cluster%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522namespace%2522%252C%2522values%2522%253A%255B%2522default%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522deployment%2522%252C%2522values%2522%253A%255B%2522contacts-get-internal-api%2522%255D%257D%255D&from=1789224900000&to=1789231800000&expanded=capacity-delivery&collapsed=health%2Cautoscaling%2Cincident%2Clogs%2Ctraces%2Cinfrastructure%2Cgateway-triage%2Cendpoint-detail).

Seven new queries and the revised overview passed against both the incident and
a healthy `store-api` sample; 18 incident capacity values matched the RCA.
The export passed `DashboardTemplateSchema`; the live update passed the deployed
`DashboardSchema`. Read-back verified the eight added tiles and preservation of
other dashboard fields, including saved filters/time settings. The export keeps
its rolling 15-minute / 30-second refresh defaults. No cluster resources changed.
Browser rendering remains unverified because the automation profile was occupied.
