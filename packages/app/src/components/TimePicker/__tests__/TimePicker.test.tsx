import React from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { DisplayType } from '@hyperdx/common-utils/dist/types';
import { fireEvent, screen } from '@testing-library/react';

import { TimePicker } from '@/components/TimePicker';
import {
  getRelativeTimeOptionLabel,
  parseTimeRangeInput,
} from '@/components/TimePicker/utils';
import { dashboardHasMonitoring } from '@/utils/dashboardTimeRange';

jest.mock('@/useUserPreferences', () => ({
  useUserPreferences: () => ({ userPreferences: { timeFormat: '24h' } }),
}));

describe('monitoring time ranges', () => {
  it('keeps the 90-day preset out of the default log/trace picker', async () => {
    renderWithMantine(
      <TimePicker
        inputValue="Last 15 minutes"
        setInputValue={jest.fn()}
        onSearch={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByPlaceholderText('Time Range'));
    expect(
      await screen.findByRole('button', { name: 'Last 30 days' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Last 90 days' }),
    ).not.toBeInTheDocument();
  });

  it('selects and parses 90 days for monitoring', async () => {
    const onSearch = jest.fn();
    renderWithMantine(
      <TimePicker
        monitoring
        inputValue="Last 15 minutes"
        setInputValue={jest.fn()}
        onSearch={onSearch}
      />,
    );
    fireEvent.click(screen.getByPlaceholderText('Time Range'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Last 90 days' }),
    );
    expect(onSearch).toHaveBeenCalledWith('Last 90 days');
    const [start, end] = parseTimeRangeInput('Last 90 days');
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(differenceInCalendarDays(end!, start!)).toBe(90);
    expect(getRelativeTimeOptionLabel(90 * 86400000)).toBe('Last 90 days');
  });

  it('offers 90 days on a monitoring dashboard with SQL log evidence', async () => {
    const onSearch = jest.fn();
    renderWithMantine(
      <TimePicker
        monitoring={dashboardHasMonitoring([
          {
            config: {
              configType: 'promql',
              promqlExpression: 'up',
              connection: 'vm',
              displayType: DisplayType.Line,
            },
          },
          {
            config: {
              configType: 'sql',
              sqlTemplate: 'SELECT log FROM logs',
              connection: 'ch',
              displayType: DisplayType.Table,
            },
          },
        ])}
        inputValue="Last 30 days"
        setInputValue={jest.fn()}
        onSearch={onSearch}
      />,
    );
    fireEvent.click(screen.getByPlaceholderText('Time Range'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Last 90 days' }),
    );
    expect(onSearch).toHaveBeenCalledWith('Last 90 days');
  });

  it('supports a rolling 90-day monitoring window', async () => {
    const onRelativeSearch = jest.fn();
    renderWithMantine(
      <TimePicker
        monitoring
        defaultRelativeTimeMode
        inputValue="Last 15 minutes"
        setInputValue={jest.fn()}
        onSearch={jest.fn()}
        onRelativeSearch={onRelativeSearch}
      />,
    );
    fireEvent.click(screen.getByPlaceholderText('Time Range'));
    const preset = await screen.findByRole('button', { name: 'Last 90 days' });
    expect(preset).toBeEnabled();
    fireEvent.click(preset);
    expect(onRelativeSearch).toHaveBeenCalledWith(90 * 86400000);
  });
});
