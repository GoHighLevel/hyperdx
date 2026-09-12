import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';

import ServiceMapSidePanel from '@/components/ServiceMap/ServiceMapSidePanel';

const mockRefetch = jest.fn();
const mockSource = jest.fn();
jest.mock('@/source', () => ({ useSource: () => mockSource() }));
jest.mock('../ServiceMap', () => ({
  __esModule: true,
  default: () => <div>Service graph</div>,
}));
jest.mock('@/components/Search/DirectTraceSidePanel', () => ({
  __esModule: true,
  default: () => <div>Trace source picker</div>,
}));

function renderMap() {
  render(
    <MantineProvider>
      <ServiceMapSidePanel
        traceId="trace"
        dateRange={[new Date(0), new Date(1000)]}
        traceTableSourceId="deleted"
      />
    </MantineProvider>,
  );
}

describe('service map source states', () => {
  it('explains a missing link and offers a source picker', () => {
    mockSource.mockReturnValue({ data: undefined, isLoading: false });
    renderMap();
    expect(screen.getByText('No linked trace source')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose trace source' }),
    );
    expect(screen.getByText('Trace source picker')).toBeVisible();
  });
  it('distinguishes fetch errors and supports retry', () => {
    mockSource.mockReturnValue({
      error: new Error('network'),
      refetch: mockRefetch,
    });
    renderMap();
    expect(screen.getByText('Unable to load trace source')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalled();
  });
  it('shows loading instead of an empty map', () => {
    mockSource.mockReturnValue({ isLoading: true });
    renderMap();
    expect(screen.getByText('Loading trace source')).toBeVisible();
    expect(
      screen.queryByText('No linked trace source'),
    ).not.toBeInTheDocument();
  });
});
