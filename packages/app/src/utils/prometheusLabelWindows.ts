export type PrometheusLabelsResponse = {
  status: 'success' | 'error';
  data?: string[];
  error?: string;
  warnings?: string[];
};

const WINDOW_SECONDS = 7 * 86400;

/** Cover the entire selected history without scanning its series index at once. */
export async function fetchLabelsInWindows(
  start: number | undefined,
  end: number | undefined,
  fetchWindow: (
    start: number | undefined,
    end: number | undefined,
  ) => Promise<PrometheusLabelsResponse>,
): Promise<PrometheusLabelsResponse> {
  if (start == null || end == null || end - start <= WINDOW_SECONDS) {
    return fetchWindow(start, end);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Invalid label lookup time range.');
  }

  const values = new Set<string>();
  const warnings = new Set<string>();
  // Sequential requests bound backend work even when several dropdowns load.
  // Adjacent inclusive windows overlap at their boundary; the union removes it.
  for (let from = start; from < end; from += WINDOW_SECONDS) {
    const response = await fetchWindow(
      from,
      Math.min(from + WINDOW_SECONDS, end),
    );
    if (response.status !== 'success' || !response.data) {
      throw new Error(
        response.error ?? 'Failed to load historical label values.',
      );
    }
    response.data.forEach(value => values.add(value));
    response.warnings?.forEach(warning => warnings.add(warning));
  }
  return {
    status: 'success',
    data: [...values].sort(),
    ...(warnings.size ? { warnings: [...warnings] } : {}),
  };
}
