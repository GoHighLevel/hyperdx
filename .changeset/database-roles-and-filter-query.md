---
'@hyperdx/api': minor
'@hyperdx/app': minor
'@hyperdx/common-utils': patch
---

Store admin membership in MongoDB, manage roles in Team settings, and make the
first setup account an admin. Import existing configured admins once and protect
the last admin during concurrent role changes.

Show sidebar selections as editable query text, preserving query precedence and
avoiding duplicate filters after manual edits. Support literal dotted JSON keys
and numeric JSON ranges in copied Lucene queries.
