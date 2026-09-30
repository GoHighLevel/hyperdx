# Why a 14-day metrics dashboard fails

**Confirmed on 16 September 2026: HyperDX's PromQL Auto interval becomes a fixed 60-second query step. At 14 days, that exceeds the Thanos query frontend's 11,000-point resolution limit. VM itself successfully serves the same query. This reproduced failure is not a retention or VM memory problem.**

## Exact reproduction

Dashboard: `6aaabdbdfe71d738f0872c67`, **01 - Cost anomaly overview — Production**. Panel: **Monitoring · current vs yesterday**. Source: **Production Metrics**, connection **Production Metrics Querier**.

The supplied URL contains one day. For the reproduction, its end time was preserved and its start moved back 14 days: **2 September 2026 16:53:14.098 UTC → 16 September 2026 16:53:14.098 UTC** (10:23:14.098 PM IST on both dates). Live mode was disabled for a fixed comparison.

| Path | Step | Result | Measured elapsed |
| --- | --- | --- | --- |
| HyperDX's configured Thanos endpoint | 60 seconds | HTTP 400: resolution limit exceeded | 0.148s |
| Same Thanos endpoint, same query and dates | 1 hour | HTTP 200; two series, 674 points | 0.620s |
| Direct VM endpoint, same query and dates | 60 seconds | HTTP 200; two series, 40,322 points; `isPartial=false` | 0.638s |

Exact upstream error:

> exceeded maximum resolution of 11,000 points per timeseries. Try decreasing the query resolution (?step=XX)

These were sequential read-only requests from the running HyperDX pod. Timings are individual observations, not a benchmark. The exact query, timestamps, endpoints and outcomes are retained in [vm-long-range-reproduction.json](evidence/vm-long-range-reproduction.json).

## What causes it

1. In    [`useChartConfig.tsx`](../../../packages/app/src/hooks/useChartConfig.tsx), around lines 338–356, PromQL initializes `stepStr` to `60s` and only converts an explicit, non-`auto` granularity. Auto never calculates a step from the selected duration.
2. In    [`DBDashboardPage.tsx`](../../../packages/app/src/DBDashboardPage.tsx), around lines 625–638, the queried PromQL configuration spreads the stored tile configuration and then overwrites `granularity` with the dashboard-level setting. Thus the JSON's explicit `1 hour` tile interval does not protect it when the dashboard selector is Auto.
3. HyperDX forwards that step to `https://thanos.platform.prd.lcmsgsndr.net/api/v1/query_range`. The deployed frontend is `quay.io/thanos/thanos:v0.16.0`; its downstream is VM tenant 100. The frontend returns the point-limit rejection. Bypassing it demonstrates that this VM request succeeds.
4. Fourteen days at a 60-second step requests **20,161 points per series**. The observed frontend limit is 11,000. The fixed minute step therefore reaches this boundary at approximately **7.64 days**, regardless of how much data VM retains.

The deployed frontend has `--query-range.max-query-length=0`, so a configured 14-day query-length restriction is not the explanation. Its three-hour split setting does not prevent this initial resolution rejection. HyperDX's proxy timeout is 90 seconds, whereas the observed rejection takes about 0.15 seconds; this particular failure is not a timeout either.

The same fixed-step code is shared by PromQL dashboards, explaining why this can affect many VM-backed dashboards. This investigation does not establish that every empty panel has this cause. Some metrics, especially the recently added Stackdriver billing-byte series, do not have 90 days of collected history even when VM retains other series for 90 days.

## Workaround and proper fix

**Immediate workaround:** select **1 hour** in the dashboard's global granularity control. The 14-day query with that interval was tested successfully. [Open the same dashboard with the tested 14-day range and one-hour interval](https://hyperdx.platform.prd.msgsndr.net/dashboards/6aaabdbdfe71d738f0872c67?granularity=1%20hour&isLive=false&filters=%255B%255D&from=1788367994098&to=1789577594098).

**Proper application fix:** calculate Auto's step from range and a sensible chart point budget, rounding to supported intervals and maintaining a safe margin below the backend limit. Decide explicitly how dashboard Auto interacts with a saved tile interval. For explicitly fine resolution across long ranges, either explain the limit before querying or implement bounded query splitting; do not silently change the user's requested resolution. Number cards that need only the range-end value should avoid unnecessary full-range requests.

Increasing VM RAM, extending retention, or increasing request timeouts does not fix this HTTP 400. Bypassing Thanos worked diagnostically, but changing the shared source to bypass it is not the first recommendation: correct the step calculation while preserving the existing query path and caching.

For illustration, a 90-day range at one hour requests only 2,161 points per series, below this limit. A full 90-day query and completeness of every series were **not** tested here.

## Validation gap and current status

The previous dashboard validation exercised explicit one-hour steps directly. It did not exercise the authenticated browser's global Auto override. That was a gap in the earlier validation.

The current browser session redirected to login. Dashboard configuration was read from the deployed application's MongoDB, and the actual configured upstream plus direct VM were queried from its pod. The authenticated browser request and rendered workaround have not been captured. Local source paths were checked against the workspace graph and read directly where stale/partial coverage was reported.

**No application code, stored dashboard, source, Helm value, or deployment was changed.** This report establishes the cause and tested backend workaround; it does not claim the permanent fix is deployed.
