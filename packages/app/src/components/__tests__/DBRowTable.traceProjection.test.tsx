import { SourceKind } from '@hyperdx/common-utils/dist/types';
import { renderHook } from '@testing-library/react';

import { useConfigWithAdditionalSelect } from '@/components/DBRowTable';

let mockKind = SourceKind.Log;
jest.mock('@/source', () => ({
  ...jest.requireActual('@/source'),
  useSource: () => ({
    data: {
      id: 'logs',
      kind: mockKind,
      timestampValueExpression: 'EventDate, EventTime',
      displayedTimestampValueExpression: 'EventTime',
      traceIdExpression: "json_payload['trace_id']",
    },
  }),
}));
jest.mock('../LogSummaryDemo/useSummaryFields', () => ({
  useSummaryFields: () => [[]],
}));
jest.mock('@/hooks/useMetadata', () => ({
  useTableMetadata: () => ({
    data: { primary_key: 'EventDate, EventTime', partition_key: 'EventDate' },
  }),
  useColumns: () => ({
    data: [
      { name: 'EventDate' },
      { name: 'EventTime' },
      { name: 'json_payload' },
    ],
  }),
}));

const config = {
  select: 'EventTime, log',
  from: { databaseName: 'test', tableName: 'logs' },
  connection: 'connection',
  where: '',
  timestampValueExpression: 'EventDate, EventTime',
  dateRange: [new Date(0), new Date(1000)] as [Date, Date],
};

it('fetches configured trace and precise timestamps without requiring a selected Trace ID chip', () => {
  mockKind = SourceKind.Log;
  const { result } = renderHook(() =>
    useConfigWithAdditionalSelect(config, 'logs'),
  );
  expect(result.current?.select).toContain(
    "json_payload['trace_id'] AS __hdx_trace_id",
  );
  expect(result.current?.select).toContain('EventTime AS __hdx_timestamp');
  expect(result.current?.select).toContain(
    'EventDate AS __hdx_timestamp_value_0',
  );
  expect(result.current?.select).toContain(
    'EventTime AS __hdx_timestamp_value_1',
  );
  expect(result.current?.additionalKeysLength).toBe(6);
});

it('does not append log trace projections to a non-log table', () => {
  mockKind = SourceKind.Trace;
  const { result } = renderHook(() =>
    useConfigWithAdditionalSelect(config, 'traces'),
  );
  expect(result.current?.select).not.toContain('__hdx_trace_id');
});
