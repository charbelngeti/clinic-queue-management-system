// Nursing assessment & vital signs (FR-NUR-02/03/04/05).
import { Visit, User } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { PRIORITIES } from '../utils/constants.js';
import { computeBmi, vitalFlags } from '../utils/vitals.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { moveToStage } from './queue.service.js';

export async function recordTriage(visitId, { vitals, complaint, notes, priority }, actor) {
  if (vitals.systolic && vitals.diastolic && vitals.diastolic >= vitals.systolic) {
    throw badRequest('Diastolic pressure must be lower than systolic pressure.', { diastolic: 'Must be lower than systolic.' });
  }
  const visit = await Visit.findById(visitId);
  if (!visit || !visit.isActive) throw notFound('Active visit');
  if (visit.stage !== 'triage') throw conflict('This patient is no longer at triage.');
  if (!['called', 'in_service'].includes(visit.queueStatus) || String(visit.calledBy) !== String(actor._id)) {
    throw forbidden('Call the patient from the triage queue before recording vitals.');
  }
  const bmi = computeBmi(vitals.weight, vitals.height);
  const triage = {
    vitals: { ...vitals, bmi },
    flags: vitalFlags(vitals),
    complaint,
    notes,
    recordedBy: actor._id,
    recordedAt: new Date(),
  };
  const set = { triage, queueStatus: 'in_service' };
  if (priority) Object.assign(set, { priority, priorityRank: PRIORITIES[priority] });
  const updated = await Visit.findOneAndUpdate(
    { _id: visitId, stage: 'triage', isActive: true, queueStatus: { $in: ['called', 'in_service'] } },
    { $set: set },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('This patient’s queue status has changed. Refresh and try again.');
  return updated;
}

/** Send the patient on to consultation — to a chosen doctor/clinician, the booked doctor, or the general pool. */
export async function sendToConsultation(visitId, { assignedTo }, actor) {
  return withTransaction(async (session) => {
    const visit = await Visit.findById(visitId).session(session);
    if (!visit) throw notFound('Visit');
    if (!visit.triage?.recordedAt) throw badRequest('Record the vital signs before sending the patient to consultation.');
    let target = null;
    if (assignedTo) {
      const staff = await User.findOne({ _id: assignedTo, role: { $in: ['doctor', 'clinician'] }, isActive: true }).session(session);
      if (!staff) throw badRequest('Choose an active doctor or clinician.');
      target = staff._id;
    }
    return moveToStage(visitId, { from: 'triage', to: 'consultation', assignedTo: target, keepQueueTime: true }, actor, session);
  });
}
