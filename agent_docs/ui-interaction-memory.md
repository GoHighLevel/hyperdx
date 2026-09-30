# HyperDX UI interaction memory

## Footer omits page counts — 2026-09-18

- User guidance: "Showing newest 1,000 logs" (or any loaded-page count) is not
  useful in the footer. Keep freshness information instead of query page size.
- `LogRangeFooter` now shows only Latest event / Last shown, Searched through,
  applicable coverage, and the scroll action. Empty results still say No
  matching logs. No query/pagination behavior changed.
- Verified in the rebuilt local RawLogTable/SnapGridLayout preview: "Latest
  event 10:35:00 AM · Searched through 10:36:00 AM"; no displayed page count.
  All 18 existing UI regression tests passed; scoped lint 0 errors/2 fixture
  warnings. Screenshot and patch: `output/footer-no-count/`.
- Local change relative to custom.42; not deployed yet.

## Live freshness versus historical pagination — 2026-09-18

Supersedes custom.41's frozen-end latest action and minute-by-minute ASC live
catch-up. User observed 00:26 wall time but rows ending 00:25 despite repeated
scrolls; the footer said "Reached end of range" for a 1,000-row page.

- Confirmed in current source: `jumpToEdge` reused the original config end;
  subsequent checks requested at most one minute after the old cursor and
  stopped after a nonempty ASC page. Dense streams could outpace pagination.
  This establishes a UI/query defect; it does not prove the backend has no
  ingestion delay for the screenshot's workload.
- Live footer/wheel requests now request a fresh DESC latest page through the
  clock at user activation, keeping the chosen relative window duration and
  displaying ASC. A fresh generation bypasses cached older pages. Page size
  stays bounded; the viewport is a newest-page snapshot, not a claim that all
  intervening records have been displayed. Fixed/nonlive ranges retain normal
  ASC pagination. Initial range-start loading remains unchanged.
- No timer/background fetch; merely staying at bottom does nothing. Inspection
  blocks replacement. A failed request retains old rows and successful search
  time; retries stay explicit. Fixed range latest does not expand to now.
- Footer removes "Reached end of range". It separates "Latest event" from
  "Searched through" (successful query end). Partial pages use "Last shown";
  zero results say "No matching logs". Tooltip explains search range and that
  fixed-time pagination is needed to inspect all matches. Live action is
  "Scroll down to show latest logs".
- Regression first failed with range [0,60000] instead of [540000,600000].
  Final test uses 1,000 descending records, advances the clock twice, verifies
  replacement by newest records without calling older-page fetch, and checks
  no idle advancement. 75 tests passed; all 24 hook tests rerun successfully
  after strengthening the dense-page case. TypeScript passed; scoped ESLint
  no errors (existing/fixture warnings retained).
- Browser: actual RawLogTable inside SnapGridLayout, synthetic million-record
  fixture; bottom wheel and footer activation both refresh the latest page.
  Advancing only simulated clock leaves view unchanged; explicit refresh moves
  searched-through 10:35 to 10:36 while quiet-service latest event stays 10:35.
  Bottom gap 0, dark/light checked, idle load count unchanged over five seconds,
  zero browser errors/warnings. Query logic is tested with mocked data, not a
  live ClickHouse benchmark. Histogram refresh behavior was not changed.
- Source baseline `/tmp/hyperdx-custom41-context`; root dirty `stg` checkout
  HEAD `dbc210fb`, unrelated edits preserved. Graph generation
  2026-09-12T09:19:01Z was stale/untracked for affected files; current source
  reads supplied evidence. Patch/screenshots/logs:
  `output/live-log-freshness/`.
- Subsequently deployed to staging as custom.42 at Helm commit
  `7b677862d33ddf3baf7bcfe141e08ef5c7c00c1e`. Build context
  `/tmp/hyperdx-custom42-context` is custom.41 plus six manifest-verified files.
  Image digest `sha256:47afd5b6c19a49c724af268a6817c673ee8c99b3cd846e4a2567f957534d60b7`.
  Argo CD Synced/Healthy/Succeeded; pod
  `hyperdx-servers-sre-stg-clickstack-app-66c75dfb97-pjxqw` ready, zero restarts.
  API, login and frontend assets returned 200 directly and through ingress;
  asset hash matches new pod and includes all freshness markers. Authenticated
  staging UI flow was not repeated after deployment. Evidence:
  `output/live-log-freshness/deployment.json`. Production was not changed.

