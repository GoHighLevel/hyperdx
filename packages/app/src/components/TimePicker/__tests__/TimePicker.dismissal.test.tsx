import { Provider } from 'jotai';
import { MantineProvider, Popover } from '@mantine/core';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TimePicker } from '@/components/TimePicker/TimePicker';

jest.mock('@/useUserPreferences', () => ({
  useUserPreferences: () => ({ userPreferences: { timeFormat: '24h' } }),
}));

const renderPicker = (ui: React.ReactNode) =>
  render(
    <MantineProvider
      theme={{
        components: {
          Popover: Popover.extend({
            defaultProps: {
              // jsdom has no layout, so every target would appear detached.
              hideDetached: false,
              transitionProps: { duration: 0 },
            },
          }),
        },
      }}
    >
      {ui}
    </MantineProvider>,
  );

describe('TimePicker dismissal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(['mouse', 'touch'])(
    'dismisses on outside %s interaction and can reopen to select a range',
    async interaction => {
      const onSearch = jest.fn();
      renderPicker(
        <Provider>
          <TimePicker
            inputValue="Last 15 minutes"
            setInputValue={jest.fn()}
            onSearch={onSearch}
          />
          <button type="button">Outside picker</button>
        </Provider>,
      );
      const input = screen.getByTestId('time-picker-input');
      await userEvent.click(input);
      expect(await screen.findByTestId('time-picker-popover')).toBeVisible();

      const outside = screen.getByRole('button', { name: 'Outside picker' });
      if (interaction === 'touch') {
        fireEvent.touchStart(outside);
      } else {
        await userEvent.click(outside);
      }
      await waitFor(() =>
        expect(
          screen.queryByTestId('time-picker-popover'),
        ).not.toBeInTheDocument(),
      );
      expect(onSearch).not.toHaveBeenCalled();

      await userEvent.click(input);
      await screen.findByTestId('time-picker-popover');
      await userEvent.click(
        screen.getByRole('button', { name: 'Last 1 hour' }),
      );
      expect(onSearch).toHaveBeenCalledWith('Last 1 hour');
      await waitFor(() =>
        expect(
          screen.queryByTestId('time-picker-popover'),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it('dismisses with Escape while focus is inside the popover', async () => {
    renderPicker(
      <Provider>
        <TimePicker
          inputValue="Last 15 minutes"
          setInputValue={jest.fn()}
          onSearch={jest.fn()}
        />
      </Provider>,
    );
    await userEvent.click(screen.getByTestId('time-picker-input'));
    await screen.findByTestId('time-picker-popover');
    screen.getByTestId('time-picker-apply').focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByTestId('time-picker-popover'),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps the parent open when using the calendar and duration dropdown', async () => {
    renderPicker(
      <Provider>
        <TimePicker
          inputValue="Last 15 minutes"
          setInputValue={jest.fn()}
          onSearch={jest.fn()}
        />
      </Provider>,
    );
    await userEvent.click(screen.getByTestId('time-picker-input'));
    const popover = await screen.findByTestId('time-picker-popover');
    await userEvent.click(
      within(popover).getAllByPlaceholderText('YYYY-MM-DD HH:mm:ss')[0],
    );
    await waitFor(() =>
      expect(
        popover.querySelector('button[data-direction="previous"]'),
      ).toBeInTheDocument(),
    );
    const previousMonth = popover.querySelector(
      'button[data-direction="previous"]',
    );
    if (!previousMonth) throw new Error('Calendar navigation is missing');
    await userEvent.click(previousMonth);
    expect(popover).toBeVisible();

    await userEvent.click(screen.getByLabelText('Around a time'));
    await userEvent.click(screen.getByPlaceholderText('Pick value'));
    await userEvent.click(await screen.findByRole('option', { name: '1h' }));
    expect(screen.getByTestId('time-picker-popover')).toBeVisible();
    expect(screen.getByPlaceholderText('Pick value')).toHaveValue('1h');
  });
});
