import React from 'react';
import type { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import {
  extractSampledFields,
  useQueryScopedFields,
} from '@/hooks/useQueryScopedFields';

const mockQuery = jest.fn();
const mockRender = jest.fn();
jest.mock('@/clickhouse', () => ({
  getClickhouseClient: () => ({ query: mockQuery }),
}));
jest.mock('@/hooks/useMetadata', () => ({
  useMetadataWithSettings: () => ({}),
}));
jest.mock('@hyperdx/common-utils/dist/core/renderChartConfig', () => ({
  renderChartConfig: (...args: unknown[]) => mockRender(...args),
}));

const columns = [
  { name: 'deployment_name', type: 'String' },
  { name: 'json_payload', type: 'Map(String, String)' },
];
const config = {
  connection: 'connection',
  source: 'logs',
  from: { databaseName: 'prod_logs', tableName: 'logs' },
  timestampValueExpression: 'timestamp',
  select: 'log',
  where: 'deployment_name:billing-api',
  whereLanguage: 'lucene',
  filters: [],
  dateRange: [new Date(0), new Date(3600000)],
} satisfies BuilderChartConfigWithDateRange;

it('discovers only nonempty fields in matching sampled records and preserves dotted map keys', () => {
  const fields = extractSampledFields(
    [
      {
        deployment_name: 'billing-api',
        json_payload: { 'request.id': '1', empty: '' },
      },
    ],
    columns,
  );
  expect(fields.map(f => f.path)).toEqual([
    ['deployment_name'],
    ['json_payload', 'request.id'],
  ]);
});

it('keeps active predicates and time range, bounds discovery, and clears fields when the workload changes', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  mockRender.mockResolvedValue({ sql: 'SELECT sampled', params: {} });
  mockQuery.mockResolvedValueOnce({
    json: async () => [
      { deployment_name: 'billing-api', json_payload: { billingOnly: 'a' } },
    ],
  });
  const { result, rerender } = renderHook(
    ({ where }) => useQueryScopedFields({ ...config, where }, columns, true),
    { wrapper, initialProps: { where: config.where } },
  );
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(mockRender.mock.calls[0][0]).toMatchObject({
    where: config.where,
    dateRange: config.dateRange,
    limit: { limit: 200 },
  });
  expect(mockQuery.mock.calls[0][0]).toMatchObject({
    clickhouse_settings: {
      max_rows_to_read: '200000',
      read_overflow_mode: 'break',
    },
  });
  mockQuery.mockImplementation(() => new Promise(() => {}));
  rerender({ where: 'deployment_name:contacts-api' });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);
});

it('binds schema-derived select identifiers including the production log_level placeholder', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  mockRender.mockImplementation(
    async (sample: BuilderChartConfigWithDateRange) => ({
      sql: `SELECT ${sample.select} FROM logs`,
      params: { predicate_value: 'billing-api' },
    }),
  );
  mockQuery.mockImplementation(
    async ({
      query,
      query_params,
    }: {
      query: string;
      query_params: Record<string, unknown>;
    }) => {
      for (const match of query.matchAll(
        /\{(HYPERDX_PARAM_\d+):Identifier\}/g,
      )) {
        if (!(match[1] in query_params))
          throw new Error(`Substitution ${match[1]} is not set`);
      }
      return {
        json: async () => [
          { timestamp: '2026-11-19', json_payload: { contactId: 'test' } },
        ],
      };
    },
  );
  const { result } = renderHook(
    () =>
      useQueryScopedFields(
        config,
        [
          { name: 'timestamp', type: 'String' },
          { name: 'log_level', type: 'String' },
          ...columns,
          { name: 'weird`column', type: 'String' },
        ],
        true,
      ),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const request = mockQuery.mock.calls.at(-1)?.[0];
  expect(request.query_params.HYPERDX_PARAM_2006901047).toBe('log_level');
  expect(Object.values(request.query_params)).toContain('weird`column');
  expect(request.query_params.predicate_value).toBe('billing-api');
  expect(request.query).not.toContain('weird`column');
});
