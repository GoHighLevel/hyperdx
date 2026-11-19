import { summaryProjection } from '@/components/LogSummaryDemo/summaryProjection';

it('fetches trace identifiers even when no summary field is selected', () => {
  expect(
    summaryProjection(
      [
        { name: 'trace_id' },
        { name: 'TraceId' },
        { name: 'json_payload' },
        { name: 'unused' },
      ],
      [],
    ),
  ).toEqual(['`trace_id`', '`TraceId`', '`json_payload`']);
});

it('fetches existing roots for nested fields without turning user input into SQL', () => {
  expect(
    summaryProjection(
      [{ name: 'log' }, { name: 'pod_name' }, { name: 'private' }],
      ['log.request_id', 'pod_name', 'missing; DROP TABLE logs'],
    ),
  ).toEqual(['`log`', '`pod_name`']);
});

it('quotes schema column names and only selects the chosen custom root', () => {
  expect(
    summaryProjection(
      [{ name: 'custom' }, { name: 'other' }, { name: 'weird`name' }],
      ['custom.key', 'weird`name'],
    ),
  ).toEqual(['`custom`', '`weird\\`name`']);
});
