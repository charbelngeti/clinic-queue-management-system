import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app, request, setupDatabase, teardown, loginAs, EMAILS, findFreeSlot } from './helpers.js';

before(setupDatabase, { timeout: 120000 });
after(teardown);

describe('Authentication & RBAC (FR-AUTH, NFR-SEC)', () => {
  it('rejects a wrong password with 401 and a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAILS.admin, password: 'wrong-password1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Incorrect email or password.');
  });

  it('blocks NoSQL operator injection in the login body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'x' });
    assert.equal(res.status, 400);
  });

  it('requires a session for protected routes', async () => {
    const res = await request(app).get('/api/patients');
    assert.equal(res.status, 401);
  });

  it('logs in, sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAILS.nurse, password: 'Clinic@2026' });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it('enforces roles on the server: a nurse cannot manage staff accounts (403)', async () => {
    const nurse = await loginAs(EMAILS.nurse);
    const res = await nurse.get('/api/users');
    assert.equal(res.status, 403);
  });

  it('a lab technician cannot browse patient records (403)', async () => {
    const lab = await loginAs(EMAILS.lab);
    assert.equal((await lab.get('/api/patients')).status, 403);
  });

  it('admin can view but NOT edit patient records', async () => {
    const admin = await loginAs(EMAILS.admin);
    assert.equal((await admin.get('/api/patients')).status, 200);
    const res = await admin.post('/api/patients').send({ firstName: 'A', lastName: 'B', dateOfBirth: '1990-01-01', sex: 'male', phone: '+254700000001' });
    assert.equal(res.status, 403);
  });

  it('admin creates a staff account that must change its temporary password', async () => {
    const admin = await loginAs(EMAILS.admin);
    const res = await admin.post('/api/users').send({
      firstName: 'Test', lastName: 'Nurse', email: 'test.nurse@clinic.test', role: 'nurse', password: 'Temp12345',
    });
    assert.equal(res.status, 201);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'test.nurse@clinic.test', password: 'Temp12345' });
    const blocked = await agent.get('/api/queue/triage');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
    const changed = await agent.patch('/api/auth/password').send({ currentPassword: 'Temp12345', newPassword: 'NewPass2026' });
    assert.equal(changed.status, 200);
    assert.equal((await agent.get('/api/queue/triage')).status, 200);
  });
});

describe('Patients (FR-PAT)', () => {
  const newPatient = {
    firstName: 'Zuri', lastName: 'Testcase', dateOfBirth: '1994-05-17', sex: 'female', phone: '+254711222333',
    nationalId: '30111222', allergies: ['Penicillin'],
  };

  it('reception registers a patient and gets a generated patient number', async () => {
    const rec = await loginAs(EMAILS.reception);
    const res = await rec.post('/api/patients').send(newPatient);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.patient.patientNo, /^P-\d{4}-\d{5}$/);
  });

  it('warns about a likely duplicate (same name + date of birth)', async () => {
    const rec = await loginAs(EMAILS.reception);
    const res = await rec.post('/api/patients').send({ ...newPatient, nationalId: undefined, phone: '+254799000111' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.code, 'POSSIBLE_DUPLICATE');
  });

  it('rejects a duplicate national ID even when confirmed (unique index)', async () => {
    const rec = await loginAs(EMAILS.reception);
    const res = await rec.post('/api/patients').send({ ...newPatient, firstName: 'Other', phone: '+254799000222', confirmNotDuplicate: true });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /national ID/);
  });

  it('validates input (future date of birth, bad phone)', async () => {
    const rec = await loginAs(EMAILS.reception);
    const res = await rec.post('/api/patients').send({ ...newPatient, nationalId: undefined, dateOfBirth: '2999-01-01', phone: 'abc' });
    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.phone);
  });
});

describe('Appointments (FR-APT)', () => {
  let rec;
  let doctorId;
  let patientId;
  before(async () => {
    rec = await loginAs(EMAILS.reception);
    doctorId = (await rec.get('/api/doctors')).body.doctors.find((d) => d.lastName === 'Otieno')._id;
    patientId = (await rec.get('/api/patients?q=P-')).body.patients[5]._id;
  });

  it('books a free slot, then rejects double-booking the same slot (409)', async () => {
    const slot = await findFreeSlot(rec, doctorId, 9); // beyond the seeded week
    const first = await rec.post('/api/appointments').send({ patientId, doctorId, ...slot, reason: 'Review' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const otherPatient = (await rec.get('/api/patients?q=P-')).body.patients[6]._id;
    const second = await rec.post('/api/appointments').send({ patientId: otherPatient, doctorId, ...slot });
    assert.equal(second.status, 409);
  });

  it('two simultaneous bookings of the same slot: exactly one succeeds', async () => {
    const slot = await findFreeSlot(rec, doctorId, 3);
    const [p1, p2] = (await rec.get('/api/patients?q=P-')).body.patients.slice(10, 12);
    const results = await Promise.all([
      rec.post('/api/appointments').send({ patientId: p1._id, doctorId, ...slot }),
      rec.post('/api/appointments').send({ patientId: p2._id, doctorId, ...slot }),
    ]);
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [201, 409]);
  });

  it('rejects a time outside the doctorâ€™s availability', async () => {
    const slot = await findFreeSlot(rec, doctorId);
    const res = await rec.post('/api/appointments').send({ patientId, doctorId, date: slot.date, time: '03:00' });
    assert.equal(res.status, 422);
  });

  it('a patient books for themselves and cannot see someone elseâ€™s appointment', async () => {
    const pat = await loginAs(EMAILS.patient);
    const slot = await findFreeSlot(pat, doctorId, 5);
    const res = await pat.post('/api/appointments').send({ doctorId, ...slot, patientId });
    assert.equal(res.status, 201);
    assert.notEqual(res.body.appointment.patientId._id, patientId); // forced to own record
    const others = await rec.get(`/api/appointments?patientId=${patientId}`);
    const foreignId = others.body.appointments[0]._id;
    assert.equal((await pat.get(`/api/appointments/${foreignId}`)).status, 404);
    // and can cancel their own (more than 2 hours ahead)
    const cancel = await pat.post(`/api/appointments/${res.body.appointment._id}/cancel`).send({ reason: 'Travelling' });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.appointment.status, 'cancelled');
    // a cancelled appointment cannot be cancelled again (state machine)
    const again = await rec.post(`/api/appointments/${res.body.appointment._id}/cancel`).send({ reason: 'x' });
    assert.equal(again.status, 409);
  });
});
