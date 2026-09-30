const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

function get(host, port, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host, port, path: url, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(10000, () => request.destroy(new Error('Request timed out')));
    request.on('error', reject);
  });
}

(async () => {
  const root = '/app/packages/app/packages/app/.next/static';
  const markers = ['Latest event', 'Searched through', 'Scroll down to show latest logs'];
  const relative = fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith('.js')).find(name => {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    return markers.every(marker => source.includes(marker));
  });
  if (!relative) throw new Error('Live freshness markers missing from compiled UI');
  const file = fs.readFileSync(path.join(root, relative));
  const assetUrl = '/_next/static/' + relative;
  const ingressIp = process.argv[2];
  if (!ingressIp) throw new Error('Pass the current staging ingress IP');
  const headers = { Host: 'hyperdx.servers.stg.msgsndr.net' };
  const [health, login, asset, ingressLogin, ingressAsset] = await Promise.all([
    get('127.0.0.1', 8000, '/health'),
    get('127.0.0.1', 3000, '/login'),
    get('127.0.0.1', 3000, assetUrl),
    get(ingressIp, 80, '/login', headers),
    get(ingressIp, 80, assetUrl, headers),
  ]);
  const report = {
    codeVersion: process.env.CODE_VERSION,
    apiHealth: health.status, login: login.status, assetStatus: asset.status,
    ingressLogin: ingressLogin.status, ingressAssetStatus: ingressAsset.status,
    asset: relative,
    assetSha256: crypto.createHash('sha256').update(file).digest('hex'),
    servedAssetMatchesPod: file.equals(asset.body),
    ingressAssetMatchesPod: file.equals(ingressAsset.body),
    liveFreshnessMarkersPresent: true,
    removedCountPrefixAbsent: !file.toString().includes('Showing newest '),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.codeVersion !== '2.38.0-custom.43' || !report.removedCountPrefixAbsent ||
      [health, login, asset, ingressLogin, ingressAsset].some(response => response.status !== 200) ||
      !report.servedAssetMatchesPod || !report.ingressAssetMatchesPod) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
