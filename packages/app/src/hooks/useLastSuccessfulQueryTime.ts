import { useState } from 'react';

// Keep the last successful window while live queries show placeholder/streaming
// data. Changing the search must not carry freshness over from another query.
export function useLastSuccessfulQueryTime({
  queryIdentity,
  completedUntil,
  isFetching,
  isError,
  isPlaceholderData,
}: {
  queryIdentity: string;
  completedUntil: number | undefined;
  isFetching: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
}) {
  const [last, setLast] = useState<{
    queryIdentity: string;
    time: number | undefined;
  }>({ queryIdentity, time: undefined });
  const previous = last.queryIdentity === queryIdentity ? last.time : undefined;
  const canAdvance =
    completedUntil != null &&
    Number.isFinite(completedUntil) &&
    !isFetching &&
    !isError &&
    !isPlaceholderData;
  const time = canAdvance
    ? Math.max(previous ?? completedUntil, completedUntil)
    : previous;
  if (last.queryIdentity !== queryIdentity || last.time !== time) {
    setLast({ queryIdentity, time });
  }
  return time;
}
