import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_DATABASE: 'unused', DB_USERNAME: 'unused', DB_PASSWORD: 'test-only' });
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');

test('contrato HTTP y trazabilidad sin PostgreSQL (doble de prueba)', async t => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const oldQuery = pool.query;
  const oldConnect = pool.connect;
  t.after(async () => {
    pool.query = oldQuery; pool.connect = oldConnect;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  const post = (body, headers = {}) => fetch(base + '/api/v1/enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  await t.test('liveness devuelve 200 sin consultar DB', async () => {
    const response = await fetch(base + '/health/live');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'alive');
  });
  await t.test('JSON roto devuelve 400 con requestId', async () => {
    const r = await post('{', { 'x-request-id': 'caso-json-400' });
    const body = await r.json();
    assert.equal(r.status, 400); assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(body.requestId, 'caso-json-400'); assert.equal(r.headers.get('x-request-id'), body.requestId);
  });
  await t.test('cuerpo grande devuelve 413 con requestId', async () => {
    const r = await post(JSON.stringify({ data: 'x'.repeat(40000) }));
    assert.equal(r.status, 413); assert.ok((await r.json()).requestId);
  });
  await t.test('ID inválido devuelve 422', async () => {
    const r = await post(JSON.stringify({ studentId: 0, sectionId: 1 }));
    assert.equal(r.status, 422); assert.equal((await r.json()).error.code, 'INVALID_STUDENT_ID');
  });
  await t.test('requestId demasiado largo se sustituye por UUID', async () => {
    const r = await post('{}', { 'x-request-id': 'x'.repeat(101) });
    assert.match((await r.json()).requestId, /^[0-9a-f-]{36}$/);
  });
  await t.test('ruta ausente devuelve 404 JSON', async () => {
    const r = await fetch(base + '/no-existe');
    assert.equal(r.status, 404); assert.equal((await r.json()).error.code, 'ROUTE_NOT_FOUND');
  });
  await t.test('readiness fallida devuelve 503 sin SQL', async () => {
    pool.query = async () => { throw new Error('SELECT secreto password=TOPSECRET'); };
    const r = await fetch(base + '/health/ready');
    assert.equal(r.status, 503); assert.equal((await r.json()).error.code, 'NOT_READY');
  });
  await t.test('error inesperado devuelve 500 y no filtra secretos en logs', async () => {
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function(chunk, ...args) { lines.push(String(chunk)); return write.call(this, chunk, ...args); };
    try {
      pool.connect = async () => { throw new Error('SELECT secreto password=TOPSECRET'); };
      const r = await post('{"studentId":1,"sectionId":1}');
      const body = await r.json();
      assert.equal(r.status, 500); assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.ok(!JSON.stringify(body).includes('TOPSECRET'));
      assert.ok(!lines.join('').includes('TOPSECRET'));
      assert.ok(lines.some(line => line.includes(body.requestId)));
    } finally { process.stdout.write = write; }
  });
});
