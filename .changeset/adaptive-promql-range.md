---
'@hyperdx/app': patch
---

Calculate PromQL Auto intervals from the selected range so long-range metric
dashboards stay within query resolution limits. Preserve saved panel intervals
under dashboard Auto and explicit dashboard/fullscreen overrides. Explain
oversized explicit-resolution requests before sending them to the backend.
