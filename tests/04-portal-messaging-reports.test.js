import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupDatabase, teardown, loginAs, EMAILS, findFreeSlot } from './helpers.js';

before(setupDatabase, { timeout: 120000 });
after(teardown);

describe('Patient portal (FR-POR, FR-QUE-10)', () => {
  it('shows the patient their own live queue position after check-in', async () => {
    const pat = await loginAs(EMAILS.patient);
    const rec = await loginAs(EMAILS.reception);
    assert.equal((await pat.get('/api/me/visit')).body.visit, null);
    const me = (await pat.get('/api/auth/me')).body.user;
    // two walk-ins ahead, then the patient
    const others = (await rec.get('/api/patients?q=P-')).body.patients.filter((p) => p._id !== me.patientId).slice(10, 12);
    for (const p of others) await rec.post('/api/visits/check-in').send({ patientId: p._id, firstStage: 'triage' });
    await rec.post('/api/visits/check-in').send({ patientId: me.patientId, firstStage: 'triage' });
    const v = (await pat.get('/api/me/visit')).body.visit;
    assert.equal(v.stage, 'triage');
    assert.equal(v.position, 3);
    assert.equal(v.patientId, undefined); // no internal identifiers leaked
  });

  it('a patient cannot reach staff-only endpoints', async () => {
    const pat = await loginAs(EMAILS.patient);
    for (const url of ['/api/patients', '/api/queue/board', '/api/queue/triage', '/api/reports/summary', '/api/medications']) {
      assert.equal((await pat.get(url)).status, 403, url);
    }
  });

  it('a patient cannot cancel within 2 hours of the appointment', async () => {
    const pat = await loginAs(EMAILS.patient);
    const doctorId = (await pat.get('/api/doctors')).body.doctors[0]._id;
    const slot = await findFreeSlot(pat, doctorId, 10);
    const booked = (await pat.post('/api/appointments').send({ doctorId, ...slot })).body.appointment;
    // move it to start in 1 hour directly in the database to simulate the cut-off
    const { Appointment } = await import('../src/models/index.js');
    await Appointment.updateOne({ _id: booked._id }, { startAt: new Date(Date.now() + 3600e3), endAt: new Date(Date.now() + 4800e3) });
    const res = await pat.post(`/api/appointments/${booked._id}/cancel`).send({ reason: 'Late' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'CANCEL_WINDOW_CLOSED');
  });
});

describe('Messaging via the reception desk (FR-MSG)', () => {
  it('reception messages a doctor; the doctor sees it unread and replies; reception sees the reply', async () => {
    const rec = await loginAs(EMAILS.reception);
    const rec2 = await loginAs('reception2@clinic.test');
    const doc = await loginAs(EMAILS.doctor);
    const doctorUser = (await doc.get('/api/auth/me')).body.user;
    const start = await rec.post('/api/messages').send({ toUserId: doctorUser._id, subject: 'Patient running late', body: 'Mr. X will arrive 15 min late.' });
    assert.equal(start.status, 201);
    assert.equal((await doc.get('/api/messages/unread')).body.unread, 1);
    const id = start.body.conversation._id;
    const t = await doc.get(`/api/messages/${id}`);
    assert.equal(t.body.messages.length, 1);
    assert.equal((await doc.get('/api/messages/unread')).body.unread, 0);
    await doc.post(`/api/messages/${id}/reply`).send({ body: 'Noted, thanks.' });
    // shared desk: the OTHER receptionist sees the reply too
    assert.equal((await rec2.get('/api/messages/unread')).body.unread, 1);
  });

  it('non-reception users can only message reception, and cannot read others’ conversations', async () => {
    const nurse = await loginAs(EMAILS.nurse);
    const pat = await loginAs(EMAILS.patient);
    const doc = await loginAs(EMAILS.doctor);
    const docId = (await doc.get('/api/auth/me')).body.user._id;
    assert.equal((await nurse.post('/api/messages').send({ toUserId: docId, subject: 's', body: 'b' })).status, 403);
    const own = await pat.post('/api/messages').send({ subject: 'Reschedule', body: 'Can I move my appointment?' });
    assert.equal(own.status, 201);
    assert.equal((await nurse.get(`/api/messages/${own.body.conversation._id}`)).status, 404);
    assert.equal((await nurse.get('/api/messages/recipients')).status, 403);
  });

  it('admin has no access to messaging', async () => {
    const admin = await loginAs(EMAILS.admin);
    assert.equal((await admin.get('/api/messages')).status, 403);
  });
});

describe('Reports & audit (FR-RPT, FR-AUD)', () => {
  it('admin gets an operational summary; others are refused', async () => {
    const admin = await loginAs(EMAILS.admin);
    const res = await admin.get('/api/reports/summary');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.visits.total >= 1);
    assert.equal(res.body.daily.length, 7);
    assert.ok('triage' in res.body.stages || res.body.visits.total > 0);
    const rec = await loginAs(EMAILS.reception);
    assert.equal((await rec.get('/api/reports/summary')).status, 403);
  });

  it('admin can read the audit log, which records who did what', async () => {
    const admin = await loginAs(EMAILS.admin);
    const res = await admin.get('/api/audit?action=visit.checkIn');
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.length >= 1);
    assert.ok(res.body.entries.every((e) => e.userName && e.at));
  });

  it('staff get per-department stats for their own stage only', async () => {
    const nurse = await loginAs(EMAILS.nurse);
    const ok = await nurse.get('/api/queue/triage/stats');
    assert.equal(ok.status, 200);
    assert.equal(typeof ok.body.servedByMeToday, 'number');
    assert.equal((await nurse.get('/api/queue/pharmacy/stats')).status, 403);
  });
});
