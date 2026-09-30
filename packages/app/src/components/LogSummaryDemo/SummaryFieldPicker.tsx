import { Dispatch, SetStateAction, useRef, useState } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Checkbox,
  Group,
  Text,
  VisuallyHidden,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconX } from '@tabler/icons-react';

import { SummaryField } from './LogSummaryRow';
import { SUMMARY_FIELDS, summaryFieldForPath } from './resolveFields';

const EMPTY_FIELDS: SummaryField[] = [];
const FIELD_SUGGESTIONS = SUMMARY_FIELDS.map(field => field.paths[0]);

export default function SummaryFieldPicker({
  fields,
  setFields,
  availableFields = EMPTY_FIELDS,
  onRemoveField,
  onReset,
  title = 'Your summary fields',
  description = 'Check to show. × removes from this list. Top to bottom sets the chip order.',
}: {
  fields: SummaryField[];
  setFields: Dispatch<SetStateAction<SummaryField[]>>;
  availableFields?: SummaryField[];
  onRemoveField?: (field: SummaryField) => void;
  onReset?: () => void;
  title?: string;
  description?: string;
}) {
  const [customPath, setCustomPath] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const options = [
    ...new Map(
      [...fields, ...availableFields].map(field => [field.id, field]),
    ).values(),
  ];
  const move = (field: SummaryField, direction: number) => {
    const index = fields.findIndex(value => value.id === field.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    setAnnouncement(`${field.label} moved to position ${target + 1}`);
  };

  return (
    <>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        {description}
      </Text>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      {options.map(field => {
        const index = fields.findIndex(value => value.id === field.id);
        return (
          <Group
            key={field.id}
            mb="xs"
            gap={4}
            wrap="nowrap"
            data-summary-field
          >
            <Checkbox
              label={field.label}
              checked={index !== -1}
              style={{ flex: 1, minWidth: 0 }}
              onChange={() =>
                setFields(current =>
                  current.some(value => value.id === field.id)
                    ? current.filter(value => value.id !== field.id)
                    : [...current, field],
                )
              }
            />
            {index !== -1 && (
              <>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${field.label} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(field, -1)}
                >
                  <IconArrowUp size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${field.label} down`}
                  title="Move down"
                  disabled={index === fields.length - 1}
                  onClick={() => move(field, 1)}
                >
                  <IconArrowDown size={14} />
                </ActionIcon>
              </>
            )}
            {onRemoveField && (
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={`Remove ${field.label} from field list`}
                title="Remove from field list"
                onClick={event => {
                  const row = event.currentTarget.closest(
                    '[data-summary-field]',
                  );
                  const neighbor = [
                    row?.nextElementSibling,
                    row?.previousElementSibling,
                  ].find(element => element?.matches('[data-summary-field]'));
                  const next = neighbor?.querySelector('input');
                  (next ?? inputRef.current)?.focus();
                  onRemoveField(field);
                  setAnnouncement(
                    `${field.label} removed from your field list`,
                  );
                }}
              >
                <IconX size={14} />
              </ActionIcon>
            )}
          </Group>
        );
      })}
      {options.length === 0 && (
        <Text size="xs" c="dimmed">
          No fields added. The log message is still shown.
        </Text>
      )}
      <Autocomplete
        ref={inputRef}
        mt="md"
        label="Add a field"
        placeholder="log.request_id"
        data={FIELD_SUGGESTIONS}
        value={customPath}
        onChange={setCustomPath}
        comboboxProps={{ withinPortal: false }}
      />
      <Button
        variant="secondary"
        size="compact-xs"
        mt="xs"
        disabled={!customPath.trim()}
        onClick={() => {
          const path = customPath.trim();
          const field = summaryFieldForPath(path);
          setFields(current =>
            current.some(
              value => value.id === field.id || value.paths.includes(path),
            )
              ? current
              : [...current, field],
          );
          setCustomPath('');
        }}
      >
        Add field
      </Button>
      {onReset && (
        <Button variant="subtle" size="compact-xs" mt="xs" onClick={onReset}>
          Reset to team defaults
        </Button>
      )}
    </>
  );
}
