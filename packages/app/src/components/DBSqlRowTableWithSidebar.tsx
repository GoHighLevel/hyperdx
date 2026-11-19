import { useCallback, useEffect, useState } from 'react';
import { useQueryState } from 'nuqs';
import {
  ClickHouseQueryError,
  ColumnMetaType,
} from '@hyperdx/common-utils/dist/clickhouse';
import {
  BuilderChartConfigWithDateRange,
  SourceKind,
} from '@hyperdx/common-utils/dist/types';
import { SortingState } from '@tanstack/react-table';

import { RowWhereResult, WithClause } from '@/hooks/useRowWhere';
import { useSource } from '@/source';
import { parseAsStringEncoded } from '@/utils/queryParsers';

import { ChartErrorStateVariant } from './charts/ChartErrorState';
import DirectTraceSidePanel, {
  TraceSidePanelSelection,
} from './Search/DirectTraceSidePanel';
import DBRowSidePanel, {
  RowSidePanelContext,
  RowSidePanelContextProps,
} from './DBRowSidePanel';
import { DBRowTableVariant, DBSqlRowTable } from './DBRowTable';
import InlineLogDetails from './InlineLogDetails';

interface Props {
  sourceId: string;
  config: BuilderChartConfigWithDateRange;
  onError?: (error: Error | ClickHouseQueryError) => void;
  onScroll?: (scrollTop: number) => void;
  onSidebarOpen?: (rowId: string) => void;
  onExpandedRowsChange?: (hasExpandedRows: boolean) => void;
  onPropertyAddClick?: (keyPath: string, value: string) => void;
  context?: RowSidePanelContextProps;
  enabled?: boolean;
  isLive?: boolean;
  queryKeyPrefix?: string;
  denoiseResults?: boolean;
  collapseAllRows?: boolean;
  onSortingChange?: (v: SortingState | null) => void;
  initialSortBy?: SortingState;
  variant?: DBRowTableVariant;
  enableSmallFirstWindow?: boolean;
  tableId?: string;
  errorVariant?: ChartErrorStateVariant;
  onResolvedColumnsChange?: (meta: ColumnMetaType[]) => void;
  // Clicking outside the row side panel (and outside `keepOpenSelector`) closes
  // it. Enabled by default; pass `false` to opt out.
  closeOnClickOutside?: boolean;
  keepOpenSelector?: string;
}

// Clicking the results table (selecting/switching rows, scrolling) keeps the
// row side panel open by default; callers can widen this via `keepOpenSelector`.
const DEFAULT_KEEP_OPEN_SELECTOR = '[data-testid="search-results-table"]';

export default function DBSqlRowTableWithSideBar({
  sourceId,
  config,
  onError,
  onScroll,
  context,
  onExpandedRowsChange,
  denoiseResults,
  collapseAllRows,
  isLive,
  enabled,
  queryKeyPrefix = 'dbSqlRowTable',
  onSidebarOpen,
  onSortingChange,
  initialSortBy,
  variant,
  enableSmallFirstWindow,
  tableId,
  errorVariant,
  onResolvedColumnsChange,
  closeOnClickOutside = true,
  keepOpenSelector = DEFAULT_KEEP_OPEN_SELECTOR,
}: Props) {
  const { data: sourceData } = useSource({ id: sourceId });
  const { data: traceSource } = useSource({
    id:
      sourceData?.kind === SourceKind.Log
        ? sourceData.traceSourceId
        : undefined,
    kinds: [SourceKind.Trace],
    traceForLogSourceId:
      sourceData?.kind === SourceKind.Log ? sourceId : undefined,
  });
  const [rowId, setRowId] = useQueryState('rowWhere', parseAsStringEncoded);
  const [rowSource, setRowSource] = useQueryState('rowSource');
  const [aliasWith, setAliasWith] = useState<WithClause[]>([]);
  const [activeTrace, setActiveTrace] =
    useState<TraceSidePanelSelection | null>(null);
  useEffect(() => setActiveTrace(null), [sourceId]);
  const onOpenRowTrace = useCallback(
    (selection: TraceSidePanelSelection) => {
      setActiveTrace({ ...selection, traceSourceId: traceSource?.id });
    },
    [traceSource?.id],
  );

  const onOpenSidebar = useCallback(
    (rowWhere: RowWhereResult) => {
      setRowId(rowWhere.where);
      setAliasWith(rowWhere.aliasWith);
      setRowSource(sourceId);
      onSidebarOpen?.(rowWhere.where);
    },
    [setRowId, setAliasWith, setRowSource, sourceId, onSidebarOpen],
  );

  const onCloseSidebar = useCallback(() => {
    setRowId(null);
    setRowSource(null);
  }, [setRowId, setRowSource]);
  const renderRowDetails = useCallback(
    (r: { id: string; aliasWith?: WithClause[]; [key: string]: unknown }) => {
      if (!sourceData) {
        return <div className="p-3 text-muted">Loading...</div>;
      }
      return (
        <InlineLogDetails
          source={sourceData}
          rowId={r.id}
          aliasWith={r.aliasWith}
          onOpenTrace={onOpenRowTrace}
          onOpenDetails={() =>
            onOpenSidebar({ where: r.id, aliasWith: r.aliasWith ?? [] })
          }
        />
      );
    },
    [sourceData, onOpenRowTrace, onOpenSidebar],
  );

  return (
    <RowSidePanelContext value={context ?? {}}>
      {sourceData && (rowSource === sourceId || !rowSource) && (
        <DBRowSidePanel
          source={sourceData}
          rowId={rowId ?? undefined}
          aliasWith={aliasWith}
          onClose={onCloseSidebar}
          closeOnClickOutside={closeOnClickOutside}
          keepOpenSelector={keepOpenSelector}
        />
      )}
      <DBSqlRowTable
        config={config}
        sourceId={sourceId}
        onRowDetailsClick={onOpenSidebar}
        highlightedLineId={rowId ?? undefined}
        enabled={enabled}
        isLive={isLive ?? true}
        inspectionActive={
          activeTrace != null ||
          (rowId != null && (rowSource === sourceId || !rowSource))
        }
        queryKeyPrefix={queryKeyPrefix}
        onSortingChange={onSortingChange}
        denoiseResults={denoiseResults}
        initialSortBy={initialSortBy}
        renderRowDetails={renderRowDetails}
        onOpenTrace={onOpenRowTrace}
        onScroll={onScroll}
        onError={onError}
        onExpandedRowsChange={onExpandedRowsChange}
        collapseAllRows={collapseAllRows}
        variant={variant}
        enableSmallFirstWindow={enableSmallFirstWindow}
        tableId={tableId}
        errorVariant={errorVariant}
        onResolvedColumnsChange={onResolvedColumnsChange}
      />
      {activeTrace && (
        <DirectTraceSidePanel
          key={`${activeTrace.traceId}:${activeTrace.focusDate.getTime()}`}
          {...activeTrace}
          opened
          onClose={() => setActiveTrace(null)}
          onSourceChange={traceSourceId =>
            setActiveTrace(previous =>
              previous ? { ...previous, traceSourceId } : null,
            )
          }
          closeOnClickOutside={false}
        />
      )}
    </RowSidePanelContext>
  );
}
