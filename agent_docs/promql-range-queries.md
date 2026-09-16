# Reviewing long-range PromQL dashboard queries

## Problem and evidence

The PromQL chart hook used a fixed `60s` step for Auto. A 14-day range
therefore requested 20,161 points per series, exceeding the production Thanos
query frontend's 11,000-point guard. Adding CPU or replicas does not remove that
validation failure. Dashboard Auto also overwrote saved panel intervals.

Read-only reproduction on 2026-09-16 used the production cost overview's
“Monitoring · current vs yesterday” expression, with start `1788367994.098`
and end `1789577594.098` (14 days):

| Endpoint | Step | Observed result |
| --- | --- | --- |
| Thanos query frontend | 60 seconds | HTTP 400: `exceeded maximum resolution of 11,000 points per timeseries` |
| Same Thanos endpoint and expression | 1 hour | HTTP 200; 2 series, 674 total points |
| Direct VictoriaMetrics endpoint, same expression | 60 seconds | HTTP 200; 2 series, 40,322 total points; `isPartial: false` |

This establishes the resolution guard as the cause for this reproduction. It
does not establish that every metric has 90 days of history or that every query
will be inexpensive after the fix.

## Behavior in this change

PromQL Auto now uses the existing shared interval calculator with a conservative
budget of 1,000 buckets. This is a fixed display budget, not a measurement of the
panel's pixel width. Start/end timestamps and the PromQL expression are preserved.

| Range, with panel and dashboard Auto | Request step | Points per series, including endpoints |
| --- | --- | --- |
| 1 day | 5 minutes | 289 |
| 14 days | 30 minutes | 673 |
| 30 days | 1 hour | 721 |
| 90 days | 6 hours | 361 |

An explicit dashboard or fullscreen interval takes precedence. Otherwise, Auto
inherits the panel's saved interval. If the panel is also Auto or has no saved
interval, the range determines the step. Explicit day intervals use the shared
converter, including 2, 7, and 30 days; they no longer fall back to 60 seconds.

Explicit intervals are never silently made coarser. Requests above the
conservative 11,000-point compatibility limit show a message asking for a larger
interval or shorter range before calling the API. For example, 90 days at 15
seconds requests 518,401 points per series and is rejected. Direct VM can support
more points, but this client guard deliberately targets the supported Thanos
path; it is not backend capability discovery.

Changing the evaluation step does not delete stored samples or create storage
rollups. It can make short spikes less visible in an overview; zoom into the
incident window and select a finer interval to investigate them. Existing
PromQL rate/lookback windows are not rewritten.

## Validation and reviewer steps

Run the focused hook and resolver tests:

```sh
cd packages/app
../../node_modules/.bin/jest src/utils/__tests__/promqlQueryStep.test.ts src/hooks/__tests__/useChartConfig.test.tsx --runInBand --silent
```

The hook tests inspect the actual mocked API call, including step and unchanged
fractional start/end timestamps. They also check that an oversized explicit
request never calls the API. Resolver tests cover interval precedence, day
units, invalid dates, and the inclusive-endpoint limit.

A local browser harness loaded a bundle of the production resolver and verified
14-, 30-, and 90-day Auto, saved-panel inheritance, explicit dashboard override,
and the 90-day/15-second rejection. This was a resolver smoke test, not an
authenticated end-to-end dashboard test.

For dashboard acceptance testing after deploying a review build:

1. Open a PromQL time-series panel with its saved interval set to Auto.
2. Select 14, 30, and 90 days with dashboard Auto. Inspect the range request:
   expect `1800s`, `3600s`, and `21600s`, respectively.
3. Save a 1-hour panel interval. Dashboard Auto must send `3600s`.
4. Select an explicit 2-hour dashboard/fullscreen interval; expect `7200s`.
5. Select 90 days and 15 seconds; expect the actionable point-limit message.
6. Zoom into an incident hour and select 15 seconds; expect that exact step.

Full app TypeScript checking reports two existing errors in
`DeveloperUISection.tsx` and `useDeveloperPreview.test.tsx`. An unchanged HEAD
snapshot using the same dependencies produces the same errors. No errors point
to this change. Full authenticated dashboard validation and a 90-day production
load test were not performed.

The repository-wide unused-code check also found an existing unused export:
`DEFAULT_VISIBLE_FILTERS`. It is now private to its module; the exported
`isDefaultVisibleFilter` function and filter behavior are unchanged. This small
cleanup is included so the mandatory pre-commit check can pass.

## Scope

This PR changes dashboard request resolution only. It does not change retention,
Helm resources, Thanos/VM replicas, recording rules, storage downsampling, cache
configuration, or number-card query semantics. It does not implement chunked
full-resolution 90-day exports. Such exports require a separate bounded-query
and result-size design. No production or staging deployment is included.
