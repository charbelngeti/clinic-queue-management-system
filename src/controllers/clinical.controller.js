import * as consult from '../services/consultation.service.js';
import * as lab from '../services/lab.service.js';
import * as pharmacy from '../services/pharmacy.service.js';
import { audit } from '../services/audit.service.js';
import { validate } from '../utils/validate.js';
import { LAB_STATUSES, RX_STATUSES } from '../utils/constants.js';

/* ---------------- consultation (doctor / clinician) ---------------- */
const noteRules = {
  chiefComplaint: { type: 'string', max: 500, label: 'Chief complaint' },
  history: { type: 'string', max: 4000, label: 'History' },
  examination: { type: 'string', max: 4000, label: 'Examination' },
  diagnosis: { type: 'string', max: 1000, label: 'Diagnosis' },
  plan: { type: 'string', max: 2000, label: 'Plan' },
  notes: { type: 'string', max: 4000, label: 'Notes' },
};

export async function consultationContext(req, res) {
  const ctx = await consult.context(req.params.visitId, req.user);
  await audit(req, 'patient.clinicalSummary', 'patient', ctx.patient._id, `Opened clinical record for visit ${ctx.visit.ticketNo}`);
  res.json(ctx);
}

export async function saveNote(req, res) {
  const data = validate(req.body, noteRules, { partial: true });
  for (const k of Object.keys(data)) if (data[k] === null) data[k] = '';
  const note = await consult.saveNote(req.params.visitId, data, req.user);
  res.json({ consultation: note });
}

export async function requestLab(req, res) {
  const data = validate(req.body, {
    testIds: { type: 'array', required: true, min: 1, max: 15, of: { type: 'objectId' }, label: 'Tests' },
    priority: { type: 'string', enum: ['routine', 'urgent'], default: 'routine', label: 'Priority' },
    clinicalNotes: { type: 'string', max: 1000, label: 'Clinical notes' },
  });
  const request = await consult.requestLab(req.params.visitId, data, req.user);
  await audit(req, 'lab.request', 'labRequest', request._id, `Requested ${request.tests.map((t) => t.code).join(', ')} (${request.requestNo})`);
  res.status(201).json({ labRequest: request });
}

export async function prescribe(req, res) {
  const data = validate(req.body, {
    items: {
      type: 'array',
      required: true,
      min: 1,
      max: 15,
      label: 'Medications',
      of: {
        type: 'object',
        fields: {
          medicationId: { type: 'objectId', required: true, label: 'Medication' },
          dose: { type: 'string', required: true, max: 60, label: 'Dose' },
          frequency: { type: 'string', required: true, max: 60, label: 'Frequency' },
          durationDays: { type: 'int', required: true, min: 1, max: 365, label: 'Duration' },
          quantity: { type: 'int', required: true, min: 1, max: 1000, label: 'Quantity' },
          instructions: { type: 'string', max: 300, label: 'Instructions' },
        },
      },
    },
    notes: { type: 'string', max: 500, label: 'Notes' },
    acknowledgeAllergy: { type: 'boolean' },
  });
  const rx = await consult.prescribe(req.params.visitId, data, req.user);
  await audit(req, 'prescription.create', 'prescription', rx._id, `Prescribed ${rx.items.length} item(s) (${rx.rxNo})`);
  res.status(201).json({ prescription: rx });
}

export async function completeVisit(req, res) {
  const visit = await consult.complete(req.params.visitId, req.user);
  await audit(req, 'visit.complete', 'visit', visit._id, `Completed visit ${visit.ticketNo} without prescription`);
  res.json({ visit });
}

export async function refer(req, res) {
  const data = validate(req.body, {
    toDoctorId: { type: 'objectId', required: true, label: 'Doctor' },
    reason: { type: 'string', required: true, max: 300, label: 'Reason' },
  });
  const visit = await consult.refer(req.params.visitId, data, req.user);
  await audit(req, 'visit.refer', 'visit', visit._id, `Referred ${visit.ticketNo}: ${data.reason}`);
  res.json({ visit });
}

export async function catalogues(_req, res) {
  res.json(await consult.catalogues());
}

/* ---------------- laboratory ---------------- */
export async function labForVisit(req, res) {
  res.json(await lab.forVisit(req.params.visitId, req.user));
}

