# Metrics query reliability

## Conclusion and evidence, 7 October 2026

A blanket failure to retrieve 90 days through Thanos is **not established**. The
same query that hit HyperDX's 90-second deadline completed through Thanos in
72.292 seconds on replay. Grafana's production datasource and data proxy allow
600 seconds; HyperDX currently allows 90 seconds, with 120-second ingress and LB
deadlines. This is a confirmed configuration difference, not proof that every
failed panel has the same cause.

The proposed native-vmselect bypass has been withdrawn. Thanos completed a saved
node-pool join that lost its connection on the native route while the selected
vmselect pod was OOM-killed. Other queries were active, so this does not
establish that the probe alone caused the OOM.

### Read-only production observations

All probe ranges were fixed rather than moving live windows. Unless stated
otherwise they used start=1783512000, end=1791288000 and step=21600 seconds (90
days, six-hour output spacing). These are sequential retrieval checks, not
controlled performance benchmarks; cache and concurrent load were not held
constant.

| Query / source                                                                                                 | Route                                            | Result                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Saved P0 overview `overview-traffic`, contacts-external-api, default namespace, servers and web-users clusters | Internal Thanos                                  | 1.810s; 200; 3 series, 1,083 points                  |
| Identical overview query, bounds and step                                                                      | Native VM tenant 100                             | 1.119s; 200; 3 series, 1,083 points; isPartial=false |
| Identical overview query, bounds and step                                                                      | Public Thanos                                    | 0.549s; 200; same response hash as internal Thanos   |
| Capacity Production - 2, `all-pools-0-cpu-headroom`                                                            | Internal Thanos                                  | 21.833s; 200; 45 series, 3,435 points                |
| Identical node-pool query, bounds and step                                                                     | Native VM, timeout=110s, deny_partial_response=1 | Connection closed after 65.554s; no usable response  |
| Previously failed CPU query, hash below, start=1783519424, end=1791295424, step=21600                          | Thanos POST, timeout=600s                        | 72.292s; 200; 9 series, 1,978 points                 |

The overview VM/Thanos values differed by at most approximately 1.46e-11,
consistent with floating-point aggregation, and had matching series/point
counts.

- **Deadline evidence:** query SHA-256
  `389b754f7570220129f96acd6520350ec39f27a881afad2094f3df0fdeedf59f`. HyperDX
  API log at `2026-10-06T14:07:43.551741406Z`, insertId `i9i6z907ktaa7yf9`,
  records GET 504 in 90,006ms. LB insertId `1vps0s8evg43y` records the request
  beginning at `2026-10-06T14:06:13.527608Z` and `http_response_timeout` at
  120.001175s. This diagnostic GET is not a browser chart POST; its retry
  behavior must not be generalized to chart POSTs.
- **Grafana configuration:** live read-only PostgreSQL SELECT of datasource UID
  `ber8nnhvgsjy8f` (`prod-victoria-metrics`) shows
  `https://thanos.platform.prd.lcmsgsndr.net`, HTTP POST and queryTimeout=600s.
  The mounted grafana.ini has dataproxy timeout=600. This is configuration
  evidence, not a captured successful browser request for the same expensive
  panel.
- **VM resource evidence:** pod `vmselect-platform-prd-857f494f99-mdf86`
  terminated OOMKilled, exit 137, at `2026-10-06T19:19:20Z` (7 October 00:49:20
  IST), restarting at 19:19:21Z. The native probe started at 19:18:16Z and
  disconnected around 19:19:21Z. Other vmalert work was concurrent. No further
  heavy direct-VM probes were run.
- **Query tier:** Thanos v0.16.0 uses 3-hour splitting, max query parallelism 32
  and five configured retries. VM has 10 replicas with 60Gi memory limits,
  maxConcurrentRequests=30 and maxQueryDuration=600s. These settings and
  observed OOMs support investigating shared load, not declaring Thanos faulty.
- **Observed logs:** the inspected HyperDX sample contained 76 successful
  one-hour chart POSTs and diagnostic 90-day GETs. It did not contain a captured
  failing 90-day browser POST. The exact user-browser failure remains
  unverified.

Sanitized probe parameters, results and selected source records are retained in
[the evidence export](evidence/metrics-query-2026-10-07.json). Full local raw
responses remain in the ignored diagnostic directory; credentials are excluded.

## Application changes

1. Charts share four active requests and at most 128 queued requests per page.
   Waiting happens before HTTP, outside the LB request deadline.
2. TanStack cancellation reaches queued and active requests. PromQL chart
   queries no longer automatically retry.
3. The API admits eight query/query_range requests per process and rejects
   excess work with HTTP 429 and Retry-After: 5. With two replicas this permits
   16 queries; it does not limit Grafana, vmalert or other consumers.
4. Saved connection URLs, authentication and tenant parameters remain unchanged.
5. A configurable API deadline covers connection lookup, upstream fetch and
   streaming. Client disconnection cancels upstream work. A shorter upstream
   timeout is passed where supported; Thanos v0.16's range codec drops VM's
   timeout parameter, so only the API abort deadline is guaranteed on that
   route.
6. The existing 11,000-point-per-series guard remains explicit. Auto granularity
   may inherit a panel's saved interval; a six-hour diagnostic probe does not
   prove that a browser panel requested that same step.
7. Charts reject isPartial=true when returned. Thanos v0.16 can drop that VM
   metadata: this change cannot detect partial results that the upstream hides.

| Variable                        | Default | Bounds               |
| ------------------------------- | ------- | -------------------- |
| PROMETHEUS_PROXY_TIMEOUT_MS     | 90000   | 20000–600000ms       |
| PROMETHEUS_PROXY_MAX_CONCURRENT | 8       | 1–64 per API process |

## Deployment proposal and limits

The companion draft Helm PR keeps the current image and Thanos connection. It
proposes 110 seconds inside the existing 120-second ingress/LB budgets. **This
does not give Grafana's 600-second budget and is not presented as the generic
90-day fix.** Longer end-to-end deadlines require coordinated ingress/LB review
plus resource/concurrency validation; increasing only the API timer is
insufficient.

The earlier native-route proposal is superseded by the 7 October evidence above.
No recording rule is a prerequisite of this PR. Recording rules may optimize
particular expensive expressions but are not proven necessary for all 90-day
dashboards. No live resources, saved dashboards or connection records were
edited.

## Validation and release gate

The narrowed revision passed 67 API tests, API TypeScript, and a rerun of the
real local HTTP proxy smoke using a synthetic upstream. That smoke verified
unchanged 90-day bounds and tenant pins, timeout handling, cancellation before
headers and during streaming, and a successful subsequent request. The unchanged
app portion previously passed 78 tests and its TypeScript check. These are local
implementation checks, not production UI evidence.

Before calling the dashboard issue fixed, capture the same failing panel in
HyperDX and Grafana: expression, labels, fixed bounds, step, method, deadlines,
response and concurrent query load. Test cancellation and multi-user admission
in staging, then check representative short and 90-day dashboards after a
reviewed release. Confirm vmselect queue, memory and restart behavior. Do not
load-test production or flush caches for this investigation.

Current browser access is unavailable and stored Grafana API credentials were
rejected. No authenticated browser comparison or deployed fix is claimed.
HyperDX's MCP dashboard tool also omits PromQL tiles, so saved expressions were
verified through read-only application storage.

Rollback consists of reverting the application image and its two environment
settings through the reviewed Helm/Argo workflow; no storage migration is
involved. Reusable lesson promotion remains pending outside this application's
scope.
