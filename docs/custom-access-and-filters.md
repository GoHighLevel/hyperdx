# Custom access and filters

This fork has two roles. Developers can query all data available to their team,
read shared dashboards/searches/alerts, use favorites, rotate their own API key,
and update their personal filter preferences. Admins also manage connections,
sources, users/invitations, shared dashboards/searches, alerts, webhooks, shared
pins, and team settings. Existing saved searches remain shared and can only be
changed by admins.

## Before deploying the custom image

Users and password hashes remain in MongoDB's existing `users` collection.
Admin membership is stored in `teams.adminUserIds`. Admins manage roles in
**Team settings → Members**, using the role selector beside each account.
Invitations create developers; an admin can promote them after they join.
Role checks read MongoDB on each request, including API keys and MCP requests.
Changing a role requires no restart or new password. The UI refreshes its role
within 30 seconds or on page refresh.

For a fresh installation, the setup page creates the first user as admin. A
unique setup key prevents concurrent registration from creating multiple initial
teams. The API atomically prevents demoting the last admin, including concurrent
demotions. Admin accounts must be demoted before they can be removed.

For an existing team without `adminUserIds`, the legacy `HYPERDX_ADMIN_EMAILS`
allowlist is imported once from existing users. After initialization, MongoDB
owns the roles: editing the environment variable cannot undo UI role changes.
Existing teams are never claimed automatically by the next person who logs in.
If an existing team has no configured admin, seed a verified existing account in
its `adminUserIds` before rollout. Keep the user IDs as BSON ObjectIds.

Build your fullstack image using the existing `docker/hyperdx/Dockerfile`, publish
it to your registry, and update the staging Helm image repository/tag to that
image. The upstream `2.38.0` image and custom `2.38.0-custom.1` image do not contain
this database role-management update. This repository
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

### Filters and the query editor

Checkbox selections and **Filter by this field** appear as editable clauses in
the top query bar. Lucene uses quoted values, OR for multiple included values,
NOT for exclusions, and numeric ranges. SQL mode displays SQL predicates.
An existing custom query is parenthesized to preserve its OR/AND meaning.

Unchecking a selection removes its generated clause. Editing generated text
transfers the displayed clauses into the custom query and clears their separate
checkbox selections, so no hidden duplicate predicates remain. Custom queries
and filters survive URL sharing and reloads. Arbitrary saved SQL predicates that
cannot be represented losslessly in Lucene remain separate, visible filter chips.

Literal dots in JSON keys are escaped: `log.request\.id:"req-123"` reads the
single `request.id` key, while `log.request.id:"req-123"` reads a nested key.
JSON strings support string, numeric and boolean equality, plus numeric ranges.

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
