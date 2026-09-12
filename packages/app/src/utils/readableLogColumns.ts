import { splitAndTrimWithBracket } from '@hyperdx/common-utils/dist/core/utils';

// Fluent log tables contain mixed plain text and JSON producers. The stored
// log_message column extracts only "message", leaving "msg" and plain text blank.
export function readableLogColumns(
  select: string,
  columns: Set<string>,
): string {
  if (!columns.has('log')) return select;

  const messageCandidates = [
    ...(columns.has('log_message') ? ['log_message'] : []),
    "JSONExtractString(log, 'message')",
    "JSONExtractString(log, 'msg')",
    "JSONExtractString(log, 'body')",
    'log',
  ];
  const levelCandidates = [
    ...(columns.has('log_level') ? ['log_level'] : []),
    "JSONExtractString(log, 'level')",
    "JSONExtractString(log, 'severity')",
    "JSONExtractString(log, 'severityText')",
  ];
  const fallback = (expressions: string[], empty: string) =>
    `coalesce(${expressions.map(e => `nullIf(${e}, '')`).join(', ')}, '${empty}')`;

  let hasMessage = false;
  return splitAndTrimWithBracket(select)
    .flatMap(expression => {
      if (expression === 'log' || expression === 'log_message') {
        if (hasMessage) return [];
        hasMessage = true;
        return [`${fallback(messageCandidates, '')} AS Message`];
      }
      if (
        expression === 'log_level' ||
        /^JSONExtractString\(log,\s*'level'\)\s+AS\s+log_level$/i.test(
          expression,
        )
      ) {
        return [`lowerUTF8(${fallback(levelCandidates, 'unknown')}) AS Level`];
      }
      return [expression];
    })
    .join(', ');
}
