// Queue management: check-in, "call next", stage transitions and queue boards (FR-QUE-*).
// A visit document IS the patient's queue entry: its `stage` says which department queue the patient is in
// and `queueStatus` says where they are in that queue. Moving between departments is a single-document
// atomic update; multi-document changes (e.g. with the appointment) use transactions.
import mongoose from 'mongoose';
import { Visit, Appointment, Patient, User } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { nextSeq, pad } from '../utils/counters.js';
import { clinicDate } from '../utils/dates.js';
import { PRIORITIES, STAGE_ROLES } from '../utils/constants.js';
import { STAGE_TRANSITIONS, assertTransition } from '../utils/transitions.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { transition as transitionAppointment } from './appointment.service.js';

const ACTIVE_SERVICE = ['called', 'in_service'];
const PATIENT_FIELDS = 'patientNo firstName lastName dateOfBirth sex allergies';

const staffName = (u) => `${u.role === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}`;

/* ------------------------------------------------------------------ */
/* Check-in (FR-QUE-01/02/03)                                          */
/* ------------------------------------------------------------------ */
export async function checkIn({ appointmentId, patientId, firstStage, priority = 'normal' }, actor) {
  const today = clinicDate();
  return withTransaction(async (session) => {
    let appointment = null;
    let type = 'walk_in';
    let queueTime = new Date();

    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId).session(session);
      if (!appointment) throw notFound('Appointment');
      if (clinicDate(appointment.startAt) !== today) throw badRequest('Only appointments scheduled for today can be checked in.');
      patientId = String(appointment.patientId);
      type = 'appointment';
      // Patients who arrive on time are queued by their appointment time, late arrivals by arrival time.
      if (Date.now() <= appointment.startAt.getTime()) queueTime = appointment.startAt;
    }

    const patient = await Patient.findById(patientId).session(session);
    if (!patient) throw notFound('Patient');

    const year = today.slice(0, 4);
    const prefix = type === 'appointment' ? 'A' : 'W';
    const [ticketSeq, visitSeq] = [await nextSeq(`ticket:${today}:${prefix}`, session), await nextSeq(`visitNo:${year}`, session)];
    const assignedTo = firstStage === 'consultation' && appointment ? appointment.doctorId : null;

    // If the patient already has an active visit, the unique partial index {patientId} (isActive: true)
    // rejects this insert → 409 "already in the queue" (FR-QUE-03) and the transaction rolls back.
    const [visit] = await Visit.create(
      [
        {
          visitNo: `V-${year}-${pad(visitSeq, 6)}`,
          ticketNo: `${prefix}-${pad(ticketSeq, 3)}`,
          clinicDate: today,
          patientId,
          appointmentId: appointment?._id,
          doctorId: appointment?.doctorId,
          type,
          stage: firstStage,
          queueStatus: 'waiting',
          isActive: true,
          priority,
          priorityRank: PRIORITIES[priority],
          queueTime,
          assignedTo,
          stageHistory: [{ stage: firstStage, enteredAt: new Date() }],
          createdBy: actor._id,
        },
      ],
      { session },
    );

    if (appointment) {
      await transitionAppointment(appointment._id, 'checked_in', {
        by: actor._id,
        note: `Checked in, ticket ${visit.ticketNo}`,
        extra: { visitId: visit._id },
        session,
      });
    }
    return visit;
  });
}

/* ------------------------------------------------------------------ */
/* Call next patient (FR-QUE-06) — the core concurrency-safe operation */
/* ------------------------------------------------------------------ */
export async function callNext(stage, actor) {
  if (!STAGE_ROLES[stage]?.includes(actor.role)) throw forbidden(`Your role does not serve the ${stage} queue.`);

  // A staff member serves one patient at a time.
  const busy = await Visit.findOne({ stage, calledBy: actor._id, queueStatus: { $in: ACTIVE_SERVICE }, isActive: true });
  if (busy) throw conflict(`Finish with ticket ${busy.ticketNo} before calling the next patient.`);

  const now = new Date();
  const filter = { stage, queueStatus: 'waiting', isActive: true };
  // Consultation: take patients assigned to me, or unassigned patients from the general pool.
  if (stage === 'consultation') filter.assignedTo = { $in: [actor._id, null] };

  // findOneAndUpdate is atomic: the match ("still waiting") and the update ("now called by me") happen as one
  // step on one document, so two staff members clicking at the same moment can never get the same patient.
  const visit = await Visit.findOneAndUpdate(
    filter,
    {
      $set: {
        queueStatus: 'called',
        calledBy: actor._id,
        calledAt: now,
        room: actor.staffProfile?.room || null,
        'stageHistory.$[open].calledAt': now,
      },
    },
    {
      sort: { priorityRank: 1, queueTime: 1 }, // emergencies first, then by queue time (DR-03)
      arrayFilters: [{ 'open.stage': stage, 'open.leftAt': { $exists: false } }],
      returnDocument: 'after',
    },
  ).populate('patientId', PATIENT_FIELDS);

  return visit; // null → the queue is empty
}

