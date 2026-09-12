import { useState } from 'react';
import { useController } from 'react-hook-form';
import type { Filter } from '@hyperdx/common-utils/dist/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import FilterQueryInput from '@/components/SearchInput/FilterQueryInput';

jest.mock('@/components/SearchInput/SearchWhereInput', () => ({
  __esModule: true,
  default: function Input({ control, name }: any) {
    const { field } = useController({ control, name });
    return <textarea aria-label="Query" {...field} />;
  },
}));

function Harness() {
  const [where, setWhere] = useState('error OR timeout');
  const [filters, setFilters] = useState<Filter[]>([]);
  return (
    <>
      <button
        onClick={() =>
          setFilters([{ type: 'sql', condition: "namespace_name IN ('api')" }])
        }
      >
        Include API
      </button>
      <button onClick={() => setFilters([])}>Clear filters</button>
      <FilterQueryInput
        where={where}
        filters={filters}
        language="lucene"
        onLanguageChange={() => {}}
        onEdit={(query, remaining) => {
          setWhere(query);
          setFilters(remaining);
        }}
      />
      <output data-testid="filters">{JSON.stringify(filters)}</output>
    </>
  );
}

it('shows checkbox filters without treating programmatic updates as edits', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('Include API'));
  await waitFor(() =>
    expect(screen.getByLabelText('Query')).toHaveValue(
      '(error OR timeout) AND\n(namespace_name:"api")',
    ),
  );
  expect(screen.getByTestId('filters')).toHaveTextContent('namespace_name IN');
  fireEvent.click(screen.getByText('Clear filters'));
  await waitFor(() =>
    expect(screen.getByLabelText('Query')).toHaveValue('error OR timeout'),
  );
});

it('transfers edited query text without retaining duplicate hidden selections', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('Include API'));
  const query = '(error OR timeout) AND namespace_name:"workers"';
  fireEvent.change(screen.getByLabelText('Query'), {
    target: { value: query },
  });
  await waitFor(() =>
    expect(screen.getByTestId('filters')).toHaveTextContent('[]'),
  );
  expect(screen.getByLabelText('Query')).toHaveValue(query);
});
