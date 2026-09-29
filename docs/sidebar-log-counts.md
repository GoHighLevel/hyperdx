# Sidebar log counts

The filter sidebar lists every discovered string field. Expand a field to load
its values and see the number of matching logs beside each value. Counts include
the active query, selected filters, source, and time range, and update when those
change. They cover matching rows beyond the results table's current page. Nested
fields use the same field expression as their filters.

Counts are exact, not sampled percentages. A spinner means counting is in
progress; `0` means no matching logs; `—` means a count is unavailable. If a query
limit is reached, shorten the time range or narrow the query. Existing source
and metadata query limits still apply. Unselected values are ordered from the
highest matching-log count to the lowest, while pinned and selected values stay
at the top for quick access.

The filter settings gear includes **Show matching log counts**, enabled by
default and saved in this browser. Default, pinned, and active fields load their
values up front; other discovered fields wait until they are expanded. Collapsed
fields never request count queries. Expanding a field adds it to the batched
value query and issues one aggregate count query for the returned values; cached
results can be reused for 30 seconds. This adds query work when multiple fields
are expanded, so counts can be disabled for expensive searches.

Field header numbers remain value/selection totals, not log totals. The optional
distribution percentages remain sampled estimates. Neither is used to calculate
the matching-log counts.
