# Custom access and filters

This fork has two roles. Developers can query all data available to their team,
read shared dashboards/searches/alerts, use favorites, rotate their own API key,
and update their personal filter preferences. Admins also manage connections,
sources, users/invitations, shared dashboards/searches, alerts, webhooks, shared
pins, and team settings. Existing saved searches remain shared and can only be
changed by admins.

## Before deploying the custom image

Set `HYPERDX_ADMIN_EMAILS` on the API/fullstack container to the exact login email
addresses of your existing admin accounts, separated by commas:

```yaml
HYPERDX_ADMIN_EMAILS: "your-sre-account@example.com,another-admin@example.com"
```

Replace the example addresses. Matching is case-insensitive; wildcards and email
domains are not supported. An empty list grants **no admin access**, including
to existing users. Configure it before rollout. Changing the list requires
rolling out the API containers. Role assignment is managed in deployment
configuration; there is no role editor in the UI.

Build your fullstack image using the existing `docker/hyperdx/Dockerfile`, publish
it to your registry, and update the staging Helm image repository/tag to that
image. The upstream `2.38.0` image does not contain these changes. This repository
change does not deploy to Kubernetes or modify ClickHouse credentials.

The session API, personal API keys, and MCP enforce the same management boundary.
The developer ClickHouse proxy forces `readonly=2`; use read-only ClickHouse
connection credentials as the database-side boundary too. No service/namespace
row restrictions are introduced. Auth-disabled local mode remains a single-user
mode and must not be used for a shared deployment.

## Personal filter behaviour

The default sidebar fields are `namespace_name`, `deployment_name`, `pod_name`,
and `log_level`, when present in the source. The list is defined once in
`packages/app/src/components/DBSearchPageFilters/personalFilterDefaults.ts`.
Admins can also curate shared pins through the existing pin menu.

**Add filter** opens the remaining fields with a search box. Using an include,
exclude, or range filter remembers the field in that user's sidebar. Active
values remain part of the current URL/query, not automatically saved defaults.
Explicit value pins remember suggestions without applying a filter.

Personal pins are stored in MongoDB's `personalpinnedfilters` collection with a
unique `(team, user, source)` index. Account/source IDs come from the authenticated
session and source ownership check. The existing shared-pin collection and its
index are unchanged; no database migration is required.

Old browser-only pins are not imported automatically because their storage key
did not identify the account that created them. Re-pin fields once after rollout.
Auth-disabled local mode continues to store personal pins in its browser.

## Developer log view

Developers use the existing search page with the source/SELECT/ORDER BY and
save/alert configuration toolbar hidden. Shared source or saved-search column
defaults determine the result layout. Admins retain those controls. Developers
can still open shared searches and query all team logs; this is not row-level
data access control.

The sidebar omits chart and column actions for developers. Its values always
follow the current search and time range. Admins can opt into the existing
"Show all values" behavior. Filtering a field in expanded JSON immediately
remembers it personally, including extracted fields absent from sampled metadata.
Field labels are readable paths; the underlying ClickHouse expression remains
intact for querying. Pins persist in MongoDB; active filter values stay in the URL.

Both SQL and Lucene search inputs retain multiline height after Run or blur.
Long queries scroll inside the editor. Clicking a result expands its existing
inline details; dragging to select text does not toggle the row. Log details in
the developer view open directly as structured JSON, including valid JSON stored
inside strings. Non-JSON text is preserved. Explicit sidebar links remain
available for trace investigation and deep links.

User preferences include log font sizes of 12, 14, 16 or 18px (default 14px),
applied to rows and expanded JSON. Like the existing appearance settings, font
size is stored in the browser; it does not synchronize across devices.

### Mixed Fluent log formats

For sources containing a `log` column, the developer view replaces plain
`log`/`log_message` selections with one **Message** column. It uses the existing
`log_message`, then JSON `message`, `msg`, `body`, and finally raw `log`.
The standard `log_level` selection uses stored severity, then JSON `level`,
`severity` or `severityText`; absent severity is shown as **unknown**. Its
**Level** sidebar filter uses the same expression. Explicit custom admin
expressions and other source schemas retain their configured behavior.

These are read-time fallbacks, not an ingestion migration. A read-only inspection
of staging confirmed that `log_message` is defined as
`JSONExtractString(log, 'message')`, explaining blanks for `msg` and plain-text
producers. Raw SQL against the stored `log_level`/`log_message` columns still
returns the original values. No live source, table or collector configuration
was changed.

## Focused verification

Use Node 22.16+ and Yarn from `package.json`. Run `yarn install --immutable` and
`yarn build:common-utils`, then:

```bash
yarn workspace @hyperdx/api ci:unit permissions --runInBand --coverage=false
yarn workspace @hyperdx/app ci:unit usePersonalPinnedFilters pinnedFilters --runInBand --coverage=false
yarn workspace @hyperdx/app ci:unit HyperJson DBSearchPageFilters SearchWhereInput readableLogColumns DBRowTable useUserPreferences DBRowJsonViewer --runInBand --coverage=false
```

`accessControl.int.test.ts` tests real password sessions, bearer keys, admin-only
writes, two developers, a second login session, source isolation, and ownership
injection. It needs a disposable MongoDB database named `hyperdx_rbac_test` or the
standard `hyperdx-test`; it clears that test database before running. It does not
need ClickHouse or the collector.