## Latest matching log navigation — 2026-09-18

This supersedes the **loaded rows only** navigation contract of custom.40 below.
The production screenshot showed the selected range ending at 15:39:28 while
the last loaded row was 15:34:28.803. The ASC query intentionally loaded only its
first page, but the bottom button only scrolled that page. Neither the selected
range footer nor the button explained that later matching pages remained.

- `useLiveLogQuery` retains initial ASC pagination so the beginning of the
  selected range is accessible. `jumpToLatest` replaces it with the first
  nonempty DESC page from the selected end and sorts that page ASC for display.
  DESC `hasNextPage` points to older data, so it must not be treated as newer
  pending logs or drained. `jumpToStart` loads the first ASC page again.
- The same explicit navigation works for fixed and live timestamp-ordered log
  searches. Jumping does not widen the selected time range. Live forward checks
  remain separate user actions, with the existing five-second overlap.
- `LogScrollButtons` waits for successful replacement before scrolling, keeps
  the reading position on failure, and permits retry. A loading/inspection
  block delays scrolling until rows are ready. Clear scroll intent before a
  programmatic jump. Do not reintroduce idle fetching.
- `LogRangeFooter` shows the actual loaded count and first/last timestamps.
  Partial pages say **More logs remain in range**; completed latest queries say
  **Reached end of range**. Selected range is retained in the tooltip. The
  5,000-row retention notice refers to loaded rows, not globally latest logs.
- Regression: the newest-page test failed before the fix (old IDs 1–3 instead
  of 59997–59999); it now succeeds while underlying DESC `hasNextPage=true`.
  Coverage includes fixed ranges, first/last navigation, scope changes,
  failed requests, inspection pauses, precision, retention and manual loading.
- Browser: actual RawLogTable inside SnapGridLayout at localhost:8773, synthetic
  million-record range with 80 rows per visible page. Latest action reached
  record 1,000,000 at scroll gap 0; earliest action returned to offset 0. Idle
  for 10 seconds did not increment the load counter. Keyboard activation,
  inspection blocking, light/dark themes, and zero tile drags verified.
  Fixture request latency/data are simulated; hook tests mock the query layer.
  No authenticated production ClickHouse query or deployed interaction was
  exercised for this change.
- Source: dirty root `hyperdx` checkout on `stg`, HEAD `dbc210fb`; release patch
  is relative to `/tmp/hyperdx-custom40-context`, not the old checkout HEAD.
  Graph generation 2026-09-12T09:19:01Z was stale; graph metadata-changed,
  excluded and untracked paths were verified through current source reads.
  Evidence and source patch: `output/latest-log-navigation/`.
- Subsequently deployed to staging as custom.41 at Helm revision
  `55584f74445d45b1502fa181f222e239c839e381`, built from the custom.40 snapshot
  plus the seven verified files. Image digest
  `sha256:63136e10e0a0ef4814ec460fab000f8945a6b8d3f29d864b58a9b8b4511e3e3f`.
  Argo CD Synced/Healthy/Succeeded; pod
  `hyperdx-servers-sre-stg-clickstack-app-848d7d6d96-8xh2n` ready, zero restarts.
  API/login/assets returned 200, and ingress bundle hash matches the new pod.
  Read ingress IP dynamically: staging ingress reported `10.1.166.13` this
  time; do not reuse old verification-script IPs. Authenticated staging browser
  interactions were not repeated because workstation HTTPS access timed out.
  Deployment evidence: `output/latest-log-navigation/deployment.json`.
  Production was not changed.

## Loaded-log edge navigation — 2026-09-17

- Added `LogScrollButtons` to the chronological summary toolbar in
  `DBRowTable.tsx`: Go to top / Go to bottom, with accessible names/tooltips.
- Navigation affects loaded rows only. `useLogScrollLoad.cancelIntent` clears
  recent wheel/touch/scrollbar intent before a programmatic move, preventing a
  jump to the bottom from becoming a query. Normal explicit loading still uses
  the existing footer/downward gesture.
- Bottom navigation settles after virtual row measurements change. Its bounded
  animation-frame corrections stop at a stable bottom, cancel on new user input,
  and clean up on unmount. No smooth scrolling or background follow is enabled.
- Local browser: top scroll offset 0; bottom gap 0; Available 80 / Displayed 80 /
  Loads 0 throughout both jumps. Expanded final-row navigation also reached gap
  0 with no fetch. Keyboard Enter and both themes verified; dashboard tile drag
  count stayed 0. Preview uses actual RawLogTable inside SnapGridLayout with
  generated data, not authenticated backend queries.
