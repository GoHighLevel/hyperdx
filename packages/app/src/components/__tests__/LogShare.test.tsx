import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { hdxServer } from '@/api';
import { SharedLogLink, ShareLogButton } from '@/components/LogShare';
import { copyTextToClipboard } from '@/utils/clipboard';

const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    basePath: '',
    query: { id: 'abcdefghijklmnopqrstuvwx' },
    replace: mockReplace,
  }),
}));
jest.mock('@/api', () => ({ hdxServer: jest.fn() }));
jest.mock('@/components/LogSummaryDemo/useSummaryFields', () => ({
  useSummaryFields: () => [
    [{ id: 'contact', label: 'contact', paths: ['json_payload.contactId'] }],
  ],
}));
jest.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: jest.fn().mockResolvedValue(true),
}));
const source = '6aa77741acd7321c4deda7ba';
const render = (node: React.ReactNode) =>
  renderWithMantine(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {node}
    </QueryClientProvider>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(
    {},
    '',
    `/search?source=${source}&where=source&isLive=true`,
  );
});

it('copies a short authenticated URL after freezing the selected range', async () => {
  jest.mocked(hdxServer).mockReturnValue({
    json: async () => ({ id: 'abcdefghijklmnopqrstuvwx' }),
  } as never);
  render(
    <ShareLogButton
      sourceId={source}
      dateRange={[new Date(100), new Date(200)]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Share logs' }));
  await waitFor(() =>
    expect(copyTextToClipboard).toHaveBeenCalledWith(
      expect.stringMatching(/\/s\/abcdefghijklmnopqrstuvwx$/),
    ),
  );
  const options = jest.mocked(hdxServer).mock.calls[0][1];
  expect(JSON.stringify(options?.json)).toContain('isLive=false');
  expect(JSON.stringify(options?.json)).toContain('from=100');
  expect(JSON.stringify(options?.json)).toContain('summaryFields');
});

it('resolves the frozen search only after an authenticated API response', async () => {
  const target = `/search?source=${source}&from=100&to=200&isLive=false`;
  jest
    .mocked(hdxServer)
    .mockReturnValue({ json: async () => ({ target }) } as never);
  render(<SharedLogLink />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(target));
});

it('does not navigate to an unsafe returned target', async () => {
  jest.mocked(hdxServer).mockReturnValue({
    json: async () => ({ target: 'https://evil.example' }),
  } as never);
  render(<SharedLogLink />);
  await screen.findByText('This log link is unavailable');
  expect(mockReplace).not.toHaveBeenCalled();
});
