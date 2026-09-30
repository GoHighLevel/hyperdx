// Group for display only. Leaves retain their original dotted storage key so
// Map lookups and JSONExtract arguments still address the underlying data.
export function jsonTreeEntries(data: object, groupDottedKeys: boolean) {
  const entries = Object.entries(data).map(([key, value]) => ({
    key,
    value,
    grouped: false,
  }));
  if (Array.isArray(data)) return entries;
  const groups = new Map<string, [string, unknown][]>();
  const leaves = entries.filter(({ key, value }) => {
    const dot = key.indexOf('.');
    const prefix = key.slice(0, dot);
    if (
      !groupDottedKeys ||
      dot <= 0 ||
      key.split('.').some(part => part.length === 0) ||
      Object.hasOwn(data, prefix)
    ) {
      return true;
    }
    const children = groups.get(prefix) ?? [];
    children.push([key.slice(dot + 1), value]);
    groups.set(prefix, children);
    return false;
  });
  for (const [key, children] of groups) {
    leaves.push({ key, value: Object.fromEntries(children), grouped: true });
  }
  return leaves.sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { numeric: true }),
  );
}
