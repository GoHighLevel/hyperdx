import { useMemo, useState } from 'react';
import { Box, Button, Group, Popover, Text, TextInput } from '@mantine/core';
import { IconPlus, IconSearch, IconTextWrap } from '@tabler/icons-react';

import EmptyState from '@/components/EmptyState';

import { SAMPLE_LOGS } from './fixtures';
import LogSummaryRow, { SummaryField } from './LogSummaryRow';
import { resolveField, resolveMessage, SUMMARY_FIELDS } from './resolveFields';
import SummaryFieldPicker from './SummaryFieldPicker';

import styles from './LogSummaryDemo.module.scss';

export default function LogSummaryDemo() {
  const [rows, setRows] = useState(SAMPLE_LOGS);
  const [fields, setFields] = useState<SummaryField[]>(
    SUMMARY_FIELDS.filter(field =>
      ['deployment_name', 'method', 'status'].includes(field.id),
    ),
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<{
    field: SummaryField;
    value: string;
  }>();
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(10);
  const [openFields, setOpenFields] = useState<string[]>([]);
  const facets = useMemo(
    () =>
      fields.map(field => {
        const counts = new Map<string, number>();
        rows.forEach(row => {
          const value = resolveField(row.event, field.paths)?.text;
          if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
        });
        return {
          field,
          values: [...counts].sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
          ),
        };
      }),
    [rows, fields],
  );
  const visible = rows.filter(
    row =>
      (!filter ||
        resolveField(row.event, filter.field.paths)?.text === filter.value) &&
      (!search ||
        `${resolveMessage(row.event)?.text ?? ''} ${fields.map(field => resolveField(row.event, field.paths)?.text ?? '').join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  return (
    <Box className={styles.demo} style={{ '--log-font-size': `${fontSize}px` }}>
      <header className={styles.header}>
        <strong>HyperDX</strong>
        <span>Service debugging / Logs</span>
        <span className={styles.previewLabel}>Local preview · sample data</span>
      </header>
      <section className={styles.searchBar} aria-label="Sample log search">
        <div>
          <h1>Logs explorer</h1>
          <Text size="xs" c="dimmed">
            Staging · mixed application log formats
          </Text>
        </div>
        <TextInput
          aria-label="Find in sample logs"
          placeholder="Find a message or selected field value"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={event => setSearch(event.currentTarget.value)}
        />
      </section>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Fields">
          <h2>Fields</h2>
          <Text size="xs" c="dimmed">
            Filter these sample logs
          </Text>
          {facets.map(({ field, values }) => (
            <div key={field.id}>
              <button
                className={styles.fieldHeading}
                onClick={() =>
                  setOpenFields(current =>
                    current.includes(field.id)
                      ? current.filter(id => id !== field.id)
                      : [...current, field.id],
                  )
                }
                aria-expanded={openFields.includes(field.id)}
              >
                {openFields.includes(field.id) ? '⌄' : '›'} {field.label}
                <span>
                  {values.reduce((total, [, count]) => total + count, 0)}
                </span>
              </button>
              {openFields.includes(field.id) &&
                values.map(([name, count]) => (
                  <button
                    key={name}
                    className={styles.facet}
                    onClick={() => setFilter({ field, value: name })}
                  >
                    <span>{name}</span>
                    <span>{count}</span>
                  </button>
                ))}
            </div>
          ))}
          <p className={styles.sidebarHint}>
            Add fields to your summary, then select a value or click a chip to
            narrow the results.
          </p>
        </aside>
        <main className={styles.main}>
          <div className={styles.toolbar}>
            <Text size="sm" role="status">
              {visible.length} sample logs
            </Text>
            <Group gap={6} className={styles.actions}>
              <Button
                variant="subtle"
                size="compact-xs"
                aria-label="Decrease log font size"
                disabled={fontSize === 10}
                onClick={() => setFontSize(size => size - 2)}
              >
                A−
              </Button>
              <Text size="xs">{fontSize}px</Text>
              <Button
                variant="subtle"
                size="compact-xs"
                aria-label="Increase log font size"
                disabled={fontSize === 18}
                onClick={() => setFontSize(size => size + 2)}
              >
                A+
              </Button>
              <Button
                variant="secondary"
                size="compact-xs"
                leftSection={<IconTextWrap size={14} />}
                aria-pressed={wrap}
                onClick={() => setWrap(value => !value)}
              >
                {wrap ? 'Wrap on' : 'Wrap off'}
              </Button>
              <Popover position="bottom-end" width={300}>
                <Popover.Target>
                  <Button
                    variant="secondary"
                    size="compact-xs"
                    leftSection={<IconPlus size={14} />}
                  >
                    Add fields
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <SummaryFieldPicker fields={fields} setFields={setFields} />
                </Popover.Dropdown>
              </Popover>
              <Button
                variant="secondary"
                size="compact-xs"
                onClick={() =>
                  setRows(current => [
                    {
                      ...SAMPLE_LOGS[1],
                      id: `new-${current.length}`,
                      time: '10:20:00.000',
                    },
                    ...current,
                  ])
                }
              >
                Add sample log
              </Button>
            </Group>
          </div>
          {filter && (
            <div className={styles.filterBar}>
              <span>
                {filter.field.label}: {filter.value}
              </span>
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => setFilter(undefined)}
              >
                Clear filter
              </Button>
            </div>
          )}
          <div className={styles.listHeading}>
            <span>Time (IST)</span>
            <span>Summary</span>
          </div>
          <div className={styles.logList}>
            {visible.length === 0 ? (
              <EmptyState
                title="No matching sample logs"
                description="Clear the filter or try another search."
              />
            ) : (
              visible.map(row => (
                <LogSummaryRow
                  key={row.id}
                  row={row}
                  fields={fields}
                  wrap={wrap}
                  onFilter={(field, value) => setFilter({ field, value })}
                />
              ))
            )}
          </div>
          <footer className={styles.footer}>
            Preview only. No queries are sent to staging or production.
          </footer>
        </main>
      </div>
    </Box>
  );
}
