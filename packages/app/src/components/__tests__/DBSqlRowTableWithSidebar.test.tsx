import React, { ComponentProps } from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';

import DBSqlRowTableWithSideBar from '@/components/DBSqlRowTableWithSidebar';
import InlineLogDetails from '@/components/InlineLogDetails';
import DirectTraceSidePanel from '@/components/Search/DirectTraceSidePanel';

let mockShowRow = true;
const selection = {
  traceId: 'trace-123',
  traceSourceId: 'traces',
  dateRange: [
    new Date('2026-09-13T09:00:00Z'),
    new Date('2026-09-13T11:00:00Z'),
  ],
  focusDate: new Date('2026-09-13T10:00:00Z'),
};
jest.mock('nuqs', () => ({
  ...jest.requireActual('nuqs'),
  useQueryState: () => React.useState(null),
}));
jest.mock('@/source', () => ({
  useSource: (opts: { traceForLogSourceId?: string }) => ({
    data: opts.traceForLogSourceId
      ? { id: 'linked-traces', kind: 'trace' }
      : { id: 'logs', kind: 'log' },
  }),
}));
jest.mock('../DBRowSidePanel', () => ({
  __esModule: true,
  default: () => null,
  RowSidePanelContext: React.createContext({}),
}));
jest.mock('../DBRowTable', () => ({
  DBSqlRowTable: ({
    renderRowDetails,
    onOpenTrace,
  }: {
    renderRowDetails: (row: { id: string }) => React.ReactNode;
    onOpenTrace: (value: typeof selection) => void;
  }) =>
    mockShowRow ? (
      <>
        <button onClick={() => onOpenTrace(selection)}>Row trace button</button>
        {renderRowDetails({ id: 'original-log' })}
      </>
    ) : (
      <div>New live results</div>
    ),
}));
jest.mock('../InlineLogDetails', () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof InlineLogDetails>) => (
    <button
      onClick={() =>
        props.onOpenTrace?.({
          ...selection,
          dateRange: [selection.dateRange[0], selection.dateRange[1]],
        })
      }
    >
      View trace
    </button>
  ),
}));
jest.mock('../Search/DirectTraceSidePanel', () => ({
  __esModule: true,
  default: (props: ComponentProps<typeof DirectTraceSidePanel>) => (
    <div role="dialog">
      {props.traceId}
      <span>{props.traceSourceId}</span>
      <input aria-label="Trace filter" />
      <button onClick={props.onClose}>Close trace</button>
    </div>
  ),
}));

it('keeps the trace drawer mounted after its originating row leaves the live results', () => {
  mockShowRow = true;
  const config = {
    from: { databaseName: 'default', tableName: 'logs' },
    timestampValueExpression: 'timestamp',
    select: 'timestamp, log',
    where: '',
    connection: 'connection',
    dateRange: [selection.dateRange[0], selection.dateRange[1]] as [Date, Date],
  };
  const { rerender } = render(
    <DBSqlRowTableWithSideBar sourceId="logs" config={config} isLive />,
    { wrapper: MantineProvider },
  );
  fireEvent.click(screen.getByText('View trace'));
  const input = screen.getByRole('textbox', { name: 'Trace filter' });
  fireEvent.change(input, { target: { value: 'StatusCode:Error' } });
  mockShowRow = false;
  rerender(
    <DBSqlRowTableWithSideBar
      sourceId="logs"
      config={{ ...config, dateRange: [config.dateRange[0], new Date()] }}
      isLive
    />,
  );
  expect(screen.getByText('New live results')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Trace filter' })).toBe(input);
  expect(input).toHaveValue('StatusCode:Error');
  expect(screen.getByRole('dialog')).toHaveTextContent('trace-123');
  fireEvent.click(screen.getByText('Close trace'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens the linked trace source directly from a collapsed row', async () => {
  mockShowRow = true;
  render(
    <DBSqlRowTableWithSideBar
      sourceId="logs"
      config={{
        from: { databaseName: 'default', tableName: 'logs' },
        timestampValueExpression: 'timestamp',
        select: 'timestamp, log',
        where: '',
        connection: 'connection',
        dateRange: [selection.dateRange[0], selection.dateRange[1]],
      }}
    />,
    { wrapper: MantineProvider },
  );
  fireEvent.click(screen.getByText('Row trace button'));
  expect(screen.getByRole('dialog')).toHaveTextContent('trace-123');
  expect(screen.getByRole('dialog')).toHaveTextContent('linked-traces');
});
