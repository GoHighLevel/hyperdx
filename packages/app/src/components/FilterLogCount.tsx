import { Text } from '@mantine/core';

export default function FilterLogCount({
  count,
  partial,
  loading,
  error,
  countedTo,
  testId,
}: {
  count?: string;
  partial?: boolean;
  loading?: boolean;
  error?: boolean;
  countedTo?: number;
  testId: string;
}) {
  const formatted = count == null ? undefined : BigInt(count).toLocaleString();
  const description =
    formatted == null
      ? error
        ? 'Count unavailable. Use Retry counts to try again.'
        : 'Waiting for the first count results'
      : partial
        ? `At least ${formatted} matching logs. ${error ? 'Counting stopped; partial results retained.' : 'Counting the rest of the selected time range.'}`
        : `${formatted} matching logs${loading ? '. Updating; showing the previous completed count.' : error ? '. Refresh failed; showing the previous completed count.' : ' in the selected time range.'}`;
  return (
    <Text
      size="xs"
      c="var(--color-text-muted)"
      style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
      data-testid={testId}
      title={`${description}${countedTo == null ? '' : ` Counted up to ${new Date(countedTo).toLocaleString()}.`}`}
      aria-label={description}
    >
      {formatted == null ? '—' : `${partial ? '≥' : ''}${formatted}`}
    </Text>
  );
}
