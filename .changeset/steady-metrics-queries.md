---
'@hyperdx/api': patch
'@hyperdx/app': patch
---

Bound metrics query concurrency, propagate chart cancellation, reject incomplete
VictoriaMetrics results, and allow operators to route saved Prometheus
connections to a native backend with coordinated request deadlines.
