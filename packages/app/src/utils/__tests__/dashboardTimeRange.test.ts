import {
  DisplayType,
  SavedChartConfig,
  SourceKind,
} from '@hyperdx/common-utils/dist/types';

import { dashboardHasMonitoring } from '@/utils/dashboardTimeRange';

const metric = {
  configType: 'promql',
  promqlExpression: 'up',
  connection: 'vm',
  displayType: DisplayType.Line,
} satisfies SavedChartConfig;
const logs = {
  configType: 'sql',
  sqlTemplate: 'SELECT timestamp, log FROM logs',
  connection: 'clickhouse',
  displayType: DisplayType.Table,
} satisfies SavedChartConfig;

describe('monitoring time ranges', () => {
  it('keeps long ranges available when log evidence is added to monitoring', () => {
    expect(dashboardHasMonitoring([{ config: metric }])).toBe(true);
    expect(dashboardHasMonitoring([{ config: metric }, { config: logs }])).toBe(
      true,
    );
  });

  it('does not add monitoring presets to empty or log-only dashboards', () => {
    expect(dashboardHasMonitoring([])).toBe(false);
    expect(dashboardHasMonitoring([{ config: logs }])).toBe(false);
  });

  it('recognizes ClickHouse metric sources alongside log evidence', () => {
    const tiles = [
      { config: { ...logs, source: 'metrics' } },
      { config: logs },
    ];
    expect(dashboardHasMonitoring(tiles)).toBe(false);
    expect(
      dashboardHasMonitoring(tiles, [
        { id: 'metrics', kind: SourceKind.Metric },
      ]),
    ).toBe(true);
    expect(
      dashboardHasMonitoring(tiles, [{ id: 'metrics', kind: SourceKind.Log }]),
    ).toBe(false);
  });

  it('ignores a metric source attached to a static markdown tile', () => {
    expect(
      dashboardHasMonitoring(
        [
          {
            config: {
              ...logs,
              source: 'metrics',
              displayType: DisplayType.Markdown,
            },
          },
        ],
        [{ id: 'metrics', kind: SourceKind.Metric }],
      ),
    ).toBe(false);
  });
});
