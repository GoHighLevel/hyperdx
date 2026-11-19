# Shared dashboard folders

Implemented and verified locally on 17 September 2026. Deployed to staging as `2.38.0-custom.35` on the same date. Production has not been updated with this feature.

## Permissions

| Location | View | Create, edit, import, move, delete dashboards | Rename folder |
| --- | --- | --- | --- |
| Admin-created folder | Everyone on the team | Admins | Admins |
| Developer-created folder | Everyone on the team | All developers and admins | All developers and admins |
| General (existing unfiled dashboards) | Everyone on the team | Admins | Built-in location |

Folder access is assigned by the server from the creator's role, not from a client-supplied permission. Renaming a folder does not change its access. A developer cannot move a dashboard into or out of an admin folder. Every lookup is scoped to the authenticated team.

## Using folders

1. Open **Dashboards → New folder** and name the folder.
2. Select the folder, then choose **New Dashboard** or **Import**. The folder picker offers destinations the user can write to.
3. Open an editable dashboard and use **Move to folder** to move it. Use the pencil on a folder to rename it.

## List moves and bulk organization (staging custom.36)

The dashboard list now exposes **Move** on every editable dashboard in both grid and list views. Check individual dashboards or **Select all shown**, then choose **Move selected**. Pick a destination or create one with **New folder** inside the dialog. General is an explicit admin-only destination. Changing the folder, tag or name filter clears selection so hidden dashboards are not moved accidentally.

Moves PATCH only `folderId`, preserving dashboard IDs, links, panels and saved settings. Requests run sequentially. Partial failures name the dashboards that failed and retry only those dashboards; successful moves are not repeated. Existing server permissions apply to every request, including permission changes while the dialog is open. No automatic migration or dashboard recreation occurs.

Local verification: admin moved two existing dashboards into a newly created folder, moved one back through the list action, confirmed persisted IDs and Markdown content, and checked selection reset. A developer saw all dashboards but no Move action on the admin-owned dashboard, and only collaborative destinations in the picker. Grid checkboxes and Move buttons did not navigate away. The table's measured scroll width matched its width (950 px). Unit checks cover partial failures/retries, explicit destination selection, General, developer destination restrictions, inline folder creation and card navigation.

![Select existing dashboards and move them together](assets/dashboard-folders/bulk-move-list.png)

![Choose or create a destination without leaving the move dialog](assets/dashboard-folders/bulk-move-dialog.png)

This extension was deployed to staging as custom.36 on 17 September 2026. Its incremental patch is `output/dashboard-folders/dashboard-moves.patch`, applied on top of the custom.35 source snapshot. Do not substitute the older custom.34 snapshot for this extension.

Deployment verification: Helm staging commit `b9e03be6ef7e39618c37fc4ce2ada2651b81cd3e`; Argo `hyperdx-servers-sre-stg` Synced/Healthy, operation Succeeded at that revision. Pod `hyperdx-servers-sre-stg-clickstack-app-864fb7877d-r5l52` ready with zero restarts, running digest `sha256:cac3c96eacfedd268de70826f81f4db6b923c590fb0fd7c59649247f6797da48`. API health and frontend login returned 200; the folder API returned 401 without authentication. Public dashboard JavaScript contains Move selected, New folder and Retry failed moves. The staging browser session had expired, so authenticated staging move operations were not repeated. Local real-browser moves and 24 tests passed before deployment. Build log: `/tmp/hyperdx-custom36-build.log`; rollout evidence: `output/dashboard-folders/staging-bulk-moves-deployment.json`.

This version supports one level of folders and folder renaming. It does not include nested folders or folder deletion. No existing dashboard is automatically moved. Admins can move existing dashboards into developer folders to enable collaboration.

Exports omit the installation-specific folder ID; imports select a destination folder. Machine-provisioned dashboards remain protected from developer writes. Alert administration, source administration, and Terraform controls remain admin-managed.

## Verified behavior

The real local Next.js app at `http://localhost:18306` uses the compiled API and an isolated MongoDB database (`hyperdx_folder_demo`, port 27028). All screenshots contain synthetic test accounts and dashboards.

