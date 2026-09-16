# Production monitoring history and missing 90-day preset

Checked September 17, 2026 IST. Dashboard: `6aaabddb4a5cbb957da1d671`
(Logging cost investigation — Production).

## Findings

1. **The missing preset is an application bug.** The deployed custom.30 code
   requires every data tile to be a metric before enabling Last 90 days. This
   dashboard includes SQL log-evidence tiles. Changed eligibility to accept any
   monitoring tile; standalone log/trace pickers retain their existing presets.
2. **There is no universal 30-day metric-history cutoff.** The actual billing
   resource-type panel expression returned HTTP 200 through production Thanos
   over 90 days, with 38 resource types across the range. Its first returned
   evaluation is August 3 at 18:00 UTC and its last is September 16 at 18:00 UTC
   (about 44 days of available history). These are evaluation times, not exact
   timestamps of the first ingested sample.
3. **Retention does not manufacture missing collection history.** Running
   vmstorage arguments contain `--retentionPeriod=90d`. The exporter `up` series
   returns data across the 90-day range through both Thanos and direct VM.
   Billing metrics do not return the same historical coverage, even when all
   project/job label filters are removed.

The screenshot's June 1 start is outside the current 90-day retention window.
Nevertheless, the missing June/July billing history within that window cannot
be explained by retention alone.

## Coverage checks and limitations

- Test window: Unix seconds `1781809208` to `1789585208` (90 days).
- Daily point-in-time evaluations of billing bytes initially appeared to have
  gaps. A second check using `count_over_time(metric[1d])` found positive sample
  counts in **all 44 daily windows ending August 4 through September 16**.
  Do not describe these as entirely missing days. The first window includes
  August 3; sampling is sparse in some later periods.
- Removing project/job matchers produced the same daily sample counts. A change
  to these labels does not explain the missing earlier history for this metric
  name. This does not rule out a historical rename to a different metric name.
- The exact billing panel expression succeeded at a six-hour step over 90 days;
  this checks the real query, not only exporter uptime. `topk(15, ...)` is
  evaluated at each step, so 38 series across the whole result is expected.
- One direct-VM workload-byte query exceeded the probe's 40-second deadline;
  the equivalent Thanos query succeeded. This is a performance observation,
  not evidence of missing historical data.
- No zeros were substituted for missing data. Collected byte deltas and their
  sample counts are not invoice totals or percentages of the bill.

## Collection history

In `platform-infra-helm-charts`, commit
`dd87c524` (August 3) removes the invalid
`logging.googleapis.com:resource.type!="gae_app"` filter and disables
`aggregateDeltas`. The recorded explanation says the invalid resource-type
inequality caused Logging API metric queries to fail with HTTP 400.

The returned billing history beginning around August 3 is consistent with this
repair. **The commit and metric boundary do not establish the exact historical
deployment time or prove that it was the only cause.** No archived exporter
error logs or deployment audit events were retrieved in this check.

Commit `6df5348b` changed configured VM retention from 30d to 90d on May 13.
The live arguments confirm 90d now, but do not prove its historical rollout time.

## What fixes each problem

- Deploy the mixed-dashboard preset correction to expose Last 90 days.
- Query the full period at Auto resolution; older samples already stored in VM
  are available to the same panel expression.
- Recover earlier billing history only through a separate historical source or
  verified backfill, if the source still retains it. Changing the picker or
  adding VM resources cannot restore samples that were never collected.
- Validate historical billing totals against the billing export. This dashboard
  shows observed logging-volume signals, not a substitute for the invoice.

## Evidence and validation

Raw read-only query results and reproducible Node probes are under
`evidence/monitoring-history/`. No credentials are included.
The picker regression renders and clicks Last 90 days with both a PromQL metric
and SQL log-evidence tile. Additional tests cover log-only dashboards, empty
dashboards, ClickHouse metric sources and static tiles.
