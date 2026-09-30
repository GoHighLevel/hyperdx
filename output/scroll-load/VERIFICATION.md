# Log scrolling correction — local verification

Date: 2026-09-17. Baseline: staging custom.38 source snapshot.

Deployed to staging as `hiakki/hyperdx:2.38.0-custom.39`, Helm commit
`510f8e3267e5acfcfb65ecdf92651c36d4ea5455`. Argo CD Synced/Healthy,
operation Succeeded; replacement pod ready with zero restarts.
[Deployment evidence](deployment.json) records image digest, runtime version,
HTTP 200 health/login/assets, and served asset hash verification through ingress.

1. Idle at the bottom previously allowed automatic fetching. Log search now
   loads only on explicit downward scrolling/keyboard input or footer activation.
2. A 39px footer, matching normal rows at the default font size, shows the
   selected range and “Scroll down to load newer logs” or “Scroll down to check
   for newer logs”. It also provides loading, retry, and inspection states.
3. The previous initial query selected the newest page, then displayed it in
   chronological order. The initial query now starts ASC at the selected range's
   beginning. Additional pages load on demand; the entire range is not fetched
   into the browser at once.

## Evidence

- 133 tests passed in 7 suites: [test output](tests.log).
- TypeScript `tsc --noEmit` passed: [output](typecheck.log).
- Scoped runtime ESLint: zero errors, 25 warnings: [output](lint.log).
- Repository-wide `yarn lint:fix` ran in an isolated copy. It failed on an
  existing parent-relative import in `useLastSuccessfulQueryTime.test.tsx`:
  [output](lint-all-final.log). Unrelated autofixes were not copied back.
- Local preview rebuilt and reloaded. Actual RawLogTable rendered inside
  SnapGridLayout, using generated events rather than an authenticated backend.
- Idle test: Available 80 / Displayed 80 / Loads 1 changed to Available 81 /
  Displayed 80 / Loads 1 after a simulated arrival. Explicit End at bottom
  changed Displayed to 81 and Loads to 2.
- Expanded-row test: a simulated arrival plus End left Displayed 80 / Loads 1;
  after closing details, footer activation changed Displayed 81 / Loads 2.
- Browser console: zero warnings/errors. Dark and light modes inspected.
- Query-hook tests cover the initial range, manual pagination, empty windows,
  retries, cached remounts, paused results, and retained-row limits.

![Dark footer](footer-dark.png)

![Light footer](footer-light.png)

## Boundaries

The deployed staging application was verified through Kubernetes and ingress.
Authenticated browser interactions were not repeated because the staging URL
timed out from this workstation. Interaction tests above used the local app.
The five-second late-arrival overlap and 5,000-row retained buffer remain.
Logs arriving later than that overlap may require a historical search.
Generic monitoring-dashboard refresh timers are outside this log-search fix.

[Scoped patch against custom.38](changes.patch)
