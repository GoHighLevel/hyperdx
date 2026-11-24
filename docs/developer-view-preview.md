# Preview the developer interface

As an admin, open the user menu at the bottom of the sidebar and select **View
as developer**. The app uses developer UI permissions, including the simplified
search header, personal filters, and read-only shared configuration controls.
Your current search and account are preserved.

The sidebar shows **Viewing as developer** with a **Return to admin view**
button. When the sidebar is collapsed, the eye button performs the same action.
You can also return from the user menu.

Preview persists across navigation and reloads in the current browser tab. It is
scoped to the signed-in user and team. Other tabs are independent. Developers
and unauthenticated local mode cannot enable this preview.

This is a UI preview, not user impersonation or a change to authorization. Your
database role and API permissions remain admin, and personal preferences still
belong to your account. Use a developer account to test server-side
authorization.

## Links from alerts

Append `view=developer` to a search or dashboard URL to explicitly request the
developer interface, including in a fresh browser tab. Service predicates,
selected fields and time-range parameters remain independent. Admins can use
Return to admin view to remove this parameter. This only changes presentation; a
developer account never receives admin permissions.

## Filtered summary fields and progressive results

Including, excluding or isolating a field adds it once to the source-specific
Add fields summary selection. Removing a filter leaves that selection intact;
use the picker to remove or reorder summary fields. JSON and Map paths use the
same summary resolver as manually selected fields.

The log sidebar discovers fields from up to 200 matching records, with a
200,000-row read budget and five-second server execution budget. It preserves
the active predicate and requested time range, and clears discovered fields on a
new query. It is a sample, not an exhaustive inventory or exact count. Admin
Show all values mode retains the source-wide metadata tools. Pinned fields and
manual field selection remain available.

Historical responses display streamed rows before completion. Chronological
navigation previews rows without committing the cursor until the page succeeds.
Pause keeps the inspected snapshot stable. Requests are cancelled when their
query is abandoned, even when a team timeout is configured. Database sorting,
resource limits and time to first server block can still dominate latency; the
frontend does not guarantee immediate rows or unlimited date ranges.

### First-page priority

Timestamp-ordered log browsing starts with up to 50 rows in a 10-second edge window.
Keyword searches retain that preview and widen subsequent empty windows more
quickly. Exact positive quoted trace/request ID searches use a 30-minute first
window; ambiguous or compound alternatives keep the normal path. These are
scheduling choices, not changes to which records match. Keyword histograms use
smaller, granularity-aligned windows and can progress independently of log rows.
Further pages retain the configured page size and continue through the requested
range. A sparse or empty first window does not shorten the selected range.
Counts, histograms, scan estimates and sidebar discovery/counts wait until the
first real rows arrive or an empty page completes, then load independently.
An error in the total-count query displays “Count unavailable”; it does not
remove already loaded log rows. Trace and other analysis modes keep their
existing scheduling. ClickHouse must still produce the first query block:
these UI changes do not guarantee a particular backend latency.

## Add a summary field without filtering

Open a scalar log field and choose **Add field to summary**, alongside the
existing filter, exclude and copy actions. This selects the field in your
source-specific Add fields picker without changing the search. Filtering still
auto-adds the field. Shared columns and other users' preferences are unchanged.

## Inspect a field distribution

Distributions inspect the newest 10,000 matching records by default in one
bounded query, without an upfront count across the entire time range. The UI
shows the inspected record count and earliest/latest inspected timestamps.
Percentages describe those inspected records, not a representative full-range
estimate; rare values can be absent. A resource-limit or query error is shown
as unavailable, not a zero count. Existing exact count controls remain separate.
Source limits can further restrict inspection, and broad sparse searches can
still exceed its bounded read or execution budget.

## Share a frozen log search

Use **Share logs** to copy a short link. It preserves the executed query,
selected source, absolute time range, developer view and selected summary
fields. The recipient must sign in to the same team and retain access to the
source and any linked dashboard. Links expire after 30 days and never grant
additional access. Opening shared fields does not overwrite personal summary
preferences; explicitly editing the selection saves a personal preference.

The separate MongoDB `logshares` collection stores query state and a hash of
the opaque link token, without storing log payloads. Expiry is checked when a
link is opened; the TTL index subsequently removes expired records. Link
creation uses same-origin validation and per-user rate limits. If creation or
clipboard access fails, the original full URL remains available to copy.

## Live updates start paused

Fresh views without an explicit live parameter do not refresh automatically.
Choose the live control to resume updates. Explicit `isLive=true` links still
open live, and choosing a relative time range preserves the current live state.
Shared short links always open a paused, fixed time range.
