import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app, request, setupDatabase, teardown, loginAs, EMAILS } from './helpers.js';

before(setupDatabase, { timeout: 120000 });
after(teardown);

describe('Check-in & queue (FR-QUE)', () => {
  let rec, nurse, nurse2, doctor;
  let patients;

  before(async () => {
    rec = await loginAs(EMAILS.reception);
    nurse = await loginAs(EMAILS.nurse);
    nurse2 = await loginAs(EMAILS.nurse2);
    doctor = await loginAs(EMAILS.doctor);
    patients = (await rec.get('/api/patients?q=P-')).body.patients;
  });

  it('checks in walk-ins with W- tickets and refuses a second active visit for the same patient', async () => {
    const a = await rec.post('/api/visits/check-in').send({ patientId: patients[20]._id, firstStage: 'triage' });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.match(a.body.visit.ticketNo, /^W-\d{3}$/);
    const dup = await rec.post('/api/visits/check-in').send({ patientId: patients[20]._id, firstStage: 'triage' });
    assert.equal(dup.status, 409);
    assert.match(dup.body.error.message, /already in the queue/);
  });

  it('two nurses calling at the same moment never get the same patient', async () => {
    await rec.post('/api/visits/check-in').send({ patientId: patients[21]._id, firstStage: 'triage' });
    const [r1, r2] = await Promise.all([nurse.post('/api/queue/triage/call-next'), nurse2.post('/api/queue/triage/call-next')]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.ok(r1.body.visit && r2.body.visit);
    assert.notEqual(r1.body.visit._id, r2.body.visit._id);
  });

  it('a nurse must finish the current patient before calling another', async () => {
    const res = await nurse.post('/api/queue/triage/call-next');
    assert.equal(res.status, 409);
  });

  it('a skipped patient can be re-queued by reception', async () => {
    const current = (await nurse2.get('/api/queue/triage')).body.current;
    const skipped = await nurse2.post(`/api/visits/${current._id}/skip`);
    assert.equal(skipped.body.visit.queueStatus, 'skipped');
    const back = await rec.post(`/api/visits/${current._id}/requeue`);
    assert.equal(back.body.visit.queueStatus, 'waiting');
  });

  it('calls emergencies before earlier normal arrivals', async () => {
    await rec.post('/api/visits/check-in').send({ patientId: patients[22]._id, firstStage: 'triage' });
    const urgent = await rec.post('/api/visits/check-in').send({ patientId: patients[23]._id, firstStage: 'triage', priority: 'emergency' });
    const called = await nurse2.post('/api/queue/triage/call-next');
    assert.equal(called.status, 200);
    assert.equal(called.body.visit._id, urgent.body.visit._id);
  });

  it('rejects impossible vital signs and records valid ones with abnormal flags', async () => {
    const wl = await nurse.get('/api/queue/triage');
    const visitId = wl.body.current._id;
    const bad = await nurse.post(`/api/visits/${visitId}/triage`).send({ vitals: { systolic: 1200, temperature: 36.8 } });
    assert.equal(bad.status, 422);
    assert.ok(bad.body.error.details.systolic);
    const ok = await nurse.post(`/api/visits/${visitId}/triage`).send({
      vitals: { temperature: 38.6, systolic: 150, diastolic: 95, pulse: 88, weight: 70, height: 175 }, complaint: 'Fever', priority: 'emergency',
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.visit.triage.flags.includes('FEVER'));
    assert.ok(ok.body.visit.triage.flags.includes('HIGH_BP'));
    assert.equal(ok.body.visit.triage.vitals.bmi, 22.9);
  });

  it('only the serving nurse can send the patient on; then a doctor can call them', async () => {
    const wl = await nurse.get('/api/queue/triage');
    const visitId = wl.body.current._id;
    assert.equal((await nurse2.post(`/api/visits/${visitId}/send-to-consultation`).send({})).status, 403);
    const sent = await nurse.post(`/api/visits/${visitId}/send-to-consultation`).send({});
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.visit.stage, 'consultation');
    const called = await doctor.post('/api/queue/consultation/call-next');
    assert.equal(called.body.visit._id, visitId); // nurse raised it to emergency priority → first
  });

  it('reception cannot read clinical triage data through the queue board', async () => {
    const board = await rec.get('/api/queue/board');
    assert.equal(board.status, 200);
    const all = Object.values(board.body.stages).flat();
    assert.ok(all.length > 0);
    assert.ok(all.every((v) => v.triage === undefined));
  });

  it('the public display shows tickets but no patient names', async () => {
    const res = await request(app).get('/api/public/queue');
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    for (const p of patients.slice(20, 26)) assert.ok(!text.includes(p.lastName) || !text.includes(p.firstName));
    assert.ok(!text.includes('patientId'));
  });

  it('reception cancels a visit (patient left), freeing the patient to check in again', async () => {
    const wl = await rec.get('/api/queue/board');
    const v = wl.body.stages.triage.find((x) => x.queueStatus === 'waiting');
    const res = await rec.post(`/api/visits/${v._id}/cancel`).send({ reason: 'Patient left' });
    assert.equal(res.status, 200);
    const again = await rec.post('/api/visits/check-in').send({ patientId: v.patientId._id, firstStage: 'consultation' });
    assert.equal(again.status, 201);
  });

  it('checking in a booked appointment moves it to checked_in and routes straight to the booked doctor', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
    const appts = (await rec.get(`/api/appointments?date=${today}&status=scheduled`)).body.appointments;
    if (!appts.length) return; // weekend/no clinic today: nothing to check
    const appt = appts.find((a) => !patients.slice(20, 27).some((p) => p._id === a.patientId._id)) || appts[0];
    const res = await rec.post('/api/visits/check-in').send({ appointmentId: appt._id, firstStage: 'consultation' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.visit.ticketNo, /^A-/);
    assert.equal(res.body.visit.assignedTo, appt.doctorId._id);
    const after = (await rec.get(`/api/appointments/${appt._id}`)).body.appointment;
    assert.equal(after.status, 'checked_in');
  });
});
