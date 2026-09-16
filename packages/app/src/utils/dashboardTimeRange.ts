import {
  displayTypeRequiresSource,
  isPromqlSavedChartConfig,
} from '@hyperdx/common-utils/dist/guards';
import {
  SavedChartConfig,
  SourceKind,
  TSource,
} from '@hyperdx/common-utils/dist/types';

// Log evidence alongside monitoring must not hide the monitoring time ranges.
export function dashboardHasMonitoring(
  tiles: ReadonlyArray<{ config: SavedChartConfig }>,
  sources: ReadonlyArray<Pick<TSource, 'id' | 'kind'>> = [],
): boolean {
  return tiles.some(
    ({ config }) =>
      displayTypeRequiresSource(config.displayType) &&
      (isPromqlSavedChartConfig(config) ||
        sources.some(
          source =>
            source.id === config.source && source.kind === SourceKind.Metric,
        )),
  );
}
