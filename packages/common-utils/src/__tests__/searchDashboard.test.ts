import {
  convertToDashboardDocument,
  convertToDashboardTemplate,
} from '@/core/utils';
import {
  DashboardSchema,
  DashboardTemplateSchema,
  SearchViewSchema,
} from '@/types';

const view = {
  version: 1,
  search: {
    source: 'logs',
    select: 'timestamp, message',
    where: '(level:*)',
    whereLanguage: 'lucene',
    filters: [],
    orderBy: 'timestamp ASC',
  },
  time: {
    from: 1789273161410,
    to: 1789274061411,
    isLive: true,
    liveInterval: 900000,
    refreshFrequency: 10000,
  },
  analysisMode: 'results',
  denoise: false,
  preferences: {
    'filters-expanded': false,
    'shared-filters-expanded': false,
    'hdx-show-matching-log-counts': true,
  },
  sharedPins: { fields: ['deployment_name', 'log_level'], filters: {} },
  personalPins: {
    fields: ['trace_id'],
    filters: { trace_id: ['abc'] },
    dismissedFields: ['pod_name'],
  },
  userPreferences: {
    isUTC: false,
    timeFormat: '12h',
    logFontSize: 16,
    font: 'IBM Plex Mono',
  },
};

it('round trips the complete search view independently of a saved search', () => {
  const dashboard = DashboardSchema.parse({
    id: 'dashboard',
    name: 'Logging',
    tiles: [],
    tags: ['stg'],
    searchView: view,
  });
  // The source name is resolved by the import mapping step.
  const template = DashboardTemplateSchema.parse(
    convertToDashboardTemplate(dashboard, [
      { id: 'logs', name: 'Staging logs' },
    ] as Parameters<typeof convertToDashboardTemplate>[1]),
  );
  expect(template.searchView?.search.source).toBe('Staging logs');
  expect(template.version).toBe('0.2.0');
  const restored = convertToDashboardDocument({
    ...template,
    searchView: {
      ...template.searchView!,
      search: { ...template.searchView!.search, source: 'logs' },
    },
  });
  const { id: _id, ...expected } = dashboard;
  expect(restored).toEqual(expected);
});

it('rejects unsupported search view versions and invalid time ranges', () => {
  expect(SearchViewSchema.safeParse({ ...view, version: 2 }).success).toBe(
    false,
  );
  expect(
    SearchViewSchema.safeParse({
      ...view,
      time: { ...view.time, from: view.time.to + 1 },
    }).success,
  ).toBe(false);
});

it('retains saved date ranges on ordinary dashboard import/export', () => {
  const dashboard = DashboardSchema.parse({
    id: 'd',
    name: 'Logs',
    tiles: [],
    tags: [],
    savedDateRange: { type: 'historical', value: [1, 2] },
  });
  expect(
    convertToDashboardDocument(convertToDashboardTemplate(dashboard, []))
      .savedDateRange,
  ).toEqual(dashboard.savedDateRange);
});

it('round-trips live refresh defaults and rejects unsafe intervals', () => {
  const dashboard = DashboardSchema.parse({
    id: 'live',
    name: 'Debugging',
    tiles: [],
    tags: [],
    savedDateRange: { type: 'relative', value: 900 },
    savedRefreshInterval: 30,
  });
  const imported = convertToDashboardDocument(
    convertToDashboardTemplate(dashboard, []),
  );
  expect(imported.savedRefreshInterval).toBe(30);
  expect(imported.savedDateRange).toEqual(dashboard.savedDateRange);
  for (const savedRefreshInterval of [0, 1, -1, 3601, 0.5]) {
    expect(
      DashboardSchema.safeParse({ ...dashboard, savedRefreshInterval }).success,
    ).toBe(false);
  }
});
