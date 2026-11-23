import { MantineProvider } from '@mantine/core';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FilterGroup } from '@/components/DBSearchPageFilters';
import SummaryFieldButton from '@/components/LogSummaryDemo/SummaryFieldButton';
import SummaryFieldPicker from '@/components/LogSummaryDemo/SummaryFieldPicker';
import { useSummaryFields } from '@/components/LogSummaryDemo/useSummaryFields';
import { parseSharedSummaryFields } from '@/components/LogSummaryDemo/useSummaryFields';

let mockEmail = 'dev@example.com';
let mockDefaults: string[] | undefined;
jest.mock('@/api', () => ({
  __esModule: true,
  default: {
    useMe: () => ({
      data: {
        email: mockEmail,
        role: 'dev',
        team: { developerUI: { defaultSummaryFields: mockDefaults } },
      },
    }),
  },
}));

jest.mock('@/usePermissions', () => ({
  usePermissions: () => ({ canManageShared: false }),
}));
jest.mock('@/hooks/useMetadata', () => ({
  useGetValueCounts: () => ({ data: undefined, isFetching: false }),
  useGetValuesDistribution: () => ({ data: undefined, isFetching: false }),
}));
const oldColumnToggle = jest.fn();
const changeQuery = jest.fn();

it('reads shared fields only for the linked source and rejects malformed snapshots', () => {
  const fields = [
    { id: 'contact', label: 'contact', paths: ['json_payload.contactId'] },
  ];
  const params = new URLSearchParams({
    source: 'logs',
    summaryFields: JSON.stringify(fields),
  });
  expect(parseSharedSummaryFields('?' + params, 'logs')).toEqual(fields);
  expect(parseSharedSummaryFields('?' + params, 'other')).toBeUndefined();
  expect(
    parseSharedSummaryFields('?source=logs&summaryFields=bad', 'logs'),
  ).toBeUndefined();
});

function Picker() {
  const [fields, setFields, availableFields, removeField, resetFields] =
    useSummaryFields('logs');
  return (
    <SummaryFieldPicker
      fields={fields}
      setFields={setFields}
      availableFields={availableFields}
      onRemoveField={removeField}
      onReset={resetFields}
    />
  );
}

function Controls() {
  return (
    <MantineProvider>
      <FilterGroup
        name="product"
        distributionKey="labels['product']"
        summarySourceId="logs"
        options={[]}
        onChange={changeQuery}
        onClearClick={() => {}}
        onOnlyClick={() => {}}
        onExcludeClick={() => {}}
        valuePins={{ onPinClick: () => {}, isPinned: () => false }}
        onColumnToggle={oldColumnToggle}
        onLoadMore={() => {}}
        loadMoreLoading={false}
        hasLoadedMore={false}
        chartConfig={{
          from: { databaseName: 'test', tableName: 'logs' },
          select: '',
          where: '',
          whereLanguage: 'sql',
          timestampValueExpression: 'timestamp',
          connection: 'test',
          dateRange: [new Date(0), new Date(1000)],
        }}
      />
      <SummaryFieldButton sourceId="logs" path="deployment_name" />
      <Picker />
    </MantineProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/search');
  mockEmail = 'dev@example.com';
  mockDefaults = undefined;
  oldColumnToggle.mockClear();
  changeQuery.mockClear();
});

it('opens shared summary fields without overwriting preferences, then persists an explicit edit', () => {
  const personal = { id: 'pod', label: 'pod', paths: ['pod_name'] };
  const shared = {
    id: 'contact',
    label: 'contact',
    paths: ['json_payload.contactId'],
  };
  const stored = JSON.stringify({ 'dev@example.com:logs': [personal] });
  localStorage.setItem('log-summary-fields-v1', stored);
  window.history.replaceState(
    {},
    '',
    '/search?' +
      new URLSearchParams({
        source: 'logs',
        summaryFields: JSON.stringify([shared]),
      }),
  );
  const hook = renderHook(() => useSummaryFields('logs'));
  expect(hook.result.current[0]).toEqual([shared]);
  expect(localStorage.getItem('log-summary-fields-v1')).toBe(stored);
  act(() => hook.result.current[1](current => [...current, personal]));
  expect(hook.result.current[0]).toEqual([shared, personal]);
  expect(new URLSearchParams(window.location.search).has('summaryFields')).toBe(
    false,
  );
  expect(
    JSON.parse(localStorage.getItem('log-summary-fields-v1') ?? '{}')[
      'dev@example.com:logs'
    ],
  ).toEqual([shared, personal]);
});

it('adds a sidebar field, reorders it, and remembers it after unchecking and remounting', async () => {
  const user = userEvent.setup();
  const view = render(<Controls />);
  await user.click(
    screen.getByRole('button', { name: 'Add labels.product to summary' }),
  );
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).toBeChecked();
  expect(oldColumnToggle).not.toHaveBeenCalled();
  expect(changeQuery).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Remove labels.product from summary' }),
  ).toBeEnabled();
  await user.click(
    screen.getByRole('button', { name: 'Move labels.product up' }),
  );
  expect(screen.getAllByRole('checkbox')[2]).toHaveAccessibleName(
    'labels.product',
  );
  await user.click(screen.getByRole('checkbox', { name: 'labels.product' }));
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeChecked();
  view.unmount();
  render(<Controls />);
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'labels.product' }));
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).toBeChecked();
  expect(
    screen.getAllByRole('checkbox', { name: 'deployment_name' }),
  ).toHaveLength(1);
});