- 36 tests across 4 related suites passed, app TypeScript passed, scoped runtime
  lint has no errors (10 warnings). Screenshots and patch:
  `output/log-edge-navigation/`. Subsequently deployed to staging as custom.40
  at Helm revision `92abdbad7fc5716f37c58031991238d868570b88`.
  Argo CD Synced/Healthy; operation Succeeded; pod
  `hyperdx-servers-sre-stg-clickstack-app-5db54c694c-g9gzq` ready, zero restarts.
  API health, login and frontend assets returned HTTP 200 through ingress;
  served asset hash matches the new pod and includes both navigation buttons
  and the explicit-loading footer. Authenticated staging browser interactions
  were not repeated. Evidence: `output/log-edge-navigation/deployment.json`.
  Production PR #974 was updated by the user to custom.40 and merged at
  `3a9f5de01068a3c88dfe2914806f0b4152bffa95`. Production subsequently synced to
  that revision: Argo CD Synced/Healthy, operation Succeeded; both custom.40
  replicas ready with zero restarts. API/login/assets returned HTTP 200 on both
  replicas and through ingress; frontend hashes match staging. The workstation
  public URL timed out, so authenticated production interactions were not
  exercised. Evidence: `output/log-edge-navigation/production-deployment.json`.

## Explicit scroll loading and selected-range coverage — 2026-09-17

This supersedes the automatic bottom-follow behavior below. Source baseline:
staging custom.38 (`/tmp/hyperdx-custom38-context`), with changes in the root
working checkout. Subsequently deployed to staging as custom.39; see below.

- User reports: idle at bottom still refreshes; missing one-row range/action
  footer; selected range starts 21:03 but first displayed row starts 21:29.
- Confirmed causes: the initial DESC snapshot stopped at the first nonempty
  page; the hook appended automatically when the parent clock advanced;
  table mount/postfetch/layout scroll paths requested additional pages.
- `useLiveLogQuery` now starts ASC at the selected beginning and stops after a
  nonempty page. An explicit request advances one page, retry, or newer time
  interval. Empty windows can be traversed within that request. Per-mount
  query identity prevents cached later pages from replacing the first page
  on reopening. Completed cursors advance only after an interval is exhausted.
- `RawLogTable.loadOnScroll` uses `useLogScrollLoad` to distinguish downward
  wheel/touch/keyboard/scrollbar intent from layout scroll events. Being at
  the bottom is not an instruction to fetch. Footer activation is a keyboard
  accessible alternative. Inspection blocks loading; a new investigation
  resets the scroll position, while ordinary appends preserve it.
- `DBSearchPage` disables its log-search background range timer, including a
  queued visibility refresh. Histogram and sidebar queries therefore don't
  repeatedly run solely because the reader stays in Live mode.
- `LogRangeFooter` sits after virtual bottom padding. It shows the selected
  range and a load/check/retry action; completed checks beyond the selected
  end are identified separately. It measured 39px, equal to normal log rows
  at the fixture's default font size. Details remain expandable.
- Tests cover first ASC page, empty windows, idle behavior, explicit retries,
  remount cache isolation, precision/deduplication, paused results, bounded
  retention, pointer release outside the table, touch, keyboard and momentum.
- Browser evidence uses the actual table inside `SnapGridLayout`, generated
  events, and an explicit simulated-arrival control. Available events rose
  80→81 while displayed stayed 80 and request counter stayed 2; pressing End
  at the bottom displayed 81 and incremented the counter once. No changes
  occurred afterward while idle. These are local fixture results, not a
  claim that the deployed authenticated search was exercised.
- Evidence: `output/scroll-load/` (screenshots, test/lint/typecheck logs and
  patch). Staging custom.39 was deployed at Helm revision
  `510f8e3267e5acfcfb65ecdf92651c36d4ea5455`. Argo CD is Synced/Healthy,
  operation Succeeded; pod `hyperdx-servers-sre-stg-clickstack-app-5b7f4cb46c-qm86c`
  is ready with zero restarts. Runtime version, API health, login, and served
  frontend assets were verified through the cluster ingress. The new footer is
  present in the served bundle. Workstation access to the staging URL timed out,
  so authenticated staging interactions were not exercised. Evidence:
  `output/scroll-load/deployment.json`. Production was not changed.
