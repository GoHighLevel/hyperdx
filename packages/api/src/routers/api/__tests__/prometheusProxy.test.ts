import http from 'node:http';

import express from 'express';
import request from 'supertest';

import { proxyToPrometheus } from '@/routers/api/prometheus';
const host = 'http://vm/select/100/prometheus?deny_partial_response=1';
const params = {
  query: 'up',
  start: '0',
  end: '7776000',
  step: '21600',
  timeout: '600s',
};
const payload = {
  status: 'success',
  isPartial: false,
  data: { resultType: 'matrix', result: [] },
};
const mockFetch = jest.mocked(global.fetch);

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

function app(deadlineMs?: number) {
  const server = express();
  server.all('/query', async (req, res) => {
    if (deadlineMs != null)
      res.locals.prometheusDeadline = Date.now() + deadlineMs;
    await proxyToPrometheus(
      host,
      '/api/v1/query_range',
      { ...params, ...req.query } as Record<string, string>,
      res,
    );
  });
  return server;
}

describe('Prometheus HTTP proxy lifecycle', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(response(payload));
  });

  it('keeps 90 days, tenant prefix and pinned VM policy while bounding execution time', async () => {
    const res = await request(app())
      .post('/query?deny_partial_response=0')
      .expect(200);
    expect(res.body).toEqual(payload);
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.pathname).toBe('/select/100/prometheus/api/v1/query_range');
    expect(url.searchParams.get('start')).toBe('0');
    expect(url.searchParams.get('end')).toBe('7776000');
    expect(url.searchParams.get('deny_partial_response')).toBe('1');
    expect(parseFloat(url.searchParams.get('timeout')!)).toBeLessThanOrEqual(
      80,
    );
  });

  it('respects a shorter caller timeout and preserves partial metadata', async () => {
    mockFetch.mockResolvedValue(response({ ...payload, isPartial: true }));
    const res = await request(app()).post('/query?timeout=3s').expect(200);
    expect(res.body.isPartial).toBe(true);
    expect(
      new URL(String(mockFetch.mock.calls[0][0])).searchParams.get('timeout'),
    ).toBe('3');
  });

  it('supports compound Prometheus step and timeout durations', async () => {
    await request(app()).post('/query?step=1h30m&timeout=1m5s').expect(200);
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.searchParams.get('step')).toBe('1h30m');
    expect(url.searchParams.get('timeout')).toBe('65');
  });

  it('rejects excessive resolution before querying the backend', async () => {
    await request(app()).post('/query?step=15').expect(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(['start', 'end'])(
    'rejects an empty %s instead of treating it as zero',
    async key => {
      await request(app()).post(`/query?${key}=`).expect(400);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('cancels the upstream stream when the client closes after headers', async () => {
    let cancelled!: () => void;
    const stopped = new Promise<void>(resolve => {
      cancelled = resolve;
    });
    mockFetch.mockImplementation(async (_url, options) => {
      options?.signal?.addEventListener('abort', cancelled, { once: true });
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('{"status":"success","data":'),
            );
          },
        }),
      );
    });
    const server = app().listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test port');
    const client = http.get(`http://127.0.0.1:${address.port}/query`, res => {
      res.once('data', () => client.destroy());
    });
    client.on('error', () => {});
    try {
      await stopped;
    } finally {
      client.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      );
    }
  });

  it('counts pre-proxy work against the request deadline', async () => {
    await request(app(9000)).post('/query').expect(504);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns native query errors without retrying', async () => {
    mockFetch.mockResolvedValue(
      response({ status: 'error', error: 'query timeout' }, 503),
    );
    await request(app()).post('/query').expect(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('cancels upstream work when the client disconnects before headers', async () => {
    let started!: () => void;
    let cancelled!: () => void;
    const ready = new Promise<void>(resolve => {
      started = resolve;
    });
    const stopped = new Promise<void>(resolve => {
      cancelled = resolve;
    });
    mockFetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              cancelled();
              reject(options.signal?.reason);
            },
            { once: true },
          );
          started();
        }),
    );
    const server = app().listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test port');
    const client = http.get(`http://127.0.0.1:${address.port}/query`);
    client.on('error', () => {});
    try {
      await ready;
      client.destroy();
      await stopped;
      // The cancelled request must not keep an admission slot occupied.
      mockFetch.mockResolvedValue(response(payload));
      await request(app()).post('/query').expect(200);
    } finally {
      client.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      );
    }
  });
});
