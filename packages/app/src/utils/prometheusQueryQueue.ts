// Queue before opening HTTP requests: waiting panels must not consume the LB's
// request deadline or start backend work after their dashboard has been closed.
export function createPrometheusQueryQueue(concurrency = 4, maxWaiting = 128) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return <T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const cancel = () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal?.reason);
      };
      const start = () => {
        signal?.removeEventListener('abort', cancel);
        active++;
        Promise.resolve()
          .then(request)
          .then(resolve, reject)
          .finally(() => {
            active--;
            waiting.shift()?.();
          });
      };
      if (active < concurrency) {
        start();
      } else if (waiting.length < maxWaiting) {
        waiting.push(start);
        signal?.addEventListener('abort', cancel, { once: true });
      } else {
        reject(
          new Error(
            'Too many metrics queries queued. Run the dashboard again after pending queries finish.',
          ),
        );
      }
    });
}

export const enqueuePrometheusQuery = createPrometheusQueryQueue();