- Boundaries: the five-second late-arrival overlap and 5,000-row live buffer
  remain. Uniquely ordered backend pagination is not established for sources
  without stable tie-breakers. Ordinary monitoring-dashboard refresh timers
  are separate from the full Search dashboard path verified here.

## Chronological live logs and bottom following — 2026-09-17

- User scope: newest logs at the bottom; pause while scrolling away or inspecting a log/trace; resume by returning to the bottom. Omit top-edge history loading and “Jump to latest”. Remove the Search refresh-interval selector. Deploy staging only.
- `DBSearchPage` normalizes timestamp-sorted log searches (including saved defaults) to ASC. Non-time custom sorts and trace ordering stay unchanged. The top interval selector is removed; the internal refresh cadence remains.
- `DBRowTable` uses `useLiveLogQuery` for chronological live logs. The initial query gets the latest snapshot; subsequent batches walk forward from the completed cursor, with five seconds of overlap and at most one minute per catch-up interval. The cursor advances only after every page completes. Failed intervals are retried without advancing.
- `useOffsetPaginatedQuery` previously combined a five-page Live cap with offsets calculated from retained pages. The new log path disables that cap for a batch, retains at most 5,000 displayed rows, and expires inactive batch caches after 30 seconds. The UI identifies when older buffer rows have been trimmed. Historical searches remain available; live overlap cannot guarantee detection of events arriving more than five seconds late.
- `RawLogTable` follows the bottom after virtualized row measurement, using ResizeObserver. Scroll-away pauses; reaching the bottom resumes when no inspection is open. `DBSqlRowTableWithSidebar.inspectionActive` covers both row details and the independent trace drawer; inline expansion also pauses. Manual Live-off holds the existing buffer until the range changes.
- `useExpandableRows` now notifies its parent after state commits, rather than calling a parent state setter inside its own updater. The browser exposed the previous React warning during expansion.
- Verified locally: actual RawLogTable inside SnapGridLayout, both themes, bottom arrival, append, scroll-away stability, bottom resumption, expanded-row stability, and direct trace opening. The trace preview uses the real drawer with a source-selection empty state, not a live trace backend. No console errors remained.
- Automated verification: 164 targeted tests and app TypeScript passed. Scoped runtime lint passed with warnings. Repository-wide `yarn lint:fix` ran in an isolated source copy; its remaining error is the pre-existing parent-relative import in `useLastSuccessfulQueryTime.test.tsx`.
- Staging custom.38 deployed at Helm revision `b3425878ef061e46eb81c0cf7a8ba1f8491bffda`; Argo CD Synced/Healthy, replacement pod ready with zero restarts, API/login/assets HTTP 200 and served bundle matches the build. Evidence: `output/bottom-follow/deployment.json`. Authenticated staging interactions were not exercised; those were verified locally. Production deployment is not part of this request.

## Direct trace action on log rows — 2026-09-17

- Request: open trace details from a collapsed log row, without visiting Service map.
- `DBRowTable.useConfigWithAdditionalSelect` projects the configured trace expression and timestamp aliases independently of selected summary fields. Conventional trace roots are included by `summaryProjection`; custom field input is never interpolated as SQL.
- `RawLogTable` supplies `LogRowTraceButton` through `LiveSummaryContent.traceAction`. The icon sits after selected chips and before the message. Missing/zero trace IDs or invalid timestamps produce no button.
- Reuse `getLogTraceContext`, `resolveRowTimestampAnchor`, and `getRowLookupWindow`. Composite timestamp keys must use the highest-precision returned DateTime field, not a leading Date partition column.
- `DBSqlRowTableWithSidebar` resolves the log's linked trace source and owns `DirectTraceSidePanel` state. This keeps an open trace stable when live results replace or reorder its originating row. No per-row trace-existence request is issued.
- The button uses `ActionIcon`, an accessible “View trace” name, click propagation suppression, and `data-dashboard-no-drag`. Mouse, Enter, and Space must open the trace without expanding the row or dragging the tile.
- Local browser verification: rebuilt `preview-log-summary.cjs --dashboard-table --build-only`, reloaded port 8773, exercised the actual RawLogTable inside SnapGridLayout and the actual DirectTraceSidePanel. Both themes, Escape, keyboard opening, and live-refresh persistence passed; row expansion and tile drags remained zero.
- The preview intentionally has no trace backend and verifies the real source-selection empty state. Live trace retrieval was not tested. Staging custom.37 was subsequently deployed and its pod/API/frontend verified; see `output/direct-row-trace/deployment.json`. Production PR #973 remains gated by review unless that evidence file has been updated.
- Automated verification: 55 tests across LogRowTraceButton, summaryProjection, DBRowTable, DBRowTable.traceProjection, DBSqlRowTableWithSidebar, and DirectTraceSidePanel; app TypeScript and scoped ESLint/stylelint passed (existing lint warnings remain).
- Screenshots: [dark](../output/ui-preview/direct-trace-dark.png), [light](../output/ui-preview/direct-trace-light.png). Preview: http://127.0.0.1:8773/.

