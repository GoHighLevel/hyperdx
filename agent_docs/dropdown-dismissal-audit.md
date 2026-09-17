# Dropdown dismissal audit

Date: 2026-09-17. Scope: `packages/app/src` and `packages/app/pages`.

## Findings and behavior

- The time picker was controlled by `opened` but only supplied `onClose`. In installed Mantine 9, `onClose` is a state-transition notification; outside clicks and Escape need an `onChange` or `onDismiss` callback to update controlled state. It now uses `onDismiss={close}`, matching [Mantine's controlled-popover guidance](https://mantine.dev/core/popover/#ondismiss).
- The log-field hover action toolbar explicitly disabled outside-click listeners and had no controlled-state dismissal callback. It now retains its hover behavior while closing on outside interaction or Escape from its actions.
- The other nine controlled Popovers already connect `onChange` to state, including search autocomplete, editable filter pills, color selection, event tags, chart menus, Terraform export and AI information. The controlled Help Menu also connects `onChange`.
- Add fields uses an uncontrolled Popover. Local browser testing of the actual DBRowTable preview confirmed that clicking Simulate live refresh outside the dropdown closes it.
- `ViewTraceCalloutButton` is a one-time onboarding hint, deliberately configured to stay open until View trace or Got it is chosen. Its source documents that decision. It is not a selection dropdown and was preserved.
- Side panels, drawers and modals have separate dismissal policies and were not changed by this dropdown audit.

## Verification and limits

The source audit used the graph discovery results followed by a TypeScript AST sweep of every `.ts`/`.tsx` file in the two scopes, excluding test and story files. Graph coverage had recorded gaps, so the inventory comes from current source rather than an assertion that the graph is exhaustive. No native `<details>` dropdown was found. Wrapper components reuse the primitives listed below; their call sites are not counted again. Demo components under `src` are included.

Inventory: **84 direct menu/select/popover primitive instances**: 17 Popovers, 19 Menus, 28 Selects, 12 NativeSelects, 3 MultiSelects, 4 Autocompletes and 1 Combobox. There are also **three direct calendar-input instances**: two DateInputs and one DateTimePicker. The reusable time-picker DateInput is mounted in multiple positions. These calendar inputs use Mantine's built-in state and dismissal; the time picker's enclosing controlled Popover is the separate defect described above.

This is a source inventory, not a claim that all 84 placements were browser-tested. Mantine's standard Select/Menu/Combobox components retain their library outside-click behavior. Nested filter-pill autocomplete explicitly uses `withinPortal: false` to keep option interactions inside its parent Popover. Multi-select choices should stay open while selecting inside and close when clicking outside.

Regression tests reproduced the time-picker mouse/touch/Escape failures and log-field toolbar outside/Escape failures before the fixes. All **10 tests in three suites pass** after the fixes, including nested calendar/duration interactions and VirtualMultiSelect selection persistence. App TypeScript checking (`yarn tsc --noEmit`) passes. Targeted ESLint reports no errors and one existing array-index-key warning in the time picker's preset list. Full authenticated application E2E was not run; tests used actual components with fixture data and providers. Repository-wide auto-formatting was avoided because the workspace contains extensive unrelated uncommitted changes.

Local browser verification used rebuilt actual components, without production API writes:

| Control | Verified behavior |
| --- | --- |
| Time picker | Outside click failed before the fix, closes after it; reopening and selecting Last 1 hour still work. |
| Add fields in DBRowTable | Outside click closes; nested autocomplete selection and adding a field keep the parent open; Escape dismisses; selected fields persist. |
| Log-field hover toolbar | Hover opens actions; outside click closes the toolbar. Escape is covered by the regression test. |
| Menu and Select | Opening a separate selector closes the action menu; outside click closes the selector. |
| VirtualMultiSelect | Choosing an option keeps the dropdown open; outside click closes it; reopening retains the selected value. |

Time-picker browser evidence: [before](../output/dropdown-timepicker-before.png), [after](../output/dropdown-timepicker-after.png). Test output: [Jest](../output/dropdown-tests.log), [TypeScript](../output/dropdown-typecheck.log). The standalone browser fixture reported only a missing favicon request; no component runtime exceptions were observed.

## Direct primitive inventory

Paths below are relative to `packages/app`.

| Path | Direct instances |
| --- | --- |
| `src/AlertsPage.tsx` | Select × 3 |
| `src/DBDashboardPage.tsx` | Popover × 1, Menu × 3 |
| `src/DBSearchPage.tsx` | Select × 1 |
| `src/DBSearchPageAlertModal.tsx` | NativeSelect × 3 |
| `src/DBServiceMapPage.tsx` | MultiSelect × 1 |
| `src/GranularityPicker.tsx` | Select × 1 |
| `src/HDXMultiSeriesTimeChart.tsx` | Popover × 1 |
| `src/UserPreferencesModal.tsx` | Select × 4, Autocomplete × 1 |
| `src/components/ActiveFilterPills.tsx` | Popover × 1, Autocomplete × 1 |
| `src/components/AggFnSelect.tsx` | Select × 1 |
| `src/components/AppNav/AppNav.components.tsx` | Menu × 2 |
| `src/components/BackgroundChartInput.tsx` | Select × 1 |
| `src/components/ColorRulesEditor.tsx` | Select × 1 |
| `src/components/ColorSwatchInput.tsx` | Popover × 1 |
| `src/components/ConfirmDeleteMenu.tsx` | Menu × 1 |
| `src/components/DBEditTimeChartForm/ChartActionBar.tsx` | Menu × 1 |
| `src/components/DBEditTimeChartForm/OnClickForm/OnClickTargetInputControlled.tsx` | Select × 1 |
| `src/components/DBEditTimeChartForm/TileAlertEditor.tsx` | NativeSelect × 3 |
| `src/components/DBRowJsonViewer.tsx` | Menu × 1 |
| `src/components/DBRowTable.tsx` | Popover × 1 |
| `src/components/DBSearchPageFilters/FilterSettingsPopover.tsx` | Popover × 1 |
| `src/components/DBSearchPageFilters/PinShareMenu.tsx` | Menu × 1 |
| `src/components/DBTable/DBRowTableFieldWithPopover.tsx` | Popover × 1 |
| `src/components/DBTableSelect.tsx` | Select × 1 |
| `src/components/DBTimeChart.tsx` | Popover × 1 |
| `src/components/DashboardContainer.tsx` | Menu × 1 |
| `src/components/Dashboards/DashboardsListPage.tsx` | Select × 1, Menu × 1 |
| `src/components/DatabaseSelect.tsx` | Select × 1 |
| `src/components/EventTag.tsx` | Popover × 1 |
| `src/components/Iac/ResourceTerraformPopover.tsx` | Popover × 1 |
| `src/components/InputControlled.tsx` | Autocomplete × 1 |
| `src/components/KubernetesFilters.tsx` | Select × 1 |
| `src/components/ListingCard.tsx` | Menu × 1 |
| `src/components/ListingListRow.tsx` | Menu × 1 |
| `src/components/LogSummaryDemo/FilterCountsPreview.tsx` | Select × 1 |
| `src/components/LogSummaryDemo/LogSummaryDemo.tsx` | Popover × 1 |
| `src/components/LogSummaryDemo/SummaryFieldPicker.tsx` | Autocomplete × 1 |
| `src/components/MetricNameSelect.tsx` | Select × 1 |
| `src/components/NumberFormat.tsx` | NativeSelect × 3 |
| `src/components/PropertyComparisonChart.tsx` | Popover × 1 |
| `src/components/SaveToDashboardModal.tsx` | Select × 1 |
| `src/components/SavedSearches/SavedSearchesListPage.tsx` | Select × 1 |
| `src/components/SearchInput/AutocompleteInput.tsx` | Popover × 1 |
| `src/components/SearchInput/InputLanguageSwitch.tsx` | Select × 1 |
| `src/components/SearchPageActionBar.tsx` | Menu × 1 |
| `src/components/SelectControlled.tsx` | Select × 1 |
| `src/components/SourceMultiSelect.tsx` | MultiSelect × 1 |
| `src/components/SourceSelect.tsx` | Menu × 1 |
| `src/components/Sources/SourceForm/MaterializedViews.tsx` | Select × 1 |
| `src/components/Tags.tsx` | Popover × 1 |
| `src/components/TeamSettings/BulkMemberRoles.tsx` | MultiSelect × 1 |
| `src/components/TeamSettings/MemberRoleSelect.tsx` | Select × 1 |
| `src/components/TimePicker/TimePicker.tsx` | Popover × 1, Select × 1 |
| `src/components/ViewTraceCalloutButton.tsx` | Popover × 1 |
| `src/components/VirtualMultiSelect/VirtualMultiSelect.tsx` | Combobox × 1 |
| `src/components/aiSummarize/AISummaryPanel.tsx` | Popover × 1 |
| `src/components/alerts/AckAlert.tsx` | Menu × 2 |
| `src/components/alerts/AlertRowMenu.tsx` | Menu × 1 |
| `src/components/alerts/EditAlertModal.tsx` | NativeSelect × 3 |
| `src/components/alerts/WebhookChannelForm.tsx` | Select × 1 |
| `src/components/charts/ChartContainer.tsx` | Menu × 1 |
| `src/llm/dashboard/DistinctValueSelect.tsx` | Select × 1 |

| Additional calendar path | Direct instances |
| --- | --- |
| `src/components/AlertScheduleFields.tsx` | DateTimePicker × 1; popoverProps only sets portal/z-index |
| `src/components/Sources/SourceForm/MaterializedViews.tsx` | DateInput × 1; default dismissal |
| `src/components/TimePicker/TimePicker.tsx` | DateInput × 1 in DateInputCmp; wrapper reused for date bounds |
