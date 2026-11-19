---
'@hyperdx/app': patch
---

Keep correlated logs visible in the trace waterfall when their spans are
missing, including logs without a span ID. Explain when only logs were found
instead of showing a misleading empty trace.
