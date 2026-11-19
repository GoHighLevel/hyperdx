# Live log freshness

Status: deployed to staging as **2.38.0-custom.42**, Helm commit
`7b677862d33ddf3baf7bcfe141e08ef5c7c00c1e`. Argo CD Synced/Healthy;
operation Succeeded; new pod ready with zero restarts. API/login/assets return
200 and the ingress bundle hash matches the new pod. [Deployment evidence](deployment.json).
Authenticated staging browser interactions were not repeated after deployment;
the local behavior tests and deployed runtime checks are separate evidence.

Two defects made the view misleading: the latest button queried the old range
end, and live continuation crawled through ASC pages in one-minute intervals.
"Reached end of range" described that old query boundary, not current data.

Live bottom scroll/footer/latest-button requests now select the newest bounded
page through the clock at activation. Fixed ranges retain historical pagination.
The footer states **Latest event** separately from **Searched through**; a newer
search time does not guarantee that the application has emitted newer events or
that all emitted events have already arrived. A latest page is not a complete
listing of all matching logs; use a fixed range to inspect every page.

![Footer distinguishes event time from query end](footer-light.png)

- [Dark browser screenshot](quiet-service-dark.png)
- [Light browser screenshot](quiet-service-light.png)
- [Pre-fix failing regression](failing-before.log)
- [75 passing tests](tests.log), [24 hook tests rerun with 1,000-row pages](dense-page-tests.log)
- [TypeScript](typecheck.log), [scoped lint](lint.log)
- [Patch against custom.41](changes.patch), [source manifest](source-manifest.json)

Browser verification uses the actual table within SnapGridLayout with synthetic
data. Latest event stayed 10:35:00 while a manual check advanced searched-through
to 10:36:00. An idle five-second wait made no further request. Both themes and
actual bottom-wheel activation were checked. No backend ingestion latency or
authenticated staging flow was measured in this turn. Histogram behavior is
unchanged; this fix concerns log page retrieval and its freshness label.

Run `node packages/app/scripts/preview-log-summary.cjs --dashboard-table --build-only`
from the HyperDX root and reload the existing localhost:8773 preview. Use
**Simulate high-volume range**, then scroll down, advance the simulated clock,
and scroll down again.

Commit only from a clean checkout already containing custom.41 source; the
current root checkout has unrelated work and must not be staged wholesale:

```sh
test -z "$(git status --porcelain)" &&
git apply --check /Users/akshaygupta/Documents/work/hyperdx/output/live-log-freshness/changes.patch &&
git apply /Users/akshaygupta/Documents/work/hyperdx/output/live-log-freshness/changes.patch &&
git add . &&
git commit -m "fix(logs): refresh live pages through the current time" &&
git push
```
