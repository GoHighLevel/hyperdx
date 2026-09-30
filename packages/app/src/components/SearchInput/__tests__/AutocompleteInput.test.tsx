import { useRef, useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AutocompleteInput from '@/components/SearchInput/AutocompleteInput';
import { tokenizeAtCursor } from '@/hooks/useAutoCompleteOptions';

function Editor({
  initial,
  onSubmit,
  loading = false,
}: {
  initial: string;
  onSubmit?: () => void;
  loading?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const [cursor, setCursor] = useState(initial.length);
  return (
    // jsdom has no element geometry, so Floating UI considers the input detached.
    <MantineProvider
      theme={{
        components: { Popover: { defaultProps: { hideDetached: false } } },
      }}
    >
      <AutocompleteInput
        inputRef={inputRef}
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        showSuggestionsOnEmpty
        isLoadingValues={loading}
        variableOptions={[
          {
            value: '$service',
            label: '$service',
            description: 'Selected service',
          },
        ]}
        onCursorChange={setCursor}
        tokenInfo={tokenizeAtCursor(value, cursor)}
        autocompleteOptions={[
          { value: 'service', label: 'service (string)' },
          { value: 'namespace', label: 'namespace (string)' },
          {
            value: 'json_payload.trace_id',
            label: 'json_payload.trace_id (string)',
          },
          { value: 'service:"api"', label: 'service:"api"' },
          { value: 'service:"api gateway"', label: 'service:"api gateway"' },
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

it.each(['', 'service:"api" AND\n'])(
  'suggests fields on an empty clause: %j',
  async initial => {
    render(<Editor initial={initial} />);
    const input = screen.getByRole<HTMLTextAreaElement>('textbox');
    await userEvent.click(input);
    await userEvent.click(await screen.findByText('namespace (string)'));
    expect(input).toHaveValue(initial + 'namespace:');
    expect(await screen.findByText('namespace:"payments"')).toBeVisible();
  },
);

it.each(['service:ap', 'service:"ap', 'service:"api g'])(
  'suggests matching values for %j',
  async initial => {
    render(<Editor initial={initial} />);
    const input = screen.getByRole<HTMLTextAreaElement>('textbox');
    await userEvent.click(input);
    expect(screen.queryByText('namespace:"payments"')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByText('service:"api gateway"'));
    expect(input).toHaveValue('service:"api gateway"');
  },
);

it('matches only the prefix before the caret and preserves subsequent clauses', async () => {
  render(<Editor initial={'service:apixxx AND namespace:"payments"'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(10, 10);
  fireEvent.select(input);
  await userEvent.click(await screen.findByText('service:"api"'));
  expect(input).toHaveValue('service:"api" AND namespace:"payments"');
});

it('preserves the value when completing a field name in an existing clause', async () => {
  render(<Editor initial={'serv:"api"'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(4, 4);
  fireEvent.select(input);
  await userEvent.click(await screen.findByText('service (string)'));
  expect(input).toHaveValue('service:"api"');
});

it('inserts a selected value with Tab without submitting the query', async () => {
  const submit = jest.fn();
  render(<Editor initial="service:ap" onSubmit={submit} />);
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}{Tab}');
  expect(input).toHaveValue('service:"api"');
  expect(submit).not.toHaveBeenCalled();
});

it('inserts a newline rather than accepting a highlighted suggestion on Shift+Enter', async () => {
  render(<Editor initial="service:ap" />);
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}{Shift>}{Enter}{/Shift}');
  expect(input).toHaveValue('service:ap\n');
});

it('dismisses suggestions without losing focus and reopens with Ctrl+Space', async () => {
  render(<Editor initial="service:ap" />);
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{Escape}');
  expect(input).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  await userEvent.keyboard('{Control>} {/Control}');
  await waitFor(() => expect(screen.getByRole('listbox')).toBeVisible());
});

it('does not accept a stale selection after typing another value', async () => {
  const submit = jest.fn();
  render(<Editor initial="service:ap" onSubmit={submit} />);
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}z{Enter}');
  expect(input).toHaveValue('service:apz');
  expect(submit).toHaveBeenCalledTimes(1);
});

it('preserves the field when completing a dashboard variable', async () => {
  render(<Editor initial="service:$ser" />);
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.click(await screen.findByText('$service'));
  expect(input).toHaveValue('service:$service');
});

it('preserves closing quotes and later clauses when editing a variable', async () => {
  render(<Editor initial={'service:"$serxxx" AND namespace:"payments"'} />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  await userEvent.click(input);
  input.setSelectionRange(13, 13);
  fireEvent.select(input);
  await userEvent.click(await screen.findByText('$service'));
  expect(input).toHaveValue('service:"$service" AND namespace:"payments"');
});

it('shows loading and empty states without preventing custom values', async () => {
  const { rerender } = render(<Editor initial="service:unknown" loading />);
  await userEvent.click(screen.getByRole('textbox'));
  await waitFor(() =>
    expect(screen.getByText('Loading suggestions…')).toBeVisible(),
  );
  rerender(<Editor initial="service:unknown" />);
  await waitFor(() =>
    expect(
      screen.getByText(
        'No matching suggestions. You can still type any value.',
      ),
    ).toBeVisible(),
  );
  expect(screen.getByRole('textbox')).toHaveValue('service:unknown');
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