| Check | Result |
| --- | --- |
| Developer creates a folder and a dashboard through the UI | Passed |
| Developer edits dashboard name and Markdown panel, then reloads persisted data | Passed |
| Developer moves a dashboard between two developer folders | Passed |
| Move picker excludes admin folders | Passed |
| Second developer edits the first developer's dashboard and renames their folder | Passed |
| Admin edits a developer's dashboard and renames an admin folder | Passed |
| Developer opens an admin dashboard: no edit, add-panel, or move controls | Passed |
| All team dashboards, including admin dashboards, remain visible | Passed |
| Developer imports JSON through the file upload and destination picker | Passed |
| Authenticated API permission regression suite | 18 tests passed |
| Dashboard import regression suite, including developer folder selection | 18 tests passed |
| API and app TypeScript checks; common-utils and API builds | Passed |
| Scoped ESLint | Passed with warnings, no errors |

The API tests cover forged folder access, duplicate names, cross-team writes, legacy unfiled dashboards, collaboration between two developers, and denied writes after an admin moves a dashboard to a protected folder. Developer updates/deletes also constrain the folder in the database mutation to prevent a concurrent move from bypassing authorization.

The test API suite reports an existing open-handle warning after passing. The local telemetry source is a fixture; Markdown panels were used for panel editing. The production API/frontend image build subsequently passed for the staging release. Authenticated staging browser checks and live telemetry validation have not been performed for this feature because the public staging URL timed out from the verification connection.

## Staging deployment

- Image: `hiakki/hyperdx:2.38.0-custom.35`.
- Registry and running-pod digest: `sha256:25a4e75b96e2ca86efa0710827fe82f0003ca548ef6715ceb66c0c7e9ea669b4`.
- Helm `stg` commit: `de02f257ef013e8467ab5e755759257c85ce6b17`.
- Argo application: `hyperdx-servers-sre-stg`, **Synced / Healthy**, sync succeeded at that commit.
- Pod: `hyperdx-servers-sre-stg-clickstack-app-56779b8555-qcsxr`, ready, zero restarts.
- Pod-local checks: API `/health` **200**, frontend `/login` **200**, API `/dashboard-folders` **401** without authentication. The compiled folder router is present and `CODE_VERSION` is `2.38.0-custom.35`.
- The Argo web endpoint timed out; refresh and normal sync were submitted through the Argo Application resource in `argocd-platform-stg`. Sync retained server-side apply and did not enable pruning or force replacement.
- Release source: `/tmp/hyperdx-custom35-context`, built from the custom.34 snapshot plus the isolated folder patch. Exactly 27 expected files changed; no baseline files were removed.
- Build log: `/tmp/hyperdx-custom35-build.log`. Machine-readable rollout evidence: `output/dashboard-folders/staging-deployment.json`.

### Developer dashboard list

![Admin folders are readable; developer folders can be renamed and edited](assets/dashboard-folders/developer-folders.png)

### Developer move picker

![Only developer folders are offered as writable destinations](assets/dashboard-folders/developer-move-picker.png)

## Implementation map

- `packages/common-utils/src/dashboardFolders.ts`: folder schema and access predicate.
- `packages/api/src/models/dashboardFolder.ts`: folder ownership, access and per-team unique name.
- `packages/api/src/routers/api/dashboardFolders.ts`: authenticated list/create/rename routes.
- `packages/api/src/controllers/dashboardFolders.ts`: target-folder authorization.
- `packages/api/src/routers/api/dashboards.ts`: dashboard-level authorization for all mutations.
- `packages/app/src/dashboardFolders.ts`: folder queries and dashboard edit permission.
- `packages/app/src/components/Dashboards/`: folder navigation, create dialog, folder selector and move dialog. `DashboardsListPage.tsx` owns visible selection and list actions; `MoveDashboardsDialog.tsx` shares single/bulk moves and retry state; `MoveDashboardButton.tsx` reuses that dialog inside a dashboard.
- `packages/app/src/DBDashboardPage.tsx`, `DBSearchPage.tsx`, `DBDashboardImportPage.tsx`: editing, saved search dashboards and import integration.

The graph generation was dated 12 September and does not fully represent these new/changed paths; current source and executable checks were used. Keep future folder permission changes covered by the authenticated API tests and real create/edit/move/import browser flows.

## Release preparation

The workspace contains unrelated earlier changes. A task-only patch is saved in `output/dashboard-folders/shared-dashboard-folders.patch`; it was checked against `/tmp/hyperdx-custom34-context`, the deployed source snapshot. Use that snapshot plus this patch for the next release so the existing monitoring fixes are retained.

After preparing a clean feature checkout containing only the reviewed changes:

```sh
git add .
git commit -m "feat: add shared dashboard folders with role-based editing"
git push -u origin HEAD
```