/* ------------------------------------------------------------------ */
/* Status changes within a stage                                       */
/* ------------------------------------------------------------------ */
async function loadForStage(visitId, actor) {
  const visit = await Visit.findById(visitId);
  if (!visit || !visit.isActive) throw notFound('Active visit');
  if (!STAGE_ROLES[visit.stage]?.includes(actor.role)) throw forbidden(`Your role does not serve the ${visit.stage} queue.`);
  return visit;
}

async function setStatus(visitId, fromStatuses, set, actor) {
  const updated = await Visit.findOneAndUpdate(
    { _id: visitId, isActive: true, queueStatus: { $in: fromStatuses } },
    { $set: set },
    { returnDocument: 'after' },
  ).populate('patientId', PATIENT_FIELDS);
  if (!updated) throw conflict('This patient’s queue status has changed. Refresh and try again.');
  return updated;
}

/** called → in_service (patient arrived at the room). */
export async function startService(visitId, actor) {
  const v = await loadForStage(visitId, actor);
  if (String(v.calledBy) !== String(actor._id)) throw forbidden('Only the staff member who called this patient can start the service.');
  return setStatus(visitId, ['called'], { queueStatus: 'in_service' }, actor);
}

/** called → skipped (patient did not respond). */
export async function skip(visitId, actor) {
  const v = await loadForStage(visitId, actor);
  if (String(v.calledBy) !== String(actor._id)) throw forbidden('Only the staff member who called this patient can skip them.');
  return setStatus(visitId, ['called'], { queueStatus: 'skipped', calledBy: null, room: null }, actor);
}

/** called → called (call the same ticket again on the display). */
export async function recall(visitId, actor) {
  const v = await loadForStage(visitId, actor);
  if (String(v.calledBy) !== String(actor._id)) throw forbidden('Only the staff member who called this patient can recall them.');
  return setStatus(visitId, ['called'], { calledAt: new Date() }, actor);
}

/** skipped → waiting (patient came back). Reception or the stage's staff. Re-queued at the back. */
export async function requeue(visitId, actor) {
  const v = await Visit.findById(visitId);
  if (!v || !v.isActive) throw notFound('Active visit');
  if (actor.role !== 'receptionist' && !STAGE_ROLES[v.stage]?.includes(actor.role)) throw forbidden();
  return setStatus(visitId, ['skipped'], { queueStatus: 'waiting', queueTime: new Date() }, actor);
}

/* ------------------------------------------------------------------ */
/* Moving between departments (FR-NUR-04, FR-CON-04/05/07/08, FR-PHA) */
/* ------------------------------------------------------------------ */
/**
 * Move the visit `visitId` (currently at stage `from`) to stage `to`.
 * Used by triage → consultation, consultation → lab/pharmacy/done/referral, lab → consultation, pharmacy → done.
 * Pass a `session` to make it part of a larger transaction (e.g. creating a lab request).
 */