it('supports adding and removing from the sidebar with keyboard and keeps the dropdown synchronized', async () => {
  const user = userEvent.setup();
  render(<Controls />);
  const add = screen.getByRole('button', {
    name: 'Add labels.product to summary',
  });
  add.focus();
  await user.keyboard('{Enter}');
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).toBeChecked();
  const remove = screen.getByRole('button', {
    name: 'Remove labels.product from summary',
  });
  expect(remove).toHaveFocus();
  await user.keyboard(' ');
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('button', { name: 'Add labels.product to summary' }),
  ).toHaveFocus();
  await user.click(screen.getByRole('checkbox', { name: 'labels.product' }));
  await user.click(
    screen.getByRole('button', { name: 'Remove labels.product from summary' }),
  );
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'deployment_name' }),
  ).toBeChecked();
  expect(oldColumnToggle).not.toHaveBeenCalled();
  expect(changeQuery).not.toHaveBeenCalled();
});

it('keeps existing v1 selections and separates users and sources', () => {
  const field = {
    id: 'custom:labels.product',
    label: 'labels.product',
    paths: ['labels.product'],
  };
  localStorage.setItem(
    'log-summary-fields-v1',
    JSON.stringify({ 'dev@example.com:logs': [field] }),
  );
  const first = renderHook(() => useSummaryFields('logs'));
  expect(first.result.current[0]).toEqual([field]);
  act(() => first.result.current[1]([]));
  expect(first.result.current[2]).toContainEqual(field);
  const otherSource = renderHook(() => useSummaryFields('other-logs'));
  expect(otherSource.result.current[2]).not.toContainEqual(field);
  mockEmail = 'other@example.com';
  const otherUser = renderHook(() => useSummaryFields('logs'));
  expect(otherUser.result.current[2]).not.toContainEqual(field);
});

it('removes entries entirely, persists removal, and allows adding them again from the sidebar', async () => {
  const user = userEvent.setup();
  const view = render(<Controls />);
  await user.click(
    screen.getByRole('button', { name: 'Add labels.product to summary' }),
  );
  await user.click(screen.getByRole('checkbox', { name: 'labels.product' }));
  await user.click(
    screen.getByRole('button', {
      name: 'Remove labels.product from field list',
    }),
  );
  expect(
    screen.queryByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'HTTP status' })).toHaveFocus();
  await user.click(
    screen.getByRole('button', {
      name: 'Remove deployment_name from field list',
    }),
  );
  view.unmount();
  render(<Controls />);
  expect(
    screen.queryByRole('checkbox', { name: 'labels.product' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('checkbox', { name: 'deployment_name' }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Add labels.product to summary' }),
  );
  expect(
    screen.getByRole('checkbox', { name: 'labels.product' }),
  ).toBeChecked();
});

it('uses current team defaults until personalized and resets to the latest admin order', () => {
  mockDefaults = ['cluster_name', 'pod_name'];
  const hook = renderHook(() => useSummaryFields('logs'));
  expect(hook.result.current[0].map(field => field.id)).toEqual([
    'cluster_name',
    'pod_name',
  ]);
  expect(hook.result.current[2]).toEqual(hook.result.current[0]);
  act(() => hook.result.current[3](hook.result.current[0][0]));
  mockDefaults = ['deployment_name', 'labels.product'];
  hook.rerender();
  expect(hook.result.current[0].map(field => field.id)).toEqual(['pod_name']);
  act(() => hook.result.current[4]());
  expect(hook.result.current[0].map(field => field.id)).toEqual([
    'deployment_name',
    'custom:labels.product',
  ]);
  mockDefaults = [];
  hook.rerender();
  expect(hook.result.current[0]).toEqual([]);
});

it('does not lose additions made by separate controls in the same batch', () => {
  const first = renderHook(() => useSummaryFields('logs'));
  const second = renderHook(() => useSummaryFields('logs'));
  const field = (name: string) => ({
    id: `custom:${name}`,
    label: name,
    paths: [name],
  });
  act(() => {
    first.result.current[1](current => [...current, field('labels.product')]);
    second.result.current[1](current => [...current, field('labels.team')]);
  });
  expect(first.result.current[0].slice(-2)).toEqual([
    field('labels.product'),
    field('labels.team'),
  ]);
});

it('automatically selects a filtered JSON field in Add fields exactly once', () => {
  const hook = renderHook(() => useSummaryFields('logs'));
  const original = hook.result.current[0].map(field => field.id);
  act(() => hook.result.current[5]("json_payload['request.id']"));
  expect(hook.result.current[0].map(field => field.id)).toEqual([
    ...original,
    'custom:json_payload.request.id',
  ]);
  expect(hook.result.current[2].at(-1)?.paths).toEqual([
    'json_payload.request.id',
  ]);
  act(() => hook.result.current[5]("json_payload['request.id']"));
  expect(hook.result.current[0]).toHaveLength(original.length + 1);
});
