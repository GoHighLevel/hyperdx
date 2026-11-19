import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LogRowTraceButton from '@/components/LogSummaryDemo/LogRowTraceButton';

const traceId = '0123456789abcdef0123456789abcdef';
const timestamp = '2026-09-16T10:00:00.123Z';

it.each(['mouse', 'Enter', ' '])(
  'opens trace details with %s without expanding the log',
  async action => {
    const onOpenTrace = jest.fn();
    const onExpand = jest.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onExpand}>
        <LogRowTraceButton
          row={{ __hdx_trace_id: traceId, __hdx_timestamp: timestamp }}
          onOpenTrace={onOpenTrace}
        />
      </div>,
      { wrapper: MantineProvider },
    );
    const button = screen.getByRole('button', { name: 'View trace' });
    if (action === 'mouse') await user.click(button);
    else {
      button.focus();
      await user.keyboard(action === 'Enter' ? '{Enter}' : ' ');
    }
    expect(onExpand).not.toHaveBeenCalled();
    expect(onOpenTrace).toHaveBeenCalledTimes(1);
    expect(onOpenTrace).toHaveBeenCalledWith({
      traceId,
      focusDate: new Date(timestamp),
      dateRange: [
        new Date('2026-09-16T06:00:00.123Z'),
        new Date('2026-09-16T11:00:00.123Z'),
      ],
    });
  },
);

it.each([undefined, null, '', ' ', '00000000000000000000000000000000'])(
  'omits a trace action for unusable ID %s',
  id => {
    render(
      <LogRowTraceButton
        row={{ __hdx_trace_id: id, __hdx_timestamp: timestamp }}
        onOpenTrace={jest.fn()}
      />,
      { wrapper: MantineProvider },
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  },
);

it('finds a nested Google trace without a selected Trace ID field and uses the precise sort-key timestamp', async () => {
  const onOpenTrace = jest.fn();
  render(
    <LogRowTraceButton
      row={{
        json_payload: JSON.stringify({
          'logging.googleapis.com/trace': `projects/test/traces/${traceId}`,
        }),
        __hdx_timestamp: '2026-09-16',
        __hdx_timestamp_value_0: '2026-09-16',
        __hdx_timestamp_value_1: timestamp,
      }}
      timestampValueExpression="EventDate, EventTime"
      meta={[
        { name: '__hdx_timestamp_value_0', type: 'Date' },
        { name: '__hdx_timestamp_value_1', type: 'DateTime64(9)' },
      ]}
      onOpenTrace={onOpenTrace}
    />,
    { wrapper: MantineProvider },
  );
  await userEvent.click(screen.getByRole('button', { name: 'View trace' }));
  expect(onOpenTrace).toHaveBeenCalledWith(
    expect.objectContaining({ traceId, focusDate: new Date(timestamp) }),
  );
});

it('does not offer a broken action when the log timestamp is invalid', () => {
  render(
    <LogRowTraceButton
      row={{ __hdx_trace_id: traceId, __hdx_timestamp: 'invalid' }}
      onOpenTrace={jest.fn()}
    />,
    { wrapper: MantineProvider },
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
