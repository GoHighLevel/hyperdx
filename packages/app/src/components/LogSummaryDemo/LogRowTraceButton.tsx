import { ColumnMetaType } from '@hyperdx/common-utils/dist/clickhouse';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconListTree } from '@tabler/icons-react';

import { TraceSidePanelSelection } from '@/components/Search/DirectTraceSidePanel';
import { getLogTraceContext } from '@/utils/logTraceContext';
import {
  getRowLookupWindow,
  resolveRowTimestampAnchor,
} from '@/utils/rowTimestamps';

import styles from './LiveSummaryContent.module.scss';

export default function LogRowTraceButton({
  row,
  timestampValueExpression,
  meta,
  timeColumn,
  onOpenTrace,
}: {
  row: Record<string, unknown>;
  timestampValueExpression?: string;
  meta?: ColumnMetaType[];
  timeColumn?: string;
  onOpenTrace?: (selection: TraceSidePanelSelection) => void;
}) {
  const { traceId } = getLogTraceContext(row);
  const anchor = resolveRowTimestampAnchor({
    timestampValueExpression,
    row,
    meta,
  });
  const raw = row.__hdx_timestamp ?? (timeColumn ? row[timeColumn] : undefined);
  const focusDate =
    anchor ??
    (typeof raw === 'number' || typeof raw === 'string'
      ? new Date(typeof raw === 'number' ? raw * 1000 : raw)
      : undefined);
  if (
    !onOpenTrace ||
    !traceId ||
    !focusDate ||
    Number.isNaN(focusDate.getTime())
  )
    return null;
  const dateRange = getRowLookupWindow(focusDate.toISOString());
  if (!dateRange) return null;

  return (
    <Tooltip label="View trace" withinPortal>
      <ActionIcon
        aria-label="View trace"
        variant="subtle"
        size={24}
        radius="xl"
        className={styles.traceAction}
        data-dashboard-no-drag
        onClick={event => {
          event.stopPropagation();
          onOpenTrace({ traceId, dateRange, focusDate });
        }}
      >
        <IconListTree size={14} />
      </ActionIcon>
    </Tooltip>
  );
}
