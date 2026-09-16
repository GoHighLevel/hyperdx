# Production logging dashboard: 30-day loading investigation

Dashboard: `6aaabddb4a5cbb957da1d671` — **02 - Logging cost investigation — Production**.
Investigated September 16, 2026. Exact selected range: `1786990068443`–`1789582068451`
milliseconds (August 17 18:07:48.443 UTC–September 16 18:07:48.451 UTC).

## Findings

1. The older open browser tab still sent `60s` requests for 30 days. Production
   API logs recorded HTTP 400 responses within 13–33 ms. After a full navigation
   to the user's exact link, all nine unfiltered PromQL tiles requested `3600s`
   and returned HTTP 200. This confirms the deployed Auto interval fix is active.
2. Some earlier requests with coarser intervals were disconnected at approximately
   60 seconds. The running NGINX configuration for this host has
   `proxy_read_timeout 60s`, while HyperDX's Prometheus proxy deadline is 90 seconds.
   A separate Helm PR sets read/send timeouts to 120 seconds on this ingress only.
3. Number cards request an entire range but `DBNumberChart` displays the first
   numeric row. The bytes-per-entry card returned 721 points: the first value was
   **1933.147**, while a direct instant query at the selected end returned
   **1318.976**. Its range expression uses `@ end()`; the returned series varied
   across the query frontend's three-hour splits. Evaluating a number once at
   the selected end avoids both this range-splitting path and first-row selection.
4. Four workload-detail tiles require Cluster, Namespace, and Workload selections.
   The supplied URL has `filters=[]`, so those tiles correctly ask for selections.
   Offscreen ranking tiles query lazily; scrolling them into view loaded their data.

## Observed browser results after reload

| Tile | HTTP status | Duration |
| --- | --- | --- |
| Billing growth | 200 | 0.335 s |
| Latest-hour billing volume | 200 | 1.332 s |
| Bytes per entry | 200 | 42.071 s |
| Missing workload identity | 200 | 28.827 s |
| Resource types | 200 | 0.603 s |
| Top workloads | 200 | 4.761 s |
| Share of positive workload growth | 200 | 20.502 s |
| New workloads | 200 | 52.555 s |
| Log stream / severity | 200 | 30.525 s |

All requests used `3600s`. Browser resource timings may benefit from existing
backend caches; these are observations, not cold-cache benchmarks or a capacity SLO.

The same bytes-per-entry expression through `/api/v1/query` returned one value
at `1789582068.451`: **1318.976141864918**, HTTP 200 in **3.215 seconds**.
An earlier instant probe took 6.277 seconds. A zero-width `query_range` probe
returned an empty result through the frontend, so the implementation uses the
existing authenticated instant-query route instead.

## Changes prepared for review

- PromQL number tiles call `/v1/prometheus/query` with `time` equal to the
  selected end. Expression lookbacks and dashboard variable substitution remain
  intact. For instant evaluation, PromQL `start()`/`end()` refer to that evaluation
  time. Time-series tiles continue to use the full selected range and Auto step.
- Vector and scalar responses become one-point chart data. Empty results remain
  empty; unsupported result types and backend errors are reported explicitly.
- Number and time-series requests have separate cache keys, including when a
  caller supplies a key. ClickHouse number queries are unchanged.
- Production ingress gets 120-second read/send timeouts, allowing the API's
  existing 90-second result/error deadline to complete. This does not make slow
  queries faster or remove the backend timeout.

These changes do not increase retention, VM/Thanos resources, or query limits.
The longer ranking queries may still need recording rules if cold-cache latency
is unacceptable. No 90-day load or concurrency test was performed here.

## Evidence

- [Sanitized production API request records](evidence/logging30-api-requests.json)
- [Direct instant-query result](evidence/logging30-instant-result.json)
- [Browser ranking panels after reload](evidence/logging30-browser.png)

## Validation and limits

- 65 focused tests pass: request intervals, instant endpoint/response handling,
  selected-end precision, variable substitution, empty/error results, and cache isolation.
- `yarn lint:fix`, `npx lint-staged`, and `npx knip --no-config-hints` pass.
- Full app TypeScript checking reports the same two existing Developer UI type
  errors seen on the unchanged baseline. `make ci-lint` also fails in the broader
  repository, including API dashboard typing and existing lint warnings. The
  repository-wide CI gate is therefore not green; focused checks are not a substitute.
- Helm lint and rendering pass. Comparing all rendered resources before/after
  changes only the production HyperDX Ingress annotations, with no pod or storage change.
- The full monorepo unit suite and an authenticated browser running the new build
  were not run. The fresh test runtime exercises the changed hook and API with
  mocked transport; direct production queries validate the real instant endpoint.

The live browser observation above is from custom.29; the number-query and
ingress fixes are review changes and were not deployed during this investigation.
