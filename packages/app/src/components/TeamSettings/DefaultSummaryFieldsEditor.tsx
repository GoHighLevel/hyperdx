import { useMemo } from 'react';

import { summaryFieldForPath } from '@/components/LogSummaryDemo/resolveFields';
import SummaryFieldPicker from '@/components/LogSummaryDemo/SummaryFieldPicker';

export default function DefaultSummaryFieldsEditor({
  paths,
  onChange,
  disabled,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled: boolean;
}) {
  const fields = useMemo(() => paths.map(summaryFieldForPath), [paths]);
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
      <SummaryFieldPicker
        title="Default summary fields"
        description="Choose the starting fields and order for the team. Personal layouts stay intact; users can choose Reset to team defaults."
        fields={fields}
        setFields={next =>
          onChange(
            (typeof next === 'function' ? next(fields) : next).map(
              field => field.paths[0],
            ),
          )
        }
        onRemoveField={field =>
          onChange(
            fields
              .filter(value => value.id !== field.id)
              .map(value => value.paths[0]),
          )
        }
      />
    </fieldset>
  );
}
