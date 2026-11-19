import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';

import { summaryFieldForPath } from './resolveFields';
import { useSummaryFields } from './useSummaryFields';

export default function SummaryFieldButton({
  sourceId,
  path,
}: {
  sourceId: string;
  path: string;
}) {
  const [fields, setFields] = useSummaryFields(sourceId);
  const field = summaryFieldForPath(path);
  const selected = fields.some(
    value => value.id === field.id || value.paths.includes(path),
  );
  return (
    <Tooltip
      label={selected ? 'Remove from summary' : 'Add to summary'}
      withArrow
    >
      <ActionIcon
        size="xs"
        variant="subtle"
        color={selected ? 'teal' : 'gray'}
        aria-label={
          selected ? `Remove ${path} from summary` : `Add ${path} to summary`
        }
        onClick={() =>
          setFields(current =>
            current.some(
              value => value.id === field.id || value.paths.includes(path),
            )
              ? current.filter(
                  value => value.id !== field.id && !value.paths.includes(path),
                )
              : [...current, field],
          )
        }
      >
        {selected ? <IconMinus size={14} /> : <IconPlus size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}