export async function moveToStage(visitId, opts, actor, session) {
  // Closing the old stage and opening the new one are two writes, so always run inside a transaction.
  if (!session) return withTransaction((s) => moveToStage(visitId, opts, actor, s));
  const { from, to, assignedTo = null, keepQueueTime = false, set = {}, requireServer = true } = opts;
  assertTransition(STAGE_TRANSITIONS, 'patient', from, to);
  const visit = await Visit.findById(visitId).session(session || null);
  if (!visit || !visit.isActive) throw notFound('Active visit');
  if (visit.stage !== from) throw conflict(`The patient is no longer at ${from}.`);
  if (!ACTIVE_SERVICE.includes(visit.queueStatus)) throw conflict('Call the patient before sending them to another department.');
  if (requireServer && String(visit.calledBy) !== String(actor._id)) throw forbidden('Only the staff member serving this patient can do this.');

  const now = new Date();
  const done = to === 'done';
  const update = {
    $set: {
      stage: to,
      queueStatus: done ? 'completed' : 'waiting',
      isActive: !done,
      assignedTo: done ? null : assignedTo,
      calledBy: null,
      calledAt: null,
      room: null,
      ...(keepQueueTime ? {} : { queueTime: now }),
      ...(done ? { completedAt: now } : {}),
      'stageHistory.$[open].leftAt': now,
      'stageHistory.$[open].servedBy': actor._id,
      ...set,
    },
  };
  // Close the current stage-history entry; then open a new one for the next stage.
  const updated = await Visit.findOneAndUpdate(
    { _id: visitId, stage: from, queueStatus: { $in: ACTIVE_SERVICE }, isActive: true },
    update,
    { arrayFilters: [{ 'open.stage': from, 'open.leftAt': { $exists: false } }], returnDocument: 'after', session },
  );
  if (!updated) throw conflict('This patient’s queue status has changed. Refresh and try again.');
  if (!done) {
    await Visit.updateOne({ _id: visitId }, { $push: { stageHistory: { stage: to, enteredAt: now } } }, { session });
  } else if (updated.appointmentId) {
    await transitionAppointment(updated.appointmentId, 'completed', { by: actor._id, note: 'Visit completed', session });
  }
  return updated;
}

/** Reception cancels a visit, e.g. the patient left (FR-QUE-11). */
export async function cancelVisit(visitId, reason, actor) {
  return withTransaction(async (session) => {
    const now = new Date();
    const visit = await Visit.findOneAndUpdate(
      { _id: visitId, isActive: true },
      {
        $set: { queueStatus: 'cancelled', isActive: false, cancelReason: reason, completedAt: now, 'stageHistory.$[open].leftAt': now },
      },
      { arrayFilters: [{ 'open.leftAt': { $exists: false } }], returnDocument: 'after', session },
    );
    if (!visit) throw notFound('Active visit');
    if (visit.appointmentId) {
      await transitionAppointment(visit.appointmentId, 'cancelled', { by: actor._id, note: `Visit cancelled: ${reason}`, session });
    }
    return visit;
  });
}

/** Change triage priority (nurse) — re-sorts the patient within all subsequent queues. */
export async function setPriority(visitId, priority, session) {
  return Visit.findOneAndUpdate(
    { _id: visitId, isActive: true },
    { $set: { priority, priorityRank: PRIORITIES[priority] } },
    { returnDocument: 'after', session },
  );
}

/* ------------------------------------------------------------------ */
/* Queue views                                                          */
/* ------------------------------------------------------------------ */
const ORDER = { priorityRank: 1, queueTime: 1 };

/** Staff worklist for one stage: patients waiting (mine + pool for consultation), skipped, and who I'm serving. */
export async function stageWorklist(stage, actor) {
  if (!STAGE_ROLES[stage]?.includes(actor.role)) throw forbidden();
  const base = { stage, isActive: true };
  const pool = stage === 'consultation' ? { assignedTo: { $in: [actor._id, null] } } : {};
  // Lab and pharmacy do not need nursing vitals (need-to-know, NFR-PRI-01).
  const fields = ['lab', 'pharmacy'].includes(stage) ? '-triage' : '';
  const [waiting, current, skipped, othersServing] = await Promise.all([
    Visit.find({ ...base, ...pool, queueStatus: 'waiting' }).select(fields).sort(ORDER).populate('patientId', PATIENT_FIELDS).populate('assignedTo', 'firstName lastName role'),
    Visit.findOne({ ...base, queueStatus: { $in: ACTIVE_SERVICE }, calledBy: actor._id }).select(fields).populate('patientId', PATIENT_FIELDS),
    Visit.find({ ...base, ...pool, queueStatus: 'skipped' }).select(fields).sort(ORDER).populate('patientId', PATIENT_FIELDS),
    Visit.countDocuments({ ...base, queueStatus: { $in: ACTIVE_SERVICE }, calledBy: { $ne: actor._id } }),
  ]);
  return { stage, waiting, current, skipped, othersServing };
}

