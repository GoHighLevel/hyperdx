import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';

import SearchTotalCountChart from '@/components/SearchTotalCountChart';
import { useQueriedChartConfig } from '@/hooks/useChartConfig';

jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: { team: {} }, isLoading: false }) },
}));
jest.mock('@/hooks/useChartConfig', () => ({
  useQueriedChartConfig: jest.fn(),
}));
const config = {
  connection: 'test',
  from: { databaseName: 'db', tableName: 'logs' },
  timestampValueExpression: 'timestamp',
  select: 'count()',
  where: '',
  dateRange: [new Date(0), new Date(1000)] as [Date, Date],
};
it('waits without reporting zero results while the first log page has priority', () => {
  jest
    .mocked(useQueriedChartConfig)
    .mockReturnValue({ isLoading: false, isError: false } as ReturnType<
      typeof useQueriedChartConfig
    >);
  render(
    <SearchTotalCountChart
      config={config}
      queryKeyPrefix="search"
      enabled={false}
    />,
    { wrapper: MantineProvider },
  );
  expect(
    jest.mocked(useQueriedChartConfig).mock.calls.at(-1)?.[1]?.enabled,
  ).toBe(false);
  expect(screen.getByTestId('search-total-count')).not.toHaveTextContent(
    '0 Results',
  );
});
it('reports a count failure independently instead of claiming there are zero matching logs', () => {
  jest
    .mocked(useQueriedChartConfig)
    .mockReturnValue({ isLoading: false, isError: true } as ReturnType<
      typeof useQueriedChartConfig
    >);
  render(<SearchTotalCountChart config={config} queryKeyPrefix="search" />, {
    wrapper: MantineProvider,
  });
  expect(screen.getByTestId('search-total-count')).toHaveTextContent(
    'Count unavailable',
  );
});
