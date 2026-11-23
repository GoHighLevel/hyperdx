---
'@hyperdx/app': patch
'@hyperdx/api': patch
'@hyperdx/common-utils': patch
---

Load keyword-search histograms in bounded windows, avoid tiny sequential windows for exact IDs, and inspect bounded field distributions without a preliminary full-range count. Add independent summary-field actions, authenticated expiring short log links and paused defaults for fresh searches while preserving explicit live URLs and the existing developer search features.
