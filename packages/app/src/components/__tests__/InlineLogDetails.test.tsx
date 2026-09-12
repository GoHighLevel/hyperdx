import React from 'react';
import { SourceKind, TLogSource } from '@hyperdx/common-utils/dist/types';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';

import ExpandedLogRow from '@/components/InlineLogDetails';

let mockTraceId: string | undefined = 'trace-123';
let mockStoredTab = 'columnValues';
const mockMap = jest.fn();
const mockTrace = jest.fn();
jest.mock('@/utils', () => ({
  useLocalStorage: (_key: string, fallback: string) =>
    React.useState(mockStoredTab ?? fallback),
}));
jest.mock('@/source', () => ({
  useSource: () => ({ data: { id: 'recovered-traces', kind: 'trace' } }),
}));
jest.mock('../DBRowDataPanel', () => ({
  useRowData: () => ({
    data: {
      data: [
        {
          __hdx_trace_id: mockTraceId,
          __hdx_timestamp: '2026-09-13T10:00:00Z',
        },
      ],
    },
  }),
  RowDataPanel: () => <div>Log fields</div>,
}));
jest.mock('../DBRowOverviewPanel', () => ({
  RowOverviewPanel: () => <div>Log overview</div>,
}));
jest.mock('../DBRowSidePanelErrorState', () => ({
  DBRowSidePanelErrorState: () => null,
}));
jest.mock('../ServiceMap/ServiceMapSidePanel', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockMap(props);
    return <div>Service graph</div>;
  },
}));
jest.mock('../Search/DirectTraceSidePanel', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockTrace(props);
    return <div>Trace waterfall</div>;
  },
}));

const source: TLogSource = {
  id: 'logs',
  name: 'Logs',
  kind: SourceKind.Log,
  connection: 'connection',
  from: { databaseName: 'default', tableName: 'logs' },
  timestampValueExpression: 'timestamp',
  defaultTableSelectExpression: 'timestamp, log',
};

describe('expanded log trace navigation', () => {
  beforeEach(() => {
    mockTraceId = 'trace-123';
    mockStoredTab = 'columnValues';
    jest.clearAllMocks();
  });
  it('loads the service map only after selecting its tab', () => {
    render(
      <MantineProvider>
        <ExpandedLogRow source={source} rowId="row" onOpenDetails={jest.fn()} />
      </MantineProvider>,
    );
    expect(mockMap).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Service map'));
    expect(screen.getByText('Service graph')).toBeVisible();
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-123',
        traceTableSourceId: 'recovered-traces',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'View trace' }));
    expect(mockTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-123',
        traceSourceId: 'recovered-traces',
      }),
    );
  });
  it('falls back to column values when the remembered map tab has no trace', () => {
    mockTraceId = undefined;
    mockStoredTab = 'serviceMap';
    render(
      <MantineProvider>
        <ExpandedLogRow source={source} rowId="row" onOpenDetails={jest.fn()} />
      </MantineProvider>,
    );
    expect(screen.getByText('Log fields')).toBeVisible();
    expect(screen.queryByText('Service map')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View trace' }),
    ).not.toBeInTheDocument();
  });
});
