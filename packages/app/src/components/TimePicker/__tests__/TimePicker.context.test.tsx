import { Provider } from 'jotai';
import { MantineProvider, Popover } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TimePicker } from '@/components/TimePicker';

let mockIsUTC = true;
jest.mock('@/useUserPreferences', () => ({
  useUserPreferences: () => ({
    userPreferences: { timeFormat: '24h', isUTC: mockIsUTC },
  }),
}));

const renderPicker = (
  inputValue = 'Oct 1 2026 12:00:00 - Oct 11 2026 12:30:00',
) => {
  const onSearch = jest.fn();
  render(
    <MantineProvider
      theme={{
        components: {
          Popover: Popover.extend({
            defaultProps: {
              hideDetached: false,
              transitionProps: { duration: 0 },
            },
          }),
        },
      }}
    >
      <Provider>
        <TimePicker
          inputValue={inputValue}
          setInputValue={jest.fn()}
          onSearch={onSearch}
        />
      </Provider>
    </MantineProvider>,
  );
  fireEvent.click(screen.getByTestId('time-picker-input'));
  return onSearch;
};

describe('time picker context', () => {
  beforeEach(() => {
    localStorage.clear();
    mockIsUTC = true;
  });

  it('shows the input timezone, full timestamps and elapsed duration', async () => {
    renderPicker();
    expect(await screen.findByText('Input range preview')).toBeInTheDocument();
    expect(screen.getByText('Time zone: UTC')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-01 12:00:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-11 12:30:00/)).toBeInTheDocument();
    expect(
      screen.getByText('Duration: 10 days 30 minutes'),
    ).toBeInTheDocument();
  });

  it('identifies browser-local input without claiming it is UTC', async () => {
    mockIsUTC = false;
    renderPicker();
    expect(
      await screen.findByText(
        `Time zone: Browser (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/2026-10-01 12:00:00/)).toBeInTheDocument();
  });

  it('does not show fabricated timestamps for unparseable input', async () => {
    renderPicker('not a date');
    await screen.findByTestId('time-picker-popover');
    expect(screen.queryByText('Input range preview')).not.toBeInTheDocument();
    expect(screen.getByText('Time zone: UTC')).toBeInTheDocument();
  });

  it('measures elapsed time across a daylight-saving offset change', async () => {
    renderPicker('Mar 8 2020 00:00:00 GMT-0600 - Mar 9 2020 00:00:00 GMT-0500');
    expect(await screen.findByText('Duration: 23 hours')).toBeInTheDocument();
    expect(screen.getByText(/2020-03-08 06:00:00.000Z/)).toBeInTheDocument();
    expect(screen.getByText(/2020-03-09 05:00:00.000Z/)).toBeInTheDocument();
  });

  it('filters presets without submitting the range and restores them on clear', async () => {
    const onSearch = renderPicker();
    const search = await screen.findByRole('textbox', {
      name: 'Search time presets',
    });
    await userEvent.type(search, 'HOUR{Enter}');
    expect(
      screen.getByRole('button', { name: 'Last 1 hour' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Last 1 minute' }),
    ).not.toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
    act(() =>
      screen.getByRole('button', { name: 'Clear preset search' }).focus(),
    );
    await userEvent.keyboard('{Enter}');
    expect(onSearch).not.toHaveBeenCalled();
    expect(search).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Last 1 minute' }),
    ).toBeInTheDocument();
    await userEvent.type(search, 'zzzz');
    expect(screen.getByText('No matching presets')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.click(screen.getByRole('button', { name: 'Last 1 hour' }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('Last 1 hour');
  });
});
