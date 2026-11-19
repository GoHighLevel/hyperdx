# Production debugging workflow

Start with impact, then follow the evidence into capacity or request behavior.
The original 54-tile dashboard is now a 41-tile, three-dashboard workflow. These counts include navigation and guidance tiles.

| Dashboard | Use it to answer | Content |
| --- | --- | --- |
| [01 · P0 overview](https://hyperdx.platform.prd.msgsndr.net/dashboards/6aa7af64466e0dad178178c4)           | Is the service failing, and what changed together?  | Six aligned trends: request volume/status, error percentage, latency, desired/ready/available replicas, restarts and CPU throttling. No log-table queries. |
| [02 · Capacity and startup](https://hyperdx.platform.prd.msgsndr.net/dashboards/e8ec27ebca8ec9510cc54010)  | Did requested capacity become usable?               | Creation, scheduling, pending age, waiting reasons and hosting nodes first. Expand HPA, resource saturation or incident evidence as needed.                        |
| [03 · Request investigation](https://hyperdx.platform.prd.msgsndr.net/dashboards/8da8d7cbb9ebeb140a048e6f) | Which requests/callers fail, and what do logs show? | One log table with severity and Trace ID filters. Expand endpoint metrics, top callers, combined latency percentiles or gateway failure flags. |

## Replica panel meanings

The P0 overview shows Desired, Ready and Available. Ready means readiness checks
pass; Available additionally satisfies the deployment’s minimum ready duration.
Confirm actual service health against request success and latency.

Capacity retains **Pods in Running phase** and **Application containers running**
as separate series. A pod can remain in Running phase while its application
container is restarting. Neither running count proves that it can serve traffic.

## Navigation and time

- All three have the same Cluster / Namespace / Deployment filter definitions.
    Capacity additionally exposes Pod and Event reason; Requests exposes Pod / severity / Trace ID / API route.
- Ordinary navigation links open the destination's saved view. They **do not
  carry unsaved filters or the selected time range**. For an ad-hoc investigation,
  verify scope and time after switching. Automatic context-preserving navigation
  needs an application change; Markdown links cannot implement it by themselves.
- The fixed replay links below keep `contacts-get-internal-api`, the production
    cluster and 12 September 2026, 8:25–10:25 PM IST identical across the three views:
    [Overview](https://hyperdx.platform.prd.msgsndr.net/dashboards/6aa7af64466e0dad178178c4?granularity=30+second&filters=%255B%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522cluster%2522%252C%2522values%2522%253A%255B%2522servers-usc1-prd-cluster%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522namespace%2522%252C%2522values%2522%253A%255B%2522default%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522deployment%2522%252C%2522values%2522%253A%255B%2522contacts-get-internal-api%2522%255D%257D%255D&from=1789224900000&to=1789232100000) ·   [Capacity](https://hyperdx.platform.prd.msgsndr.net/dashboards/e8ec27ebca8ec9510cc54010?granularity=30+second&filters=%255B%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522cluster%2522%252C%2522values%2522%253A%255B%2522servers-usc1-prd-cluster%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522namespace%2522%252C%2522values%2522%253A%255B%2522default%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522deployment%2522%252C%2522values%2522%253A%255B%2522contacts-get-internal-api%2522%255D%257D%255D&from=1789224900000&to=1789232100000) ·   [Requests](https://hyperdx.platform.prd.msgsndr.net/dashboards/8da8d7cbb9ebeb140a048e6f?granularity=30+second&filters=%255B%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522cluster%2522%252C%2522values%2522%253A%255B%2522servers-usc1-prd-cluster%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522namespace%2522%252C%2522values%2522%253A%255B%2522default%2522%255D%257D%252C%257B%2522type%2522%253A%2522variable%2522%252C%2522name%2522%253A%2522deployment%2522%252C%2522values%2522%253A%255B%2522contacts-get-internal-api%2522%255D%257D%255D&from=1789224900000&to=1789232100000).
- Exports specify a rolling 15-minute window and 30-second refresh. The deployed
  backend schema does not declare `savedRefreshInterval`; the field is stored in
  these dashboard documents, but persistence through a later UI save/import and
  automatic activation are not verified. Enable **Live** in the UI for ongoing
  debugging and verify the displayed interval. Historical incident replay should
  stay on its fixed time window.

## What was consolidated

| Previously | Now |
| --- | --- |
| Four HPA number cards plus HPA trends | Two HPA trends retain min/max/desired/current and current/target metrics. |
| Several replica cards, ratios and capacity charts | A compact impact comparison on Overview; the full capacity stages on Capacity. |
| Four endpoint percentile panels | One P50/P90/P95/P99 chart; select a route to reduce series clutter. |
| Separate endpoint 4xx and 5xx percentage panels | One chart with both ratios. |
| Several overlapping gateway RPM/failure panels | Impact/status on Overview; service/flag detail and rolling failure totals on Requests. |
| General logs, trace-ID logs and trace-ID error logs | One table with existing severity and Trace ID filters. Its query and timestamp-descending ordering are preserved. |
| Repeated aggregate and per-pod restart views | An aggregate impact trend on Overview, per-pod detail on Capacity. |

One new panel shows the top ten caller RPMs using application `sourceContainer`
labels. This makes traffic attribution visible without waiting for a separate
RCA. Caller rates can include retries; they are not unique business operations.
Some overview/detail overlap is intentional so each view remains understandable.

## Evidence and limits

- Capacity includes a fixed, explicitly labelled September 12 Cloud Logging
  excerpt with the exact image-pull message, insert ID and source link. A
  separate Kubernetes lifecycle-event table filters by Cluster / Namespace /
  Deployment / Pod / Event reason. It starts collapsed to avoid automatically
  scanning historical application logs. Collection began September 14 and
  does not backfill September 12; verify current collector delivery for the
  selected cluster. Event updates can repeat/aggregate occurrences. Pending
  age is not image-pull duration; the excerpt is not a live metric.
- Production has no configured stored-span source. Trace-ID log correlation is
  retained; span waterfalls and dependency-level trace diagnosis are not provided.
- PromQL number cards were changed to trends after validation found a time-end
  discrepancy: a gateway query with `@ end()` returned 84,399 RPM, while an explicit
  end timestamp and the time-series value at that same end returned 124,253.4 RPM.
  The exact upstream cause was not established. The current number renderer reads
  the first result row, so simply removing `@ end()` from a number card is unsafe.
  The reorganized suite uses time series for all PromQL panels.
- All 31 PromQL queries were re-executed successfully at 30-second resolution
  for September 12, 8:25–10:25 PM IST. Deployed schema, filter references,
  tile IDs and layouts passed. Application logs returned in a bounded
  ClickHouse query and in the live Request investigation table. A historical
  event query timed out; no absence or historical backfill is claimed.
- Publication used the authenticated dashboard API. Saved tiles, filters and
  containers were read back; unrelated saved defaults were preserved. Ten
  metric panels plus the historical excerpt were captured from the live UI
  for the RCA. No workload changes, restarts or deployments were needed.

## Files and recovery

- Overview: `prd-service-debugging.json`.
- Capacity: `prd-capacity-startup.json`.
- Requests: `prd-request-investigation.json`.
- Original full export: `archive/prd-service-debugging-full.json` (54 tiles).

The current 54-tile live copy, `6aa7af64466e0dad178178c4`, became the overview.
The earlier dashboard ID `6aa7a14a466e0dad1781775b` was already absent before this
change. A separate older 39-tile copy, `6aa79ac8cc20292fe2beb150`, was not modified.
The pre-change current document is backed up locally at
`/tmp/dashboard-suite-before-6aa7af64466e0dad178178c4.ejson`.
The JSON navigation links target this production suite; importing a copy does
not automatically rewrite links to the copied dashboard IDs.
