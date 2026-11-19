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