This document records observed behavior, not assumptions from component names.
Read it before repeating an interaction audit. Follow the links to current source
and rerun the named flow; prior evidence is not proof of a later deployment.

## Add fields does not close inside dashboard tiles — 2026-09-17

**Root cause:** Dashboard chart content and toolbars stopped `mousedown` to
prevent tile dragging. Mantine 9 listens for outside `mousedown`/`touchstart` on
the document in the bubble phase. The dashboard intercepted those events, so
uncontrolled Popover state never received the dismissal signal.

### Reproduction and evidence

- Production image: `hiakki/hyperdx:2.38.0-custom.33`; Helm merge
  `f3c6784923b8f8d67fc1e49ab08ff774be455db6`.
- [Request Investigation dashboard](https://hyperdx.platform.prd.msgsndr.net/dashboards/8da8d7cbb9ebeb140a048e6f): open **Add fields**, click the table header outside the menu. The menu remains visible after two seconds. Clicking the dashboard heading outside the tile closes it.
- [Production failure screenshot](../output/add-fields-dashboard-stuck.png).
- The Search page and full-search Logging Dashboard close correctly on ordinary
  outside clicks. The earlier standalone-table test passed but missed the grid
  container. Do not generalize it to all dropdown placements.
- Browser DOM inspection identified the actual chart-content ancestor handler:
  `function ic(e){return e.stopPropagation()}`.

### Component map and fix

| Surface / responsibility | Source |
| --- | --- |
| Add fields trigger and Popover | `packages/app/src/components/DBRowTable.tsx` (`RawLogTable`) |
| Check, reorder, remove, autocomplete | `packages/app/src/components/LogSummaryDemo/SummaryFieldPicker.tsx` |
| Chart body, toolbar and tile action menu | `packages/app/src/DBDashboardPage.tsx` |
| Collapsed action menu | `packages/app/src/components/charts/ChartContainer.tsx` |
| Shared grouped/ungrouped grid and drag exclusion | `packages/app/src/components/dashboard/SnapGridLayout.tsx` |
| Expanded log details and service-map embedding | `packages/app/src/components/InlineLogDetails.tsx` |

Replace the chart-body/toolbar/menu mouse stoppers with
`data-dashboard-no-drag`. `SnapGridLayout` combines that selector with the
caller's `draggableCancel` and `[data-portal]`. This prevents chart interactions
from starting a drag while allowing outside-click events to reach dropdowns.

**Portal trap:** React events from a portaled menu bubble through the owning
tile, although its DOM is outside the chart-body marker. Without `[data-portal]`,
adding a field started two tile drags in the local browser. The selector prevents
that regression; custom-target portals within the marked chart body are already
excluded by its ancestor. Test any new custom portal target separately.

**Test trap:** MantineProvider `env="test"` disables portals. The regression now
uses real portals and only disables transition/layout hiding for jsdom. It
asserts that the floating picker is outside the chart-body DOM marker.

### Regression and verification

`packages/app/src/components/__tests__/DBRowTable.dismissal.test.tsx` mounts the
actual `SnapGridLayout`, `RawLogTable`, and picker. API/source identity and layout
measurements are fixtures. It covers outside dismissal in expanded rows,
no accidental grid drag, nested autocomplete and selection persistence, caller
drag exclusions, and header dragging. Both the missing drag exclusion and the
missing portal exclusion were observed failing before correction.

```bash
cd packages/app
yarn jest src/components/__tests__/DBRowTable.dismissal.test.tsx --runInBand --coverage=false
```

Repeatable browser fixture using actual grid/table components and sample logs:

```bash
node packages/app/scripts/preview-log-summary.cjs --dashboard-table
# Rebuild files served by an already running preview without restarting it:
node packages/app/scripts/preview-log-summary.cjs --dashboard-table --build-only
```

Open `http://127.0.0.1:8773/`. Expand a row, open Add fields, select a suggestion,
add/reorder/remove it, click chart content, reopen, and press Escape. All those
interactions must keep **Tile drags: 0**. Dragging the tile header must increment
the counter. Check both dark and light modes using `?colorMode=light`.

Verification status: production failure reproduced; fixed grid/table fixture
verified locally. **Deployed to staging as custom.34 on 2026-09-17.** Argo CD
is Synced/Healthy at Helm commit `245b4c3b41b0caba1f2a240f01b47b9ed2bb921d`;
pod `hyperdx-servers-sre-stg-clickstack-app-677d6b8cb4-9lxsk` is ready with zero
restarts. The new pod reports `CODE_VERSION=2.38.0-custom.34`; API health and
frontend login return HTTP 200. The staging public URL timed out; a Kubernetes
port-forward reached the login page, but the authenticated session expired.
The deployed dashboard interaction remains unverified pending user sign-in.

Production promotion is prepared in Helm PR #967:
https://github.com/GoHighLevel/platform-infra-helm-charts/pull/967.
The ordinary merge was rejected because main requires an approving review.
Production remains on custom.33 pending approval/merge; do not bypass the rule.
Pod readiness, HTTP 200, and matching bundles prove deployment health/artifact
identity, not the affected UI interaction.

Release artifact: `hiakki/hyperdx:2.38.0-custom.34`, index digest
`sha256:aa77b617fd05db1071aa4f37890680479db1362ebe77056587e9239b0f91eb0c`.
Built from `/tmp/hyperdx-custom33-context` with only the three production-file
changes in `/tmp/hyperdx-dashboard-dismissal.patch`; the build preserves the
snapshot's additional monitoring fixes absent from the root checkout.
Manifest: `/tmp/hyperdx-custom34-source-manifest.json`.
Source patch committed and pushed to application `stg` at `469f24dc`.
Build log: `/tmp/hyperdx-custom34-build.log`.

Final checks: **47 tests across five suites passed**; app TypeScript passed;
targeted ESLint had zero errors and ten warnings (eight in existing dashboard
code, two fixture type assertions). Repository-wide formatting and full
authenticated local-app E2E were not run; the root contains unrelated changes.
The rebuilt grid/table browser fixture passed in dark and light mode, with zero
console errors. Add/select/reorder/remove and outside dismissal left the drag
counter at zero; a deliberate header drag incremented it to one. Escape closed
the picker from its input.

- [Fixed dark-mode fixture](../output/add-fields-dashboard-fixed.png)
- [Fixed light-mode fixture](../output/add-fields-dashboard-fixed-light.png)
- [Test output](../output/hyperdx-dashboard-dismissal-tests.log)
- [TypeScript output](../output/hyperdx-dashboard-dismissal-typecheck.log)
- [Lint output](../output/hyperdx-dashboard-dismissal-lint.log)
- [Missing grid exclusion — failing test](../output/dbrow-dismissal-grid-before.log)
- [Missing portal exclusion — failing test](../output/dbrow-dismissal-realportal-before.log)

### Boundaries and remaining checks

- This entry does not claim every UI dropdown was browser-tested.
- Heatmap context-popover backdrop/own click suppression is a separate behavior;
  the deliberate overlay handlers were retained.
- React Flow may stop events on its own canvas. The reported screenshot showed
  the no-services area; a populated interactive canvas requires its own test.
- Preserve existing source differences. The root development checkout is dirty;
  the deployed custom.33 source snapshot is `/tmp/hyperdx-custom33-context`.
  `/tmp/hyperdx-dropdown-release` lacks custom summary components, so it cannot
  stand in for the deployed UI. Compare exact files/hashes before release.
- The structural graph generation checked was `2026-09-12T09:19:01Z` (fast).
  DBRowTable/DBDashboardPage were changed; SummaryFieldPicker was untracked.
  Source fallback was required. The graph does not prove behavioral coverage.

## Installed workflow

- Shared skill: `~/.agents/skills/hyperdx-ui-regression-memory/SKILL.md`.
- Agent profile: `~/.agency-agents/testing/testing-hyperdx-ui-regression.md`.
- Debugging/testing skills: `systematic-debugging`, `test-driven-development`,
  `verification-before-completion`; installed for Codex and Claude Code.
- The project AGENTS.md and codebase-memory ADR link here so future sessions can
  retrieve the evidence without reconstructing conversation history.
