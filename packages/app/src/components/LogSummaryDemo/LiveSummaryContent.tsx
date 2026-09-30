import { memo, ReactNode } from 'react';

import DBRowTableFieldWithPopover from '@/components/DBTable/DBRowTableFieldWithPopover';
import LogLevel from '@/components/LogLevel';
import { FormatTime } from '@/useFormatTime';

import { SummaryField } from './LogSummaryRow';
import { resolveField, resolveMessage } from './resolveFields';
import { resolveSeverity } from './resolveSeverity';

import styles from './LiveSummaryContent.module.scss';

export default memo(function LiveSummaryContent({
  row,
  fields,
  timeColumn,
  levelColumn,
  messageColumn,
  container,
  wrap,
  traceAction,
}: {
  row: Record<string, unknown>;
  fields: SummaryField[];
  timeColumn?: string;
  levelColumn?: string;
  messageColumn?: string;
  container: HTMLDivElement | null;
  wrap: boolean;
  traceAction?: ReactNode;
}) {
  const message =
    resolveMessage(row) ??
    resolveField(row, messageColumn ? [messageColumn] : [], true);
  const { level, inferred } = resolveSeverity(row, levelColumn);
  return (
    <div className={styles.content}>
      <LogLevel level={level} inferred={inferred} iconOnly />
      <span className={styles.time}>
        {timeColumn && row[timeColumn] != null && (
          <FormatTime value={row[timeColumn] as string} format="withMs" />
        )}
      </span>
      <div className={styles.flow} data-wrap={wrap}>
        {fields.map(field => {
          const value = resolveField(row, field.paths);
          if (!value) return null;
          return (
            <span
              key={field.id}
              className={styles.chip}
              data-kind={field.id}
              title={`${field.label}: ${value.text}`}
            >
              <DBRowTableFieldWithPopover
                cellValue={value.text}
                columnName={value.path}
                tableContainerRef={container}
                wrapLinesEnabled={wrap}
              >
                <span aria-label={`${field.label}: ${value.text}`}>
                  {value.text}
                </span>
              </DBRowTableFieldWithPopover>
            </span>
          );
        })}
        {traceAction}
        <span className={styles.message}>{message?.text ?? ''}</span>
      </div>
    </div>
  );
});
