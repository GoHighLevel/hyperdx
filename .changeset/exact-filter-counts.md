---
'@hyperdx/common-utils': patch
---

Stop applying the metadata sampling row cap to exact filter counts. Preserve
explicit source and server query limits, and fail rather than display partial
counts.