export async function labStatus(req, res) {
  const { status } = validate(req.body, { status: { type: 'string', required: true, enum: ['sample_collected', 'in_progress'], label: 'Status' } });
  const r = await lab.setStatus(req.params.id, status, req.user);
  await audit(req, 'lab.status', 'labRequest', r._id, `${r.requestNo} → ${status}`);
  res.json({ labRequest: r });
}

export async function labResults(req, res) {
  const { results } = validate(req.body, {
    results: {
      type: 'array',
      required: true,
      min: 1,
      max: 20,
      label: 'Results',
      of: {
        type: 'object',
        fields: {
          lineId: { type: 'objectId', required: true },
          value: { type: 'string', max: 100, label: 'Result' },
          unit: { type: 'string', max: 30 },
          refRange: { type: 'string', max: 60 },
          flag: { type: 'string', enum: ['normal', 'low', 'high', 'critical'] },
          comment: { type: 'string', max: 500 },
        },
      },
    },
  });
  const r = await lab.submitResults(req.params.id, results, req.user);
  await audit(req, 'lab.results', 'labRequest', r._id, `Released results for ${r.requestNo}`);
  res.json({ labRequest: r });
}

export async function labList(req, res) {
  const q = validate(req.query, { status: { type: 'string', enum: LAB_STATUSES }, date: { type: 'dateString' } });
  res.json({ labRequests: await lab.list(q) });
}

/* ---------------- pharmacy ---------------- */
export async function rxForVisit(req, res) {
  res.json(await pharmacy.forVisit(req.params.visitId, req.user));
}

export async function dispense(req, res) {
  const { lines } = validate(req.body, {
    lines: {
      type: 'array',
      required: true,
      min: 1,
      max: 20,
      label: 'Items',
      of: { type: 'object', fields: { itemId: { type: 'objectId', required: true }, quantity: { type: 'int', required: true, min: 0, max: 1000, label: 'Quantity' } } },
    },
  });
  const rx = await pharmacy.dispense(req.params.id, lines, req.user);
  await audit(req, 'prescription.dispense', 'prescription', rx._id, `Dispensed ${rx.rxNo} (${rx.status})`);
  res.json({ prescription: rx });
}

export async function rxList(req, res) {
  const q = validate(req.query, { status: { type: 'string', enum: RX_STATUSES }, date: { type: 'dateString' } });
  res.json({ prescriptions: await pharmacy.listPrescriptions(q) });
}

const medRules = {
  name: { type: 'string', required: true, max: 80, label: 'Name' },
  strength: { type: 'string', required: true, max: 40, label: 'Strength' },
  form: { type: 'string', required: true, max: 40, label: 'Form' },
  unit: { type: 'string', max: 20, label: 'Unit' },
  reorderLevel: { type: 'int', min: 0, max: 100000, label: 'Reorder level' },
  clinicianMayPrescribe: { type: 'boolean', label: 'Clinicians may prescribe' },
  isActive: { type: 'boolean', label: 'Active' },
};

export async function listMedications(req, res) {
  res.json({ medications: await pharmacy.listMedications({ all: req.user.role === 'admin' || req.user.role === 'pharmacist' }) });
}

export async function createMedication(req, res) {
  const data = validate(req.body, { ...medRules, stockQty: { type: 'int', min: 0, max: 100000, default: 0, label: 'Opening stock' } });
  const med = await pharmacy.createMedication(data);
  await audit(req, 'medication.create', 'medication', med._id, `Added ${med.name} ${med.strength}`);
  res.status(201).json({ medication: med });
}

export async function updateMedication(req, res) {
  const data = validate(req.body, medRules, { partial: true });
  const med = await pharmacy.updateMedication(req.params.id, data);
  await audit(req, 'medication.update', 'medication', med._id, `Updated ${med.name} ${med.strength}`);
  res.json({ medication: med });
}

export async function receiveStock(req, res) {
  const { quantity } = validate(req.body, { quantity: { type: 'int', required: true, min: 1, max: 100000, label: 'Quantity' } });
  const med = await pharmacy.receiveStock(req.params.id, quantity);
  await audit(req, 'medication.receive', 'medication', med._id, `Received ${quantity} of ${med.name} ${med.strength}`);
  res.json({ medication: med });
}

export async function labTests(_req, res) {
  const { labTests } = await consult.catalogues();
  res.json({ labTests });
}
