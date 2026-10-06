# Metrics query reliability

This change addresses the common Prometheus query path. It does not change a
dashboard expression, shorten its selected time range, or invent missing
samples.

## Observed production failure, 6 October 2026

- The deployed HyperDX API deadline was 90 seconds, ingress and the Google
  internal application LB 120 seconds, and vmselect's maximum query duration 600
  seconds.
- For query hash `389b754f75702201`, the LB recorded a GET starting at
  `2026-10-06T14:06:13.527608Z`, API logs showed a 90.006-second 504 followed by
  a 29.972-second cancelled attempt, and LB log `insertId=1vps0s8evg43y`
  recorded `http_response_timeout` after 120.001175 seconds. This was a
  diagnostic GET; chart POSTs do not have that LB retry behavior.
- Thanos v0.16.0 uses three-hour range splitting, 32 subqueries per parent and
  five configured retries. Its range codec drops VM's `timeout` request
  parameter and `isPartial` response flag. It cannot enforce VM's
  `deny_partial_response`.
- Platform vmselect pods have recorded OOM terminations with 60 GiB limits,
  including `vmselect-platform-prd` pod suffix `dk7kn` at
  `2026-10-06T12:34:34Z`. Existing vmalert queries also took 32–46 seconds.
  These observations establish query-tier pressure, not causality for every
  timeout.
- A populated 90-day `contacts-external-api` Istio query returned 361 points via
  direct VM (3.18s) and Thanos (1.38s). These sequential, cache-uncontrolled
  probes establish that history can be retrieved; they are not comparative
  benchmarks.

The deployed Thanos codec is documented by its
[versioned source](https://github.com/thanos-io/thanos/blob/v0.16.0/pkg/queryfrontend/codec.go).
Google documents the
[GET retry behavior](https://docs.cloud.google.com/load-balancing/docs/l7-internal#retries).

## Request behavior

1. Charts share a four-request browser queue (maximum 128 waiting requests per
   page). Waiting happens before HTTP and does not consume an LB deadline.
2. Changing range or leaving a chart cancels its queued/active request through
   TanStack Query's abort signal. PromQL chart queries do not automatically
   retry.
3. The API starts its deadline before resolving the saved, team-scoped
   connection. Up to eight query/query_range requests can run per API process.
   Additional requests get HTTP 429 with `Retry-After: 5`; there is no server
   admission queue. This is not a cluster-wide limit: two replicas allow 16, and
   other VM consumers are outside this limit. Labels and exemplars retain their
   existing query paths.
4. An optional exact URL map routes saved Prometheus connections to another
   operator-approved endpoint. No request parameter can choose the replacement.
   Source credentials and every pinned source query parameter must also be
   present unchanged in the target or startup fails. Operators remain
   responsible for ensuring both URLs address the same tenant and data.
5. Backend query time is capped at the remaining API budget minus ten seconds,
   preserving shorter caller timeouts. Client disconnection cancels upstream
   fetch and streaming. Range requests retain an 11,000-point-per-series guard;
   choose coarser granularity for long history rather than truncating the
   selected range.
6. Responses are streamed without dropping VM metadata. Charts reject
   `isPartial: true` with an explicit error rather than presenting incomplete
   data as complete. Pin `deny_partial_response=1` when routing directly to VM.

## Operator configuration

| Variable                          | Default | Meaning                                                                    |
| --------------------------------- | ------- | -------------------------------------------------------------------------- |
| `PROMETHEUS_UPSTREAM_URL_MAP`     | `{}`    | JSON object mapping exact saved connection URLs to approved backend URLs   |
| `PROMETHEUS_PROXY_TIMEOUT_MS`     | `90000` | Total API deadline; accepted range 20,000–600,000 ms                       |
| `PROMETHEUS_PROXY_MAX_CONCURRENT` | `8`     | Concurrent query/query_range requests per API process; accepted range 1–64 |

Production proposal: use the existing internal vmselect service and tenant 100,
100s maximum backend query time, 110s API deadline and existing 120s ingress/LB.
VM may have a larger global maximum; the per-request timeout bounds this caller.
An older Thanos frontend drops that timeout, so the native route is part of the
production proposal. No shared Thanos/Grafana routing, global VM limits, LB
timeouts, stored connections or dashboards are edited by this code.

## Release verification and rollback

Local review evidence:

- 66 API and 78 app tests passed, including the existing chart hook and granularity
  suites. The new partial-result and concurrency regressions failed on the old
  implementation before the fix.
- API and app TypeScript checks passed. Changed-file ESLint and formatting passed.
  Dependencies were installed with the immutable lockfile in this isolated
  worktree and common-utils was built from the same revision.
- A real local HTTP chain using `http-proxy-middleware`, the changed API proxy and
  a synthetic VM server passed: 90-day bounds and tenant pins preserved, partial
  metadata preserved, timeout capped, cancellation reaching upstream before
  headers and during streaming, deadline returning 504, and a succeeding request
  after cancellation/timeout. This exercised native Node fetch without Jest mocks;
  it was not a live database/authentication or production browser test.
- Independent review identified and resolved Prometheus duration serialization
  compatibility, compound duration parsing and missing-range validation issues.

Merge and build through the normal reviewed image workflow. The corresponding
Helm configuration intentionally retains the currently approved image tag; it
does nothing on custom.58. Promote the new image in a separate reviewed change
and apply configuration only through the approved Argo flow.

Before declaring production fixed, exercise actual browser POSTs for short and
90-day ranges on representative dashboards, including expensive joins, with both
cold and warm VM caches. Verify completed data, no partial results, bounded
concurrency, cancelled work stopping, and vmselect memory/queue/OOM rates. Run a
multi-user admission check in staging. Local tests are not a production load
test.

Direct routing gives up Thanos's separate result cache for this connection and
uses VM's native result cache. This can change performance in either direction;
do not infer production latency from isolated sequential probes. Expensive raw
90-day joins may still need recording rules; this change cannot guarantee every
arbitrary query fits the request budget. Missing historical series are not
repaired.

Rollback the URL-map and timeout environment changes through Helm/Argo to
restore the saved Thanos route. No database migration or storage change is
involved. Reverting the application image also removes the new
admission/cancellation rules.

Reusable lesson promotion to the central AI library is pending; this task's
authorized changes and source evidence remain in the application repositories.
