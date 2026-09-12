import { useRef, useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AutocompleteInput from '@/components/SearchInput/AutocompleteInput';
import { tokenizeAtCursor } from '@/hooks/useAutoCompleteOptions';

function Editor({ initial }: { initial: string }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const [cursor, setCursor] = useState(initial.length);
  return (
    <MantineProvider>
      <AutocompleteInput
        inputRef={inputRef}
        value={value}
        onChange={setValue}
        onCursorChange={setCursor}
        tokenInfo={tokenizeAtCursor(value, cursor)}
        autocompleteOptions={[
          { value: 'service:"api"', label: 'service:"api"' },
          { value: 'namespace:"payments"', label: 'namespace:"payments"' },
        ]}
      />
    </MantineProvider>
  );
}

it('replaces a multiline grouped token while preserving the other clauses', async () => {
  render(<Editor initial={'(service:"api") AND\n\t(namespace:)'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(input.value.length - 1, input.value.length - 1);
  fireEvent.select(input);
  await userEvent.click(await screen.findByText('namespace:"payments"'));
  expect(input).toHaveValue('(service:"api") AND\n\t(namespace:"payments")');
});

it('updates suggestions when the cursor moves without changing text', async () => {
  render(<Editor initial={'service: AND\nnamespace:'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(8, 8);
  fireEvent.select(input);
  await userEvent.click(await screen.findByText('service:"api"'));
  expect(input).toHaveValue('service:"api" AND\nnamespace:');
});