/** Reception/admin queue monitor: every active visit, grouped by stage (FR-QUE-08). */
export async function queueBoard() {
  // Reception sees operational data only — clinical triage data is excluded (DR-01).
  const visits = await Visit.find({ isActive: true })
    .select('-triage')
    .sort(ORDER)
    .populate('patientId', 'patientNo firstName lastName dateOfBirth sex phone')
    .populate('assignedTo', 'firstName lastName role')
    .populate('calledBy', 'firstName lastName role')
    .populate('doctorId', 'firstName lastName');
  const today = clinicDate();
  const completedToday = await Visit.countDocuments({ clinicDate: today, queueStatus: 'completed' });
  const stages = { triage: [], consultation: [], lab: [], pharmacy: [] };
  for (const v of visits) stages[v.stage]?.push(v);
  return { stages, completedToday, generatedAt: new Date() };
}

/** Public "Who's Next" data — tickets, stage and room only, no names (FR-QUE-09, DR-01, NFR-PRI-02). */
export async function publicBoard() {
  const visits = await Visit.find({ isActive: true, queueStatus: { $in: ['waiting', 'called', 'in_service'] } })
    .sort(ORDER)
    .select('ticketNo stage queueStatus room calledAt priorityRank')
    .lean();
  const out = {};
  for (const stage of ['triage', 'consultation', 'lab', 'pharmacy']) {
    const at = visits.filter((v) => v.stage === stage);
    out[stage] = {
      nowServing: at
        .filter((v) => v.queueStatus !== 'waiting')
        .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
        .map((v) => ({ ticketNo: v.ticketNo, room: v.room, status: v.queueStatus, calledAt: v.calledAt })),
      next: at.filter((v) => v.queueStatus === 'waiting').slice(0, 6).map((v) => ({ ticketNo: v.ticketNo })),
      waitingCount: at.filter((v) => v.queueStatus === 'waiting').length,
    };
  }
  return { stages: out, generatedAt: new Date() };
}

/** The patient's own live queue position (FR-QUE-10). */
export async function myVisit(patientId) {
  const visit = await Visit.findOne({ patientId, isActive: true }).populate('assignedTo', 'firstName lastName role').lean();
  if (!visit) return null;
  let position = null;
  if (visit.queueStatus === 'waiting') {
    const ahead = {
      stage: visit.stage,
      isActive: true,
      queueStatus: 'waiting',
      $or: [{ priorityRank: { $lt: visit.priorityRank } }, { priorityRank: visit.priorityRank, queueTime: { $lt: visit.queueTime } }],
    };
    if (visit.stage === 'consultation') ahead.assignedTo = { $in: [visit.assignedTo?._id ?? null, null] };
    position = (await Visit.countDocuments(ahead)) + 1;
  }
  const { ticketNo, stage, queueStatus, room, clinicDate: date, createdAt } = visit;
  return {
    ticketNo, stage, queueStatus, room, clinicDate: date, checkedInAt: createdAt, position,
    assignedTo: visit.assignedTo ? staffName(visit.assignedTo) : null,
  };
}

export async function getVisit(visitId) {
  if (!mongoose.isValidObjectId(visitId)) throw notFound('Visit');
  const v = await Visit.findById(visitId)
    .populate('patientId')
    .populate('triage.recordedBy', 'firstName lastName role')
    .populate('assignedTo', 'firstName lastName role')
    .populate('doctorId', 'firstName lastName');
  if (!v) throw notFound('Visit');
  return v;
}

/** Staff who can receive a patient at a stage (e.g. doctors/clinicians for consultation). */
export async function staffForStage(stage) {
  const roles = STAGE_ROLES[stage];
  if (!roles) throw new AppError(400, 'BAD_REQUEST', 'Unknown stage.');
  return User.find({ role: { $in: roles }, isActive: true }).select('firstName lastName role staffProfile.room staffProfile.specialization').sort({ role: 1, lastName: 1 });
}
