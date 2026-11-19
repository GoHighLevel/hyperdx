const DEFAULT_VISIBLE_FILTERS = [
  'namespace_name',
  'deployment_name',
  'pod_name',
  'log_level',
];

export function isDefaultVisibleFilter(field: string) {
  return field === 'Level' || DEFAULT_VISIBLE_FILTERS.includes(field);
}

export function matchesPersonalFilterField(
  field: string,
  candidates: string[],
) {
  return candidates.includes(field);
}

const NO_SHARED_FIELDS: readonly string[] = [];
const GKE_SHARED_FIELDS = ['deployment_name', 'pod_name', 'log_level'] as const;

// Other sources retain their existing shared fields.
export function sharedFilterFieldsForColumns(
  kind: string | undefined,
  columns?: ReadonlySet<string>,
): readonly string[] | undefined {
  if (!kind || !columns) return NO_SHARED_FIELDS;
  return kind === 'log' && GKE_SHARED_FIELDS.every(field => columns.has(field))
    ? GKE_SHARED_FIELDS
    : undefined;
}
