import * as queue from '../services/queue.service.js';
import * as triage from '../services/triage.service.js';
import { audit } from '../services/audit.service.js';
import { validate } from '../utils/validate.js';
import { vitalsRules } from '../utils/vitals.js';
import { PRIORITIES } from '../utils/constants.js';
import { forbidden, badRequest } from '../utils/errors.js';
import { can } from '../services/rbac.js';

const STAGES = ['triage', 'consultation', 'lab', 'pharmacy'];

export async function checkIn(req, res) {
  const data = validate(req.body, {
    appointmentId: { type: 'objectId', label: 'Appointment' },
    patientId: { type: 'objectId', label: 'Patient' },
    firstStage: { type: 'string', required: true, enum: ['triage', 'consultation'], label: 'First stop' },
    priority: { type: 'string', enum: Object.keys(PRIORITIES), default: 'normal', label: 'Priority' },
  });
  if (!data.appointmentId && !data.patientId) throw badRequest('Choose an appointment or a patient to check in.');
  const visit = await queue.checkIn(data, req.user);
  await audit(req, 'visit.checkIn', 'visit', visit._id, `Checked in ${visit.ticketNo} (${visit.type}) → ${visit.stage}`);
  res.status(201).json({ visit });
}

export async function board(_req, res) {
  res.json(await queue.queueBoard());
}

export async function publicBoard(_req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await queue.publicBoard());
}

function stageParam(req) {
  const { stage } = validate(req.params, { stage: { type: 'string', required: true, enum: STAGES, label: 'Stage' } });
  if (!can(req.user.role, `queue:serve:${stage}`)) throw forbidden(`Your role does not serve the ${stage} queue.`);
  return stage;
}

export async function worklist(req, res) {
  res.json(await queue.stageWorklist(stageParam(req), req.user));
}

export async function callNext(req, res) {
  const stage = stageParam(req);
  const visit = await queue.callNext(stage, req.user);
  if (!visit) return res.json({ visit: null, message: 'No patients are waiting.' });
  await audit(req, 'queue.call', 'visit', visit._id, `Called ${visit.ticketNo} at ${stage}`);
  res.json({ visit });
}

export async function start(req, res) {
  res.json({ visit: await queue.startService(req.params.id, req.user) });
}
export async function skip(req, res) {
  const visit = await queue.skip(req.params.id, req.user);
  await audit(req, 'queue.skip', 'visit', visit._id, `Skipped ${visit.ticketNo}`);
  res.json({ visit });
}
export async function recall(req, res) {
  res.json({ visit: await queue.recall(req.params.id, req.user) });
}
export async function requeue(req, res) {
  res.json({ visit: await queue.requeue(req.params.id, req.user) });
}

export async function cancelVisit(req, res) {
  const { reason } = validate(req.body, { reason: { type: 'string', required: true, max: 300, label: 'Reason' } });
  const visit = await queue.cancelVisit(req.params.id, reason, req.user);
  await audit(req, 'visit.cancel', 'visit', visit._id, `Cancelled visit ${visit.ticketNo}: ${reason}`);
  res.json({ visit });
}

export async function getVisit(req, res) {
  res.json({ visit: await queue.getVisit(req.params.id) });
}

export async function myVisit(req, res) {
  res.json({ visit: await queue.myVisit(req.user.patientId) });
}

export async function stageStaff(req, res) {
  const { stage } = validate(req.params, { stage: { type: 'string', required: true, enum: STAGES } });
  res.json({ staff: await queue.staffForStage(stage) });
}

/* ---------------- triage ---------------- */
export async function recordTriage(req, res) {
  const vit = validate(req.body.vitals || {}, vitalsRules());
  const data = validate(req.body, {
    complaint: { type: 'string', max: 500, label: 'Presenting complaint' },
    notes: { type: 'string', max: 2000, label: 'Nursing notes' },
    priority: { type: 'string', enum: Object.keys(PRIORITIES), label: 'Priority' },
  });
  if (!Object.keys(vit).length) throw badRequest('Record at least one vital sign.');
  const visit = await triage.recordTriage(req.params.id, { ...data, vitals: vit }, req.user);
  await audit(req, 'triage.record', 'visit', visit._id, `Recorded vitals for ${visit.ticketNo}`);
  res.json({ visit });
}

export async function sendToConsultation(req, res) {
  const data = validate(req.body, { assignedTo: { type: 'objectId', label: 'Doctor / clinician' } });
  const visit = await triage.sendToConsultation(req.params.id, data, req.user);
  await audit(req, 'triage.send', 'visit', visit._id, `Sent ${visit.ticketNo} to consultation`);
  res.json({ visit });
}
