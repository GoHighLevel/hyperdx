import { MantineProvider } from '@mantine/core';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';

import DashboardLoadingIndicator from '@/components/dashboard/DashboardLoadingIndicator';

function QueryPanel({
  range,
  load,
}: {
  range: string;
  load: () => Promise<number>;
}) {
  const { data } = useQuery({
    queryKey: ['panel', range],
    queryFn: load,
    staleTime: Infinity,
    placeholderData: previous => previous,
  });
  return <div>{data}</div>;
}

describe('dashboard query loading feedback', () => {
  it('shows loading with old data after a range change, until the new request settles', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(['panel', 'one day'], 100);
    let resolve: (value: number) => void = () => {};
    const pending = new Promise<number>(done => {
      resolve = done;
    });
    const view = (range: string) => (
      <QueryClientProvider client={client}>
        <DashboardLoadingIndicator />
        <QueryPanel range={range} load={() => pending} />
      </QueryClientProvider>
    );
    const { rerender, unmount } = render(view('one day'), {
      wrapper: MantineProvider,
    });
    expect(screen.queryByRole('status')).toBeNull();
    rerender(view('ten days'));
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Loading dashboard',
    );
    await act(async () => resolve(1000));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByText('1000')).toBeInTheDocument();
    unmount();
    client.clear();
  });

  it('clears feedback after errors and does not wait for an inactive superseded request', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let reject: (reason: Error) => void = () => {};
    const pending = new Promise<number>((_, fail) => {
      reject = fail;
    });
    const view = (showPanel: boolean) => (
      <QueryClientProvider client={client}>
        <DashboardLoadingIndicator />
        {showPanel && <QueryPanel range="current" load={() => pending} />}
      </QueryClientProvider>
    );
    const { rerender, unmount } = render(view(true), {
      wrapper: MantineProvider,
    });
    expect(await screen.findByRole('status')).toBeInTheDocument();
    rerender(view(false));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    rerender(view(true));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    await act(async () => reject(new Error('Query failed')));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    unmount();
    client.clear();
  });
});
