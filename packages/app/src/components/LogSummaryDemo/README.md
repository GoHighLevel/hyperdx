# Summary row preview

Open http://127.0.0.1:8768 while the preview server is running. To start it
again:

```sh
cd /Users/akshaygupta/Documents/work/hyperdx
node packages/app/scripts/preview-log-summary.cjs
```

This standalone React preview uses synthetic events and the existing HyperDX
theme, severity icons, JSON viewer and clipboard helper. It does not query or
modify either environment. Preferences last for this preview session only.

Try these flows:

- Selected fields appear first in Add fields. Use their up/down arrows to
  reorder them; chips and sidebar groups immediately follow that order. The
  first up arrow and last down arrow are disabled. Newly selected and custom
  fields are appended to the selected list.

- Add fields → select `deployment_name`, `container_name`, `pod_name`,
  `node_name (host)` or `cluster_name`. Missing values leave no blank column.
  Uncheck fields to remove them. Each selected field also appears as a collapsed
  filter group on the left.
- Add a custom field: `log.request_id`. The second event contains this field
  inside a JSON-encoded `log` string.
- Open the second event: its message comes from `log.msg`. Select
  `container_name` for the contacts event: its deployment is blank, but its
  container can be displayed independently.
- Turn wrapping off/on, increase the font size, copy a message and select any
  field chip to filter the sample events.
- Expand an event, then click Add sample log. The open event remains expanded.

## Resolution behavior

The resolver skips null and blank values, preserves zero and false, handles
nested objects, literal dotted keys, flattened payload maps and JSON-encoded log
strings. It does not mutate the raw event.

Message precedence: `log.message`, `log.msg`, payload message/msg, existing
message aliases, then raw `log` and other body conventions. If a raw log object
has no message, its serialized object remains visible. Malformed JSON remains
plain text.

There is no combined Resource Name. Deployment, container, pod and cluster are
independent fields; each accepts equivalent nested/OTel representations without
falling back to a different identity. `node_name (host)` prefers node name
(including OTel k8s.node.name), then host/host.name. Chips show values only;
field names remain in hover tooltips and accessible labels. Nothing is inferred
from pod suffixes.

## Before deployment, after design approval

This preview is intentionally not wired into the live search or dashboard
renderer yet. Integration must retain the existing virtualized table, row
identity, trace/detail actions, personal field preferences and CSV export.

The current `readableLogColumns` SQL helper only applies to developer defaults
when there is no explicit selection. A saved selection such as
`log_message AS Summary` bypasses it. Presentation cannot recover fields that
were not returned by the query. Live integration therefore needs schema-aware
message and selected-field projections, covering explicit aliases and saved
dashboards without referencing columns absent from a source. Validate those
projections against the staging source before deployment; do not fetch every raw
payload or issue a separate request per row just to fill chips.

## Verification

- Seven resolver tests cover message fallbacks, separate identities, node/host
  precedence and raw data preservation.
- Browser: field add/remove, custom field, filter/clear, empty results, keyboard
  expansion, clipboard copy and expansion retained after insertion passed.
- 320px, 768px, 1024px and 1440px: no horizontal page overflow or nested
  vertical scrollbars in expanded details.
- Browser runtime reported no uncaught errors. Sample events, not live
  ClickHouse data, were used. Production-scale rendering, screen-reader
  operation and live query integration were not tested in this preview.
