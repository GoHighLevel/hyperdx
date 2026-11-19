export function downloadObjectAsJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
