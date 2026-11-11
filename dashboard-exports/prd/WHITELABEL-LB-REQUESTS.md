# Whitelabel LB request dashboard

Import [prd-whitelabel-lb-requests.json](prd-whitelabel-lb-requests.json) into
production HyperDX after deploying and activating the companion proxy changes.
Map `Production Metrics` and `Production Metrics Querier` to the existing source
and connection. No HyperDX application release or new collector is required. Use
the custom production branch with selected-range PromQL macros and the
Min/Max/Last legend implementation (PR #12); upstream HyperDX is not assumed to
support this export.

The dashboard covers completed HTTP requests reaching 35.202.49.152, forwarding
rule `a8c356da9198a4d53abc2169e8dadea9`, including customer domains. Two
Services share the proxy pods, so the companion infrastructure change adds
dedicated 8080/8443 listeners and then switches only the selected Service's
targetPorts. The aggregate metric is independent of the hostname cap. It must
not be added to legacy proxy counters or downstream application counters.

## Panels and filters

- All-host total, average/day and average RPS use the selected time range. A
  10-day selection divides the total by 10; 12 hours divides by 0.5.
- All-host RPS and status-class RPS use a 5-minute rate. This lookback can
  extend before the selected range. Each graph uses the renderer's visible
  Min/Max/Last legend; these values describe displayed RPS samples, not request
  totals.
- Host selection affects only the selected-host total, daily average and top-20
  RPS graph. Status selection affects all request panels. Empty selection means
  all values. The top 20 can change at each timestamp; the graph's series limit
  is not an exhaustive domain list.
- Enabled targets indicate instrumentation, not successful Service activation or
  complete scrape coverage. Exporter errors should remain zero.
- Overflow requests are separate from the named-host breakdown. A missing
  overflow series is not evidence of a healthy scrape; inspect enabled targets
  and the existing monitoring-health dashboard too.

Every pod admits up to 1,000 syntactically valid hostnames. Further hosts are
grouped under `__other_hosts__`; missing/invalid hosts use `__invalid_host__`. A
domain may be named on one pod and overflow on another. **Individual domain
counts can therefore be partial; aggregate all-host counts retain overflow.**
Host names do not prove customer ownership. Probe/status/metrics endpoints, ACME
challenges and subrequests are excluded; errors, redirects and static resources
are included. A redirect and its follow-up request count separately.

Use ranges entirely after activation. There is no historical backfill and no
zero fallback concealing unavailable telemetry. Prometheus `increase` adjusts
each target's counter resets before summing and extrapolates scrape boundaries;
these are operational estimates, not exact billing or audit counts. Inspect
scrape gaps, restarts and metric errors before presenting results.

## Validation and deployment acceptance

Run the repeatable query fixture from the repository root:

```sh
python3 dashboard-exports/prd/tests/verify-whitelabel-queries.py
```

It uses a digest-pinned Prometheus 3.5.0 container without network access,
checks every exported expression and tests two replicas, a counter reset,
10-day, 1-day and fractional-day averages, hostname/status filtering and
overflow. An image pull is needed if it is not already local. Import schema
validation uses the custom HyperDX `DashboardTemplateSchema`.

On 11 November 2026, all 11 query expressions parsed and the query fixture
passed. The exact target branch's import schema accepted all 12 tiles, and its
selected-range macro expansion passed for 10 days, 1 day and 12 hours. The first
one-minute synthetic fixture exceeded promtool's built-in sample limit; the
fixture now uses three-minute samples while retaining the same reset and rate.
This local fixture does not validate production query capacity at real
cardinality.

The PR contains a dashboard export, not an imported production dashboard. After
the proxy rollout and Service activation, verify actual source labels, scrape
continuity and the expected enabled endpoint count. Import and exercise
host/status variables, empty and populated ranges, 1-day and 10-day selections,
and refresh. Capture a live screenshot showing Min/Max/Last for all three
time-series panels. Live rendering, production count reconciliation and customer
TLS/origin routing remain pending until an authorized deployment; local query
tests do not establish those outcomes.
