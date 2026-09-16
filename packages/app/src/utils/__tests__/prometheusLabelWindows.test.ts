import { fetchLabelsInWindows } from '@/utils/prometheusLabelWindows';

const week = 7 * 86400;

it('unions all 90 days, including historical-only values and boundary duplicates', async () => {
  const fetchWindow = jest.fn(async (start: number | undefined) => ({
    status: 'success' as const,
    data: [start === 0 ? 'retired-workload' : 'current-workload', 'shared'],
  }));
  const response = await fetchLabelsInWindows(0, 90 * 86400, fetchWindow);
  expect(fetchWindow).toHaveBeenCalledTimes(13);
  expect(fetchWindow).toHaveBeenNthCalledWith(1, 0, week);
  expect(fetchWindow).toHaveBeenLastCalledWith(12 * week, 90 * 86400);
  expect(response.data).toEqual([
    'current-workload',
    'retired-workload',
    'shared',
  ]);
});

it('does not return a successful partial list when an older window fails', async () => {
  const fetchWindow = jest
    .fn()
    .mockResolvedValueOnce({ status: 'success', data: ['one'] })
    .mockResolvedValueOnce({ status: 'error', error: 'series limit exceeded' });
  await expect(fetchLabelsInWindows(0, 3 * week, fetchWindow)).rejects.toThrow(
    'series limit exceeded',
  );
  expect(fetchWindow).toHaveBeenCalledTimes(2);
});

it('propagates transport failures and preserves backend warnings', async () => {
  await expect(
    fetchLabelsInWindows(0, 2 * week, async () => {
      throw new Error('timeout');
    }),
  ).rejects.toThrow('timeout');
  expect(
    await fetchLabelsInWindows(0, 2 * week, async () => ({
      status: 'success',
      data: [],
      warnings: ['partial response'],
    })),
  ).toEqual({ status: 'success', data: [], warnings: ['partial response'] });
});

it.each([
  [undefined, undefined],
  [100, 100],
  [0, week],
])('keeps short or unbounded lookup semantics (%s, %s)', async (start, end) => {
  const fetchWindow = jest
    .fn()
    .mockResolvedValue({ status: 'success', data: [] });
  await fetchLabelsInWindows(start, end, fetchWindow);
  expect(fetchWindow).toHaveBeenCalledTimes(1);
  expect(fetchWindow).toHaveBeenCalledWith(start, end);
});
