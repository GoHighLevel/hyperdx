// Exercise the actual Next API proxy against Express session middleware.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const express = require('express');
const session = require('express-session');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../pages/api/[...all].ts');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText,
  filename,
);
const handler = compiled.exports.default;

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function request(server, headers) {
  return new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          path: '/api/session',
          headers,
        },
        response => {
          let body = '';
          response.on('data', chunk => (body += chunk));
          response.on('end', () =>
            resolve({ headers: response.headers, body: JSON.parse(body) }),
          );
        },
      )
      .on('error', reject);
  });
}

for (const origin of [
  'https://hyperdx.example.com',
  'http://localhost:3000',
  undefined,
]) {
  test(`session cookies through the API proxy with public origin ${origin}`, async t => {
    const previousOrigin = process.env.FRONTEND_URL;
    const previousTarget = process.env.SERVER_URL;
    t.after(() => {
      if (previousOrigin === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = previousOrigin;
      if (previousTarget === undefined) delete process.env.SERVER_URL;
      else process.env.SERVER_URL = previousTarget;
    });
    if (origin === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = origin;
    const secure = origin !== 'http://localhost:3000';
    const backend = express();
    backend.set('trust proxy', 1);
    backend.use(
      session({
        secret: 'local-regression-test-only',
        resave: false,
        saveUninitialized: false,
        cookie: { secure, httpOnly: true, sameSite: 'lax' },
      }),
    );
    backend.get('/session', (req, res) => {
      req.session.visits = (req.session.visits || 0) + 1;
      res.json({ visits: req.session.visits, protocol: req.protocol });
    });
    const api = await listen(backend);
    t.after(() => new Promise(resolve => api.close(resolve)));
    process.env.SERVER_URL = `http://127.0.0.1:${api.address().port}`;
    const frontend = express();
    frontend.use(handler);
    const proxy = await listen(frontend);
    t.after(() => new Promise(resolve => proxy.close(resolve)));

    // HTTPS origin must survive an ingress forwarding HTTP. When no origin is
    // configured, preserve the existing trusted-proxy header behavior.
    const headers = { 'X-Forwarded-Proto': origin ? 'http' : 'https' };
    const first = await request(proxy, headers);
    const cookie = first.headers['set-cookie']?.[0];
    assert.ok(cookie, 'session cookie must be issued');
    assert.equal(/; Secure/i.test(cookie), secure);
    assert.match(cookie, /; HttpOnly/i);
    assert.match(cookie, /; SameSite=Lax/i);
    const next = await request(proxy, {
      ...headers,
      Cookie: cookie.split(';')[0],
    });
    assert.equal(
      next.body.visits,
      2,
      'callback must recover the original session',
    );
    assert.equal(next.body.protocol, secure ? 'https' : 'http');
  });
}
