---
'@hyperdx/api': patch
'@hyperdx/app': patch
---

Bound metrics query concurrency, propagate chart cancellation, reject incomplete
VictoriaMetrics partial results when exposed by the upstream, and make request
deadlines configurable while preserving the saved Prometheus connection route.
