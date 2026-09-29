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
        enableCommentToggle
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

it('comments and uncomments the selected Lucene lines from the keyboard', async () => {
  render(<Editor initial={'service:"api"\nnamespace:"payments"'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(0, input.value.length);

  fireEvent.keyDown(input, { key: '/', metaKey: true });
  expect(input).toHaveValue('// service:"api"\n// namespace:"payments"');

  input.setSelectionRange(0, input.value.length);
  fireEvent.keyDown(input, { key: '/', metaKey: true });
  expect(input).toHaveValue('service:"api"\nnamespace:"payments"');
});

it('offers an accessible Lucene comment toggle', async () => {
  render(<Editor initial={'service:"api"'} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Comment or uncomment query lines' }),
  );

  expect(screen.getByRole('textbox')).toHaveValue('// service:"api"');
});

it('visually distinguishes commented Lucene lines', () => {
  render(<Editor initial={'// service:"api"\nnamespace:"payments"'} />);

  const overlay = screen.getByTestId('lucene-comment-highlighting');
  expect(overlay.querySelector('.commentedLine')).toHaveTextContent(
    '// service:"api"',
  );
});
