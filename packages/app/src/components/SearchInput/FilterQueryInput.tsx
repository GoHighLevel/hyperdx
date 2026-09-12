import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import type { Filter } from '@hyperdx/common-utils/dist/types';

import { filterQueryPresentation } from './filterQueryText';
import SearchWhereInput, {
  type SearchWhereInputProps,
} from './SearchWhereInput';

type Props = Omit<
  SearchWhereInputProps,
  'control' | 'name' | 'onLanguageChange'
> & {
  where: string;
  filters: Filter[];
  language: 'sql' | 'lucene';
  onEdit: (query: string, remainingFilters: Filter[]) => void;
  onLanguageChange: (language: 'sql' | 'lucene') => void;
};

export default function FilterQueryInput({
  where,
  filters,
  language,
  onEdit,
  onLanguageChange,
  tableConnection,
  tableConnections,
  ...props
}: Props) {
  const tc = tableConnection
    ? { tableConnection }
    : { tableConnections: tableConnections ?? [] };
  const { text, remainingFilters } = useMemo(
    () => filterQueryPresentation(where, filters, language),
    [where, filters, language],
  );
  // The event subscription distinguishes user edits from checkbox-driven resets.
  // eslint-disable-next-line react-hook-form/no-use-watch
  const { watch, control } = useForm({
    values: { where: text, whereLanguage: language },
  });
  useEffect(() => {
    // Only input events transfer the visible text into the query. Resets from
    // checkbox changes keep their structured selection and uncheck behavior.
    // useWatch omits event.type, which is needed to distinguish resets from edits.

    const subscription = watch((value, event) => {
      if (event.type === 'change' && event.name === 'where')
        onEdit(value.where ?? '', remainingFilters);
    });
    return () => subscription.unsubscribe();
  }, [watch, onEdit, remainingFilters]);
  return (
    <SearchWhereInput
      {...props}
      {...tc}
      control={control}
      name="where"
      onLanguageChange={onLanguageChange}
    />
  );
}
