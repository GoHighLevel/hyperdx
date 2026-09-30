import { useMemo } from 'react';
import { SourceKind, TSource } from '@hyperdx/common-utils/dist/types';
import { Button, Group } from '@mantine/core';

import { WithClause } from '@/hooks/useRowWhere';
import { useSource } from '@/source';
import TabBar from '@/TabBar';
import { useLocalStorage } from '@/utils';
import {
  getRowLookupWindow,
  resolveRowTimestampAnchor,
} from '@/utils/rowTimestamps';

import { TraceSidePanelSelection } from './Search/DirectTraceSidePanel';
import ServiceMapSidePanel from './ServiceMap/ServiceMapSidePanel';
import { RowDataPanel, useRowData } from './DBRowDataPanel';
import { DBRowSidePanelErrorState } from './DBRowSidePanelErrorState';
import EmptyState from './EmptyState';

enum InlineTab {
  ColumnValues = 'columnValues',
  ServiceMap = 'serviceMap',
}

export default function InlineLogDetails({
  source,
  rowId,
  aliasWith,
  onOpenDetails,
  onOpenTrace,
}: {
  source: TSource;
  rowId: string;
  aliasWith?: WithClause[];
  onOpenDetails: () => void;
  onOpenTrace?: (selection: TraceSidePanelSelection) => void;
}) {
  // Use localStorage to persist the selected tab
  const [activeTab, setActiveTab] = useLocalStorage<InlineTab>(
    'hdx-expanded-row-default-tab',
    InlineTab.ColumnValues,
  );

  // Surface the same error state the row side panel shows (e.g. `SELECT *`
  // failures on Distributed/Merge tables) rather than silently rendering an
  // empty expanded row. All tabs load the same row data, so a failure here
  // affects the whole expanded row.
  const { data, isError, error } = useRowData({ source, rowId, aliasWith });
  const row = data?.data?.[0];
  const traceId =
    typeof row?.__hdx_trace_id === 'string' ? row.__hdx_trace_id : undefined;
  const configuredTraceSourceId =
    source.kind === SourceKind.Trace
      ? source.id
      : source.kind === SourceKind.Log
        ? source.traceSourceId
        : undefined;
  const { data: traceSource } = useSource({
    id: configuredTraceSourceId,
    kinds: [SourceKind.Trace],
    traceForLogSourceId: source.kind === SourceKind.Log ? source.id : undefined,
  });
  const focusDate = useMemo(() => {
    const anchor = resolveRowTimestampAnchor({
      timestampValueExpression: source.timestampValueExpression,
      row,
      meta: data?.meta,
    });
    if (anchor) return anchor;
    const raw = row?.__hdx_timestamp;
    if (raw == null) return undefined;
    const date = new Date(typeof raw === 'number' ? raw * 1000 : raw);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }, [source.timestampValueExpression, row, data?.meta]);
  const dateRange = useMemo(
    () => getRowLookupWindow(focusDate?.toISOString()),
    [focusDate],
  );
  const displayedTab =
    activeTab === InlineTab.ServiceMap && traceId
      ? InlineTab.ServiceMap
      : InlineTab.ColumnValues;

  if (isError && error) {
    return (
      <div className="position-relative">
        <div className="px-3 py-3">
          <DBRowSidePanelErrorState error={error} source={source} />
        </div>
      </div>
    );
  }

  return (
    <div className="position-relative">
      <Group className="px-3 pt-2 position-relative" justify="space-between">
        <TabBar
          className="fs-8"
          items={[
            {
              text: 'Column values',
              value: InlineTab.ColumnValues,
            },
            ...(traceId
              ? [{ text: 'Service map', value: InlineTab.ServiceMap }]
              : []),
          ]}
          activeItem={displayedTab}
          onClick={setActiveTab}
        />
        <Group gap="xs">
          {traceId && (
            <Button
              variant="link"
              size="xs"
              onClick={() =>
                dateRange && focusDate && onOpenTrace
                  ? onOpenTrace({
                      traceId,
                      traceSourceId: traceSource?.id,
                      dateRange,
                      focusDate,
                    })
                  : setActiveTab(InlineTab.ServiceMap)
              }
            >
              View trace
            </Button>
          )}
          <Button variant="link" size="xs" onClick={onOpenDetails}>
            Open details
          </Button>
        </Group>
      </Group>
      <div>
        {displayedTab === InlineTab.ColumnValues && (
          <RowDataPanel source={source} rowId={rowId} aliasWith={aliasWith} />
        )}
        {displayedTab === InlineTab.ServiceMap && traceId && (
          <div style={{ height: 380, display: 'flex', padding: 12 }}>
            {dateRange ? (
              <ServiceMapSidePanel
                traceId={traceId}
                traceTableSourceId={traceSource?.id}
                dateRange={dateRange}
                focusDate={focusDate}
                showTraceAction={false}
              />
            ) : (
              <EmptyState
                title="Event timestamp unavailable"
                description="The log source needs a valid timestamp to locate this trace. Ask an admin to check its timestamp expression."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
