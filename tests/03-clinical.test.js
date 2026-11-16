import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupDatabase, teardown, loginAs, EMAILS } from './helpers.js';

before(setupDatabase, { timeout: 120000 });
after(teardown);

describe('Clinical flow: consultation → lab → consultation → pharmacy (FR-CON, FR-LAB, FR-PHA)', () => {
  let rec, doctor, clinician, lab, pharm;
  let patient, visitId, meds, tests;

  before(async () => {
    [rec, doctor, clinician, lab, pharm] = await Promise.all(
      [EMAILS.reception, EMAILS.doctor, EMAILS.clinician, EMAILS.lab, EMAILS.pharmacist].map(loginAs),
    );
    const created = await rec.post('/api/patients').send({
      firstName: 'Clin', lastName: 'Flowtest', dateOfBirth: '1988-03-02', sex: 'male', phone: '+254722000999', allergies: ['Ibuprofen'],
    });
    patient = created.body.patient;
    ({ medications: meds, labTests: tests } = (await doctor.get('/api/catalogues')).body);
  });

  const med = (name) => meds.find((m) => m.name === name);

  it('walk-in goes straight to consultation and the doctor calls them', async () => {
    const ci = await rec.post('/api/visits/check-in').send({ patientId: patient._id, firstStage: 'consultation' });
    assert.equal(ci.status, 201);
    visitId = ci.body.visit._id;
    const called = await doctor.post('/api/queue/consultation/call-next');
    assert.equal(called.body.visit._id, visitId);
  });

  it('cannot request labs before recording the consultation note', async () => {
    const res = await doctor.post(`/api/consultations/visit/${visitId}/lab-request`).send({ testIds: [tests[0]._id] });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'NOTE_REQUIRED');
  });

  it('saves a draft note, requests lab tests and the patient moves to the lab queue', async () => {
    const note = await doctor.put(`/api/consultations/visit/${visitId}`).send({ chiefComplaint: 'Fever 3 days', examination: 'Temp 38.5' });
    assert.equal(note.status, 200);
    assert.equal(note.body.consultation.status, 'draft');
    const ids = tests.filter((t) => ['FBC', 'MPS'].includes(t.code)).map((t) => t._id);
    const res = await doctor.post(`/api/consultations/visit/${visitId}/lab-request`).send({ testIds: ids, clinicalNotes: 'r/o malaria' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.labRequest.tests.length, 2);
  });

  it('other roles cannot see the consultation (403)', async () => {
    assert.equal((await pharm.get(`/api/consultations/visit/${visitId}`)).status, 403);
    assert.equal((await rec.get(`/api/consultations/visit/${visitId}`)).status, 403);
  });

  let request;
  it('lab tech must record sample collection before results, and must enter every result', async () => {
    const called = await lab.post('/api/queue/lab/call-next');
    assert.equal(called.body.visit._id, visitId);
    const ctx = await lab.get(`/api/lab/visit/${visitId}`);
    request = ctx.body.requests[0];
    assert.equal(ctx.body.patient.phone, undefined); // lab sees identifiers only (NFR-PRI-01)
    const early = await lab.post(`/api/lab/requests/${request._id}/results`).send({ results: [{ lineId: request.tests[0]._id, value: '12' }] });
    assert.equal(early.status, 400);
    assert.equal((await lab.post(`/api/lab/requests/${request._id}/status`).send({ status: 'sample_collected' })).status, 200);
    const partial = await lab.post(`/api/lab/requests/${request._id}/results`).send({ results: [{ lineId: request.tests[0]._id, value: '12' }] });
    assert.equal(partial.status, 422);
  });

  it('releasing results returns the patient to the SAME doctor with "results ready"', async () => {
    const res = await lab.post(`/api/lab/requests/${request._id}/results`).send({
      results: [
        { lineId: request.tests[0]._id, value: 'Hb 13.1, WBC 11.2', flag: 'high' },
        { lineId: request.tests[1]._id, value: 'P. falciparum seen (+)', flag: 'critical' },
      ],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.labRequest.status, 'completed');
    // The clinician is the only one who gets them: a different doctor's call-next must not pick this patient.
    const otherDoctor = await loginAs(EMAILS.doctor2);
    const other = await otherDoctor.post('/api/queue/consultation/call-next');
    assert.notEqual(other.body.visit?._id, visitId);
    const wl = await doctor.get('/api/queue/consultation');
    const back = wl.body.waiting.find((v) => v._id === visitId);
    assert.ok(back?.labResultsReady);
  });

  it('prescribing a drug the patient is allergic to needs explicit acknowledgement', async () => {
    const called = await doctor.post('/api/queue/consultation/call-next');
    assert.equal(called.body.visit._id, visitId);
    const ctx = await doctor.get(`/api/consultations/visit/${visitId}`);
    assert.equal(ctx.body.labRequests[0].status, 'completed');
    assert.equal(ctx.body.consultation.status, 'draft'); // same note continues after the lab
    await doctor.put(`/api/consultations/visit/${visitId}`).send({ diagnosis: 'Uncomplicated malaria' });
    const items = [
      { medicationId: med('Ibuprofen')._id, dose: '400 mg', frequency: 'TDS', durationDays: 3, quantity: 9 },
      { medicationId: med('Zinc Sulphate')._id, dose: '20 mg', frequency: 'OD', durationDays: 20, quantity: 20 },
      { medicationId: med('Paracetamol')._id, dose: '1 g', frequency: 'TDS', durationDays: 3, quantity: 18 },
    ];
    const warn = await doctor.post(`/api/consultations/visit/${visitId}/prescription`).send({ items });
    assert.equal(warn.status, 409);
    assert.equal(warn.body.error.code, 'ALLERGY_WARNING');
    const ok = await doctor.post(`/api/consultations/visit/${visitId}/prescription`).send({ items, acknowledgeAllergy: true });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
  });

  it('dispensing more than the stock rolls back the WHOLE transaction', async () => {
    await pharm.post('/api/queue/pharmacy/call-next');
    const ctx = (await pharm.get(`/api/pharmacy/visit/${visitId}`)).body;
    const rx = ctx.prescription;
    const line = (n) => rx.items.find((i) => i.name === n);
    const paraBefore = ctx.stock[line('Paracetamol').medicationId].stockQty;
    const res = await pharm.post(`/api/pharmacy/prescriptions/${rx._id}/dispense`).send({
      lines: [
        { itemId: line('Paracetamol')._id, quantity: 18 },
        { itemId: line('Zinc Sulphate')._id, quantity: 20 }, // only 8 in stock
      ],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
    const after = (await pharm.get(`/api/pharmacy/visit/${visitId}`)).body;
    assert.equal(after.stock[line('Paracetamol').medicationId].stockQty, paraBefore); // paracetamol decrement was rolled back
    assert.equal(after.prescription.status, 'pending');
  });

  it('cannot dispense more than prescribed; partial dispensing completes the visit', async () => {
    const ctx = (await pharm.get(`/api/pharmacy/visit/${visitId}`)).body;
    const rx = ctx.prescription;
    const line = (n) => rx.items.find((i) => i.name === n);
    const over = await pharm.post(`/api/pharmacy/prescriptions/${rx._id}/dispense`).send({ lines: [{ itemId: line('Paracetamol')._id, quantity: 50 }] });
    assert.equal(over.status, 400);
    const res = await pharm.post(`/api/pharmacy/prescriptions/${rx._id}/dispense`).send({
      lines: [
        { itemId: line('Paracetamol')._id, quantity: 18 },
        { itemId: line('Zinc Sulphate')._id, quantity: 8 },
        { itemId: line('Ibuprofen')._id, quantity: 9 },
      ],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.prescription.status, 'partially_dispensed');
    const board = (await rec.get('/api/queue/board')).body;
    assert.ok(!Object.values(board.stages).flat().some((v) => v._id === visitId)); // visit finished
    const again = await pharm.post(`/api/pharmacy/prescriptions/${rx._id}/dispense`).send({ lines: [{ itemId: line('Zinc Sulphate')._id, quantity: 1 }] });
    assert.equal(again.status, 409);
  });
});

describe('Clinician scope of practice (DR-05) and referral (FR-CON-08)', () => {
  it('a clinician cannot prescribe a doctor-only drug, but can refer to a doctor', async () => {
    const rec = await loginAs(EMAILS.reception);
    const clinician = await loginAs(EMAILS.clinician);
    const p = (await rec.get('/api/patients?q=P-')).body.patients[15]; // search returns up to 25
    const ci = await rec.post('/api/visits/check-in').send({ patientId: p._id, firstStage: 'consultation' });
    assert.equal(ci.status, 201, JSON.stringify(ci.body));
    // Clinician may get an older pool patient first; serve until we reach ours.
    let visit;
    for (let i = 0; i < 10; i++) {
      visit = (await clinician.post('/api/queue/consultation/call-next')).body.visit;
      if (!visit || visit._id === ci.body.visit._id) break;
      await clinician.put(`/api/consultations/visit/${visit._id}`).send({ chiefComplaint: 'x' });
      await clinician.post(`/api/consultations/visit/${visit._id}/complete`);
    }
    assert.equal(visit._id, ci.body.visit._id);
    await clinician.put(`/api/consultations/visit/${visit._id}`).send({ chiefComplaint: 'High BP', diagnosis: 'Hypertension' });
    const { medications } = (await clinician.get('/api/catalogues')).body;
    const losartan = medications.find((m) => m.name === 'Losartan');
    const res = await clinician.post(`/api/consultations/visit/${visit._id}/prescription`).send({
      items: [{ medicationId: losartan._id, dose: '50 mg', frequency: 'OD', durationDays: 30, quantity: 30 }],
    });
    assert.equal(res.status, 403);
    const docs = (await rec.get('/api/doctors')).body.doctors;
    const ref = await clinician.post(`/api/consultations/visit/${visit._id}/refer`).send({ toDoctorId: docs[0]._id, reason: 'Needs antihypertensive' });
    assert.equal(ref.status, 200, JSON.stringify(ref.body));
    assert.equal(ref.body.visit.stage, 'consultation');
    assert.equal(ref.body.visit.assignedTo, docs[0]._id);
  });
});
