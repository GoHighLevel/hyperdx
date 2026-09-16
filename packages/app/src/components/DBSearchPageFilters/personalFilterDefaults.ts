const DEFAULT_VISIBLE_FILTERS = [
  'namespace_name',
  'deployment_name',
  'pod_name',
  'log_level',
];

export function isDefaultVisibleFilter(field: string) {
  return field === 'Level' || DEFAULT_VISIBLE_FILTERS.includes(field);
}
