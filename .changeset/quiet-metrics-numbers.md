---
'@hyperdx/app': patch
---

Evaluate PromQL number tiles once at the selected end time instead of fetching
the full time series and displaying its first value. Preserve dashboard variable
lookbacks and isolate number results from time-series query caches.
