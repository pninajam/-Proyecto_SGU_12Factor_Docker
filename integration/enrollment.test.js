import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
// Protección: usar una base independiente; nunca ejecutar contra la base de demostración.
if (!process.env.DB_DATABASE?.endsWith('_test')) throw new Error('DB_DATABASE debe terminar en _test. Ejecute la migración en esa base antes de probar.');
const { pool } = await import('../src/db.js');
const { app } = await import('../src/app.js');

test('integración HTTP + PostgreSQL real', async t => {
  const marker = randomUUID().slice(0, 8);
  const students = [], sections = [], periods = [];
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    try {
      await pool.query('DELETE FROM enrollments WHERE section_id = ANY($1::bigint[])', [sections]);
      await pool.query('DELETE FROM sections WHERE id = ANY($1::bigint[])', [sections]);
      await pool.query('DELETE FROM students WHERE id = ANY($1::bigint[])', [students]);
      await pool.query('DELETE FROM academic_periods WHERE id = ANY($1::bigint[])', [periods]);
    } finally { await pool.end(); }
  });
  for (const active of [true, false]) {
    periods.push((await pool.query('INSERT INTO academic_periods(name,is_active) VALUES($1,$2) RETURNING id', [`test-${marker}`, active])).rows[0].id);
  }
  for (let i = 0; i < 3; i++) {
    students.push((await pool.query('INSERT INTO students(university_code,full_name,is_active) VALUES($1,$2,$3) RETURNING id', [`T${marker}${i}`, `Estudiante prueba ${i}`, i !== 2])).rows[0].id);
  }
  for (const [index, capacity, period] of [[0,2,periods[0]], [1,0,periods[0]], [2,1,periods[0]], [3,5,periods[1]], [4,5,periods[0]]]) {
    sections.push((await pool.query('INSERT INTO sections(course_code,section_code,academic_period_id,vacancies) VALUES($1,$2,$3,$4) RETURNING id', [`T${marker}${index}`, 'A', period, capacity])).rows[0].id);
  }
  async function post(student, section) {
    const request = { studentId: Number(student), sectionId: Number(section) };
    const response = await fetch(base + '/api/v1/enrollments', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(request)});
    const body = await response.json();
    assert.equal(body.requestId, response.headers.get('x-request-id'));
    return {status:response.status, body};
  }
  await t.test('readiness 200 después de migrar', async () => assert.equal((await fetch(base + '/health/ready')).status, 200));
  await t.test('matrícula válida 201 y ocupación persistida', async () => {
    const r = await post(students[0], sections[0]);
    assert.equal(r.status, 201); assert.ok(r.body.data.id);
    assert.equal((await pool.query('SELECT enrolled FROM sections WHERE id=$1', [sections[0]])).rows[0].enrolled, 1);
  });
  await t.test('matrícula repetida 409 sin incrementar ocupación', async () => {
    const r = await post(students[0], sections[0]);
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'DUPLICATE_ENROLLMENT');
    assert.equal((await pool.query('SELECT enrolled FROM sections WHERE id=$1', [sections[0]])).rows[0].enrolled, 1);
  });
  await t.test('estudiante inexistente 404', async () => {
    const r = await post(2147483647, sections[0]); assert.equal(r.status, 404); assert.equal(r.body.error.code, 'STUDENT_NOT_FOUND');
  });
  await t.test('sección inexistente 404', async () => {
    const r = await post(students[0], 2147483647); assert.equal(r.status, 404); assert.equal(r.body.error.code, 'SECTION_NOT_FOUND');
  });
  await t.test('estudiante inactivo 404', async () => assert.equal((await post(students[2], sections[0])).status, 404));
  await t.test('sección llena 409 y cero inserciones', async () => {
    const r = await post(students[0], sections[1]); assert.equal(r.status,409); assert.equal(r.body.error.code,'NO_VACANCIES');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM enrollments WHERE section_id=$1',[sections[1]])).rows[0].n,0);
  });
  await t.test('periodo cerrado 409', async () => {
    const r = await post(students[0],sections[3]); assert.equal(r.status,409); assert.equal(r.body.error.code,'PERIOD_CLOSED');
  });
  await t.test('dos solicitudes concurrentes para una vacante: 201 y 409', async () => {
    const results = await Promise.all([post(students[0],sections[2]),post(students[1],sections[2])]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    assert.equal((await pool.query('SELECT enrolled FROM sections WHERE id=$1',[sections[2]])).rows[0].enrolled,1);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM enrollments WHERE section_id=$1',[sections[2]])).rows[0].n,1);
  });
  await t.test('duplicados concurrentes: una sola matrícula', async () => {
    const results = await Promise.all([post(students[0],sections[4]),post(students[0],sections[4])]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    assert.equal((await pool.query('SELECT enrolled FROM sections WHERE id=$1',[sections[4]])).rows[0].enrolled,1);
  });
  await t.test('ID inválido 422', async () => assert.equal((await post(0,sections[0])).status,422));
});
