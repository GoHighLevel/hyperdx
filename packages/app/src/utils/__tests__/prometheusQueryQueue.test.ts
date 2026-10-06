import { createPrometheusQueryQueue } from '@/utils/prometheusQueryQueue';

describe('metrics query admission', () => {
  it('removes cancelled queued requests without executing them', async () => {
    const queue = createPrometheusQueryQueue(1);
    let finish!: () => void;
    const first = queue(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const abort = new AbortController();
    const request = jest.fn(async () => 1);
    const second = queue(request, abort.signal);
    const rejected = expect(second).rejects.toHaveProperty(
      'name',
      'AbortError',
    );
    abort.abort();
    await rejected;
    finish();
    await first;
    expect(await queue(async () => 2)).toBe(2);
    expect(request).not.toHaveBeenCalled();
  });

  it('bounds the waiting queue and releases a slot after a failed request', async () => {
    const queue = createPrometheusQueryQueue(1, 1);
    let fail!: (error: Error) => void;
    const first = queue(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const rejected = expect(first).rejects.toThrow('upstream failed');
    const second = queue(async () => 2);
    await expect(queue(async () => 3)).rejects.toThrow('Too many');
    fail(new Error('upstream failed'));
    await rejected;
    expect(await second).toBe(2);
  });

  it('does not start a request that was already cancelled', async () => {
    const abort = new AbortController();
    abort.abort();
    const request = jest.fn(async () => 1);
    await expect(
      createPrometheusQueryQueue()(request, abort.signal),
    ).rejects.toHaveProperty('name', 'AbortError');
    expect(request).not.toHaveBeenCalled();
  });
});
