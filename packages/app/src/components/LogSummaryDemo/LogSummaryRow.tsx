import { useId, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Text } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconServer,
} from '@tabler/icons-react';

import HyperJson from '@/components/HyperJson';
import LogLevel from '@/components/LogLevel';
import { copyTextToClipboard } from '@/utils/clipboard';

import { resolveField, resolveMessage, SUMMARY_FIELDS } from './resolveFields';

import styles from './LogSummaryDemo.module.scss';

export type SampleLog = {
  id: string;
  time: string;
  event: Record<string, unknown>;
};
export type SummaryField = (typeof SUMMARY_FIELDS)[number];

export default function LogSummaryRow({
  row,
  fields,
  wrap,
  onFilter,
}: {
  row: SampleLog;
  fields: SummaryField[];
  wrap: boolean;
  onFilter: (field: SummaryField, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const detailsId = useId();
  const message = useMemo(() => resolveMessage(row.event), [row.event]);
  const severity =
    resolveField(row.event, [
      'log_level',
      'log.level',
      'severity',
      'SeverityText',
    ])?.text ?? 'unknown';
  const toggle = () => {
    if (!window.getSelection()?.toString()) setExpanded(value => !value);
  };

  return (
    <article
      className={styles.row}
      data-expanded={expanded}
      aria-label={`Log at ${row.time}`}
    >
      <div className={styles.rowHeader}>
        <ActionIcon
          variant="subtle"
          size={22}
          aria-label={expanded ? 'Collapse log' : 'Expand log'}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={toggle}
        >
          {expanded ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
        </ActionIcon>
        <LogLevel level={severity} iconOnly />
        <button
          className={styles.timestamp}
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {row.time}
        </button>
        <div className={styles.flow} data-wrap={wrap}>
          {fields.map(field => {
            const value = resolveField(row.event, field.paths);
            if (!value) return null;
            return (
              <button
                key={field.id}
                className={styles.chip}
                data-kind={field.id}
                data-error={field.id === 'status' && Number(value.text) >= 500}
                title={`${field.label}: ${value.text}\nFrom ${value.path}\nClick to filter sample logs`}
                aria-label={`Filter ${field.label}: ${value.text}`}
                onClick={() => onFilter(field, value.text)}
              >
                {field.id === 'node_name' && (
                  <IconServer size={12} aria-hidden="true" />
                )}
                {value.text}
              </button>
            );
          })}
          <span
            className={styles.message}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
              }
            }}
            onClick={toggle}
            aria-expanded={expanded}
            aria-controls={detailsId}
            title={
              message
                ? `From ${message.path}: ${message.text}`
                : 'No message field found'
            }
          >
            {message?.text ?? 'No message available'}
          </span>
        </div>
      </div>
      {expanded && (
        <div id={detailsId} className={styles.details}>
          <Group
            justify="space-between"
            gap="xs"
            className={styles.detailToolbar}
          >
            <Text size="xs" c="dimmed">
              Message: {message?.path ?? 'not found'}
            </Text>
            <Group gap="xs">
              <Text role="status" size="xs">
                {copyStatus}
              </Text>
              <Button
                variant="secondary"
                size="compact-xs"
                leftSection={<IconCopy size={12} />}
                disabled={!message}
                onClick={async () =>
                  setCopyStatus(
                    (await copyTextToClipboard(message?.text ?? ''))
                      ? 'Copied'
                      : 'Copy failed',
                  )
                }
              >
                Copy message
              </Button>
            </Group>
          </Group>
          <p className={styles.fullMessage}>
            {message?.text ?? 'No message available'}
          </p>
          <HyperJson data={row.event} groupDottedKeys expandJsonStrings />
        </div>
      )}
    </article>
  );
}
