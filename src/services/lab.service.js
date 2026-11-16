// Laboratory (FR-LAB-01..05): lab techs call the next patient from the lab queue, collect samples,
// enter results; submitting results sends the patient back to the requesting clinician.
import { Visit, LabRequest, Patient } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { clinicDayRange, clinicDate } from '../utils/dates.js';
import { LAB_TRANSITIONS, assertTransition, fromStatesFor } from '../utils/transitions.js';
import { badRequest, conflict, forbidden, invalid, notFound } from '../utils/errors.js';
import { moveToStage } from './queue.service.js';
import { projectForRole } from './patient.service.js';

/** Requests for the visit the lab tech is serving. */
export async function forVisit(visitId, actor) {
  const visit = await Visit.findById(visitId).select('-triage');
  if (!visit) throw notFound('Visit');
  const [requests, patient] = await Promise.all([
    LabRequest.find({ visitId, status: { $nin: ['cancelled'] } }).sort({ createdAt: 1 }),
    Patient.findById(visit.patientId),
  ]);
  return { visit, patient: projectForRole(patient, actor.role), requests };
}

async function loadForLab(requestId, actor, session) {
  const req = await LabRequest.findById(requestId).session(session || null);
  if (!req) throw notFound('Lab request');
  const visit = await Visit.findById(req.visitId).session(session || null);
  if (!visit?.isActive || visit.stage !== 'lab') throw conflict('This patient is not at the laboratory.');
  if (String(visit.calledBy) !== String(actor._id)) throw forbidden('Call this patient from the lab queue first.');
  return { req, visit };
}

/** FR-LAB-02: requested → sample_collected → in_progress (conditional on current status). */
export async function setStatus(requestId, to, actor) {
  const { req } = await loadForLab(requestId, actor);
  assertTransition(LAB_TRANSITIONS, 'lab request', req.status, to);
  const set = { status: to };
  if (to === 'sample_collected') Object.assign(set, { sampleCollectedAt: new Date(), sampleCollectedBy: actor._id });
  const updated = await LabRequest.findOneAndUpdate(
    { _id: requestId, status: { $in: fromStatesFor(LAB_TRANSITIONS, to) } },
    { $set: set },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('The request was changed by someone else. Refresh and try again.');
  return updated;
}

/**
 * FR-LAB-03/04: record results for every test and release them. In one transaction the request is completed
 * and, once all of the visit's requests are complete, the patient returns to the requesting clinician's
 * consultation queue (keeping their original place) with "results ready".
 */
export async function submitResults(requestId, results, actor) {
  return withTransaction(async (session) => {
    const { req, visit } = await loadForLab(requestId, actor, session);
    if (req.status === 'requested') throw badRequest('Record sample collection before entering results.');
    assertTransition(LAB_TRANSITIONS, 'lab request', req.status, 'completed');

    const byLine = new Map(results.map((r) => [String(r.lineId), r]));
    const errors = {};
    for (const t of req.tests) {
      const r = byLine.get(String(t._id));
      if (!r || !r.value) errors[String(t._id)] = `Enter a result for ${t.name}.`;
      else t.result = { value: r.value, unit: r.unit, refRange: r.refRange, flag: r.flag || 'normal', comment: r.comment };
    }
    if (Object.keys(errors).length) throw invalid(errors, 'Every requested test needs a result.');

    Object.assign(req, { status: 'completed', completedBy: actor._id, completedByName: `${actor.firstName} ${actor.lastName}`, completedAt: new Date() });
    await req.save({ session });

    const stillOpen = await LabRequest.countDocuments({ visitId: visit._id, status: { $in: ['requested', 'sample_collected', 'in_progress'] } }).session(session);
    if (!stillOpen) {
      await moveToStage(
        visit._id,
        { from: 'lab', to: 'consultation', assignedTo: req.requestedBy, keepQueueTime: true, set: { labResultsReady: true } },
        actor,
        session,
      );
    }
    return req;
  });
}

/** FR-LAB-05: worklist/history of requests, e.g. completed today with turnaround time. */
export async function list({ status, date }) {
  const filter = {};
  if (status) filter.status = status;
  const { start, end } = clinicDayRange(date || clinicDate());
  filter.createdAt = { $gte: start, $lt: end };
  return LabRequest.find(filter).sort({ createdAt: -1 }).limit(200).populate('patientId', 'patientNo firstName lastName');
}
