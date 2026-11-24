---
'@hyperdx/app': patch
'@hyperdx/common-utils': patch
---

Use type-aware existence checks for numeric, boolean and timestamp fields, and
preserve Float32 precision when fetching expanded log details.

Add bare Lucene HTTP status-class shorthand (`http_status>500` means 500–599,
and `http_status>403` means 403–499), covering status codes 100–599. Quoted
text, explicit field scopes, colon comparisons and SQL mode retain existing
semantics. Offer cached schema columns in Lucene autocomplete while nested field
discovery is still loading.
