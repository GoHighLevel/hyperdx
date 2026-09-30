# Latest matching log navigation

Status: deployed to staging as **2.38.0-custom.41**, Helm revision
`55584f74445d45b1502fa181f222e239c839e381`. Argo CD Synced/Healthy;
operation Succeeded; new pod ready with zero restarts. API, login, and frontend
assets returned HTTP 200 directly and through ingress; served assets match the
new pod. [Deployment evidence](deployment.json). Production remains custom.40.

The initial ascending query returned only the first page of the selected time
range. The bottom arrow scrolled that page, so its final row could still be
minutes earlier than the range end. The graph counted the full range.

The bottom arrow now requests the latest matching page directly (descending
query, ascending display), then scrolls to its final row. It does not fetch all
intermediate pages. The top arrow requests the earliest page. The initial view
still starts at the selected beginning; ordinary scrolling pages forward.

The footer reports **loaded** count and timestamps, and distinguishes partial
pages from reaching the end. Latest means newest matching record available to
that query **within the selected range**, not the current wall clock or a
promise that delayed events have already arrived.

## Evidence

- [Latest page, dark](latest-dark.png), [latest page, light](latest-light.png).
- [Partial-page footer](partial-page-footer.png).
- [Failing regression before fix](failing-before.log).
- [73 passing tests across five suites](tests.log); [17 UI tests rerun after final guard](final-ui-tests.log).
- [TypeScript](typecheck.log): passed. [UI lint](lint.log) and
  [hook lint](hook-lint.log): no errors; existing and fixture warnings retained.
- [Source patch against custom.40](changes.patch), [hash manifest](source-manifest.json).

Browser verification used the actual RawLogTable inside SnapGridLayout at
http://127.0.0.1:8773/, with synthetic data and simulated request latency:

| Check | Result |
|---|---|
| Initial million-record range | First 80 records; footer identifies more logs remain |
| Go to latest | Request 1,000,000 is last; 80 rendered records; one simulated load |
| Actual loaded timestamp range after jump | 10:35:00.101–10:35:00.124 IST |
| Selected end | 10:35:00.125 IST |
| Bottom scroll gap | 0 px |
| Return to earliest | Scroll offset 0; initial page restored |
| Idle at bottom for 10 seconds | Load counter stayed at 1 |
| Keyboard activation | Enter fetched latest page |
| Expanded log | Query navigation disabled while inspecting |
| Dashboard tile drags | 0 |
| Themes / browser console | Both themes checked; zero warnings/errors |

The browser fixture is not a ClickHouse performance benchmark. Query-layer
tests separately verify DESC direction, bounded pagination, ASC presentation,
fixed/live ranges, errors, stale results, and inspection pauses. No production
query or authenticated production UI interaction was exercised for this fix.
Authenticated staging browser behavior was not repeated after deployment:
workstation HTTPS access timed out. The new version and compiled UI markers
were verified through the staging ingress from the workload network.

## Reproduce locally

From the HyperDX project:

```sh
node packages/app/scripts/preview-log-summary.cjs --dashboard-table --build-only
```

Reload the existing localhost:8773 preview, click **Simulate high-volume range**,
then **Go to latest logs**. Do not restart an existing server unnecessarily.

## Commit the scoped patch

The main working directory contains unrelated changes, including `.env`.
Use these commands only from a clean checkout containing the custom.40 source.
The guard and patch check stop before staging anything if that precondition fails.

```sh
test -z "$(git status --porcelain)" &&
git apply --check /Users/akshaygupta/Documents/work/hyperdx/output/latest-log-navigation/changes.patch &&
git apply /Users/akshaygupta/Documents/work/hyperdx/output/latest-log-navigation/changes.patch &&
git add . &&
git commit -m "fix(logs): fetch latest matching page on bottom navigation" &&
git push
```
