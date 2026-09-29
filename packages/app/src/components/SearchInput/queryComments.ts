export type CommentToggleResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type TextEdit = { from: number; to: number; insert: string };

function mapPosition(position: number, edits: TextEdit[]): number {
  return edits.reduce((mapped, edit) => {
    if (position < edit.from) return mapped;
    if (position <= edit.to) {
      return mapped + edit.insert.length - (position - edit.from);
    }
    return mapped + edit.insert.length - (edit.to - edit.from);
  }, position);
}

/** Toggle `// ` comments on the selected Lucene query lines. */
export function toggleLuceneLineComments(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): CommentToggleResult {
  const rangeStart = Math.min(selectionStart, selectionEnd);
  const rangeEnd = Math.max(selectionStart, selectionEnd);
  const selectedStart =
    value.lastIndexOf('\n', Math.max(0, rangeStart - 1)) + 1;
  const inclusiveEnd = rangeEnd > rangeStart ? rangeEnd - 1 : rangeEnd;
  const nextNewline = value.indexOf('\n', inclusiveEnd);
  const selectedEnd = nextNewline === -1 ? value.length : nextNewline;

  const lines: Array<{ start: number; value: string }> = [];
  let lineStart = selectedStart;
  while (lineStart <= selectedEnd) {
    const lineEnd = value.indexOf('\n', lineStart);
    const end = lineEnd === -1 || lineEnd > selectedEnd ? selectedEnd : lineEnd;
    lines.push({ start: lineStart, value: value.slice(lineStart, end) });
    if (lineEnd === -1 || lineEnd >= selectedEnd) break;
    lineStart = lineEnd + 1;
  }

  const nonEmptyLines = lines.filter(line => line.value.trim().length > 0);
  const shouldUncomment =
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every(line => /^\s*\/\//.test(line.value));
  const edits: TextEdit[] = nonEmptyLines.map(line => {
    const indentationLength = line.value.match(/^\s*/)?.[0].length ?? 0;
    const markerStart = line.start + indentationLength;
    if (!shouldUncomment) {
      return { from: markerStart, to: markerStart, insert: '// ' };
    }
    const markerLength = line.value.slice(indentationLength).startsWith('// ')
      ? 3
      : 2;
    return { from: markerStart, to: markerStart + markerLength, insert: '' };
  });

  let nextValue = value;
  for (const edit of [...edits].reverse()) {
    nextValue =
      nextValue.slice(0, edit.from) + edit.insert + nextValue.slice(edit.to);
  }

  return {
    value: nextValue,
    selectionStart: mapPosition(selectionStart, edits),
    selectionEnd: mapPosition(selectionEnd, edits),
  };
}
