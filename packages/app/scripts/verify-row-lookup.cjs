// Runs only against the disposable, network-isolated local test container.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperdx-row-lookup-'));
const container = 'hyperdx-rowlookup-check';

function query(sql, input = '') {
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'clickhouse-client', '--query', sql],
    { input, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

async function main() {
  const baselineIndex = process.argv.indexOf('--baseline');
  const baseline =
    baselineIndex >= 0 ? process.argv[baselineIndex + 1] : undefined;
  await esbuild.build({
    stdin: {
      contents: baseline
        ? `${fs.readFileSync(baseline, 'utf8')}\nexport {convertCHDataTypeToJSType};`
        : `export {processRowToWhereClause} from './src/hooks/useRowWhere'; export {convertCHDataTypeToJSType} from '@hyperdx/common-utils/dist/clickhouse';`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(temp, 'lookup.cjs'),
    tsconfig: path.join(root, 'tsconfig.json'),
  });
  const { processRowToWhereClause, convertCHDataTypeToJSType } = require(
    path.join(temp, 'lookup.cjs'),
  );
  query(
    'CREATE TABLE IF NOT EXISTS row_lookup_fixture (timestamp DateTime64(9), deployment_name String, log String, json_payload Map(String, String), tags Array(String), tuple_value Tuple(String, Int32), json_value JSON, dynamic_value Dynamic) ENGINE=Memory',
  );
  query('TRUNCATE TABLE row_lookup_fixture');
  const event = {
    timestamp: '2026-09-16 04:49:25.000000000',
    deployment_name: 'image-worker',
    log: 'Back-off pulling image "example/image"',
    json_payload: {
      type: 'Normal',
      message: "Back-off pulling image 'example/image'",
      path: 'a\\b',
      empty: '',
    },
    tags: ['first', 'second'],
    tuple_value: ['tuple', 2],
    json_value: { message: 'a/b', nested: { active: true } },
    dynamic_value: { count: 2 },
  };
  query(
    'INSERT INTO row_lookup_fixture FORMAT JSONEachRow',
    JSON.stringify(event),
  );
  const response = JSON.parse(
    query(
      `SELECT ${baseline ? 'timestamp, deployment_name, log, json_payload' : '*'} FROM row_lookup_fixture FORMAT JSON`,
    ),
  );
  const metadata = new Map(
    response.meta.map(column => [
      column.name,
      {
        ...column,
        valueExpr: `\`${column.name}\``,
        jsType: convertCHDataTypeToJSType(column.type),
      },
    ]),
  );
  const where = processRowToWhereClause(response.data[0], metadata);
  fs.writeFileSync(
    path.join(temp, 'lookup.sql'),
    `SELECT * FROM row_lookup_fixture WHERE ${where}`,
  );
  try {
    const matched = Number(
      query(`SELECT count() FROM row_lookup_fixture WHERE ${where}`),
    );
    if (process.argv.includes('--expect-failure'))
      throw new Error('Expected the regression to fail');
    if (matched !== 1)
      throw new Error(`Expected one matching row, got ${matched}`);
    console.log(
      JSON.stringify({
        matched,
        types: response.meta.map(column => column.type),
        queryFile: path.join(temp, 'lookup.sql'),
      }),
    );
  } catch (error) {
    if (
      !process.argv.includes('--expect-failure') ||
      !error.message.includes('UNKNOWN_IDENTIFIER')
    )
      throw error;
    console.log(
      JSON.stringify({
        reproduced: true,
        error: 'UNKNOWN_IDENTIFIER',
        queryFile: path.join(temp, 'lookup.sql'),
      }),
    );
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
