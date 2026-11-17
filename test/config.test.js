import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const base = { DB_HOST: 'db', DB_DATABASE: 'sgu', DB_USERNAME: 'sgu_app', DB_PASSWORD: 'test-secret', PORT: '8080', DB_PORT: '5432', DB_CONNECT_TIMEOUT_MS: '3000' };
function run(overrides) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', "import './src/config.js'"], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, ...base, ...overrides }
  });
}
test('configuración válida permite iniciar', () => assert.equal(run({}).status, 0));
test('contraseña ausente falla sin imprimir secretos', () => {
  const result = run({ DB_PASSWORD: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Falta la variable obligatoria DB_PASSWORD/);
  assert.ok(!result.stderr.includes(base.DB_PASSWORD));
});
for (const value of ['8080abc', '1.5', '0', '-1', '65536', ' ', '1e3']) {
  test(`rechaza PORT=${JSON.stringify(value)}`, () => assert.notEqual(run({ PORT: value }).status, 0));
}
test('rechaza puerto PostgreSQL fuera de rango', () => assert.notEqual(run({ DB_PORT: '99999' }).status, 0));
test('rechaza timeout negativo', () => assert.notEqual(run({ DB_CONNECT_TIMEOUT_MS: '-100' }).status, 0));
