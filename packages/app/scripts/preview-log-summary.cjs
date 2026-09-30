const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const sass = require('sass');

const root = path.resolve(__dirname, '../../..');
const dashboard = process.argv.includes('--dashboard-table');
const live = dashboard || process.argv.includes('--live-table');
const refreshControls = process.argv.includes('--refresh-controls');
const filterCounts = process.argv.includes('--filter-counts');
const port = dashboard
  ? 8773
  : filterCounts
    ? 8771
    : refreshControls
      ? 8770
      : live
        ? 8769
        : 8768;
const output = path.join(
  root,
  `output/ui-preview/${dashboard ? 'dashboard-table' : filterCounts ? 'filter-counts' : refreshControls ? 'refresh-controls' : live ? 'live-table' : 'summary-demo'}`,
);
fs.mkdirSync(output, { recursive: true });

async function main() {
  await esbuild.build({
    stdin: {
      contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import Demo from '${root}/packages/app/src/components/LogSummaryDemo/${dashboard ? 'DashboardTablePreview' : filterCounts ? 'FilterCountsPreview' : refreshControls ? 'RefreshControlsPreview' : live ? 'LiveTablePreview' : 'LogSummaryDemo'}';
import {theme} from '${root}/packages/app/src/theme/themes/hyperdx/mantineTheme';
const colorMode = new URLSearchParams(window.location.search).get('colorMode') === 'light' ? 'light' : 'dark';
createRoot(document.getElementById('root')).render(<MantineProvider forceColorScheme={colorMode} theme={{...theme,fontFamily:'Arial, sans-serif'}}><Demo/></MantineProvider>);`,
      loader: 'tsx',
      resolveDir: root,
    },
    bundle: true,
    outfile: path.join(output, 'demo.js'),
    jsx: 'automatic',
    define: { 'process.env': '{}' },
    nodePaths: [path.join(root, 'node_modules')],
    tsconfig: path.join(root, 'packages/app/tsconfig.json'),
    plugins: [
      {
        name: 'sass-modules',
        setup(build) {
          build.onLoad({ filter: /\.scss$/ }, args => ({
            contents: sass.compile(args.path).css,
            loader: 'local-css',
          }));
        },
      },
    ],
    logLevel: 'error',
  });
  fs.writeFileSync(
    path.join(output, 'tokens.css'),
    sass.compile(
      path.join(root, 'packages/app/src/theme/themes/_base-tokens.scss'),
    ).css,
  );
  fs.writeFileSync(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HyperDX · Summary row preview</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="demo.css"><link rel="stylesheet" href="tokens.css">
<style>body{margin:0} :root{--font-roboto:Arial;--font-roboto-mono:monospace;--font-inter:Arial;--font-ibm-plex-mono:monospace}</style>
</head><body><div id="root"></div><script src="demo.js"></script></body></html>`,
  );
  const files = {
    '/': ['index.html', 'text/html'],
    '/demo.js': ['demo.js', 'text/javascript'],
    '/demo.css': ['demo.css', 'text/css'],
    '/tokens.css': ['tokens.css', 'text/css'],
  };
  http
    .createServer((req, res) => {
      const file = files[req.url];
      if (!file) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': file[1],
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(path.join(output, file[0])).pipe(res);
    })
    .listen(8768, '127.0.0.1', () =>
      console.log('Local preview: http://127.0.0.1:8768'),
    );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
