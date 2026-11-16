import { Appointment, Patient } from '../models/index.js';
import { config } from '../config/env.js';
import { nextSeq, pad } from '../utils/counters.js';
import { clinicDate, clinicDateTimeToUtc, clinicDayRange } from '../utils/dates.js';
import { APPOINTMENT_TRANSITIONS, assertTransition, fromStatesFor } from '../utils/transitions.js';
import { AppError, badRequest, forbidden, notFound, conflict } from '../utils/errors.js';
import { getDoctor, templateSlots } from './doctor.service.js';

const POPULATE = [
  { path: 'patientId', select: 'patientNo firstName lastName dateOfBirth sex phone' },
  { path: 'doctorId', select: 'firstName lastName staffProfile.specialization staffProfile.room' },
];

/** FR-APT-01/02/03/04: book an appointment in a free slot of the doctor's schedule. */
export async function book({ patientId, doctorId, date, time, reason }, actor) {
  const channel = actor.role === 'patient' ? 'portal' : 'reception';
  if (actor.role === 'patient') {
    if (!actor.patientId) throw forbidden('Your account is not linked to a patient record.');
    patientId = String(actor.patientId); // patients can only book for themselves
  }
  const [doctor, patient] = await Promise.all([getDoctor(doctorId), Patient.findById(patientId)]);
  if (!patient) throw notFound('Patient');
  if (!doctor.isActive) throw badRequest('This doctor is not currently available for booking.');

  // The slot must exist in the doctor's weekly template (FR-APT-04, DR-10)…
  if (!templateSlots(doctor, date).includes(time)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'The doctor is not available at this time.', { time: 'Choose one of the available slots.' });
  }
  const startAt = clinicDateTimeToUtc(date, time);
  // …and be in the future.
  if (startAt.getTime() <= Date.now()) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Appointments cannot be booked in the past.', { time: 'This time has already passed.' });
  }
  const endAt = new Date(startAt.getTime() + doctor.staffProfile.slotMinutes * 60000);

  // A patient may hold only one active appointment per day with the same doctor (avoids accidental double booking).
  const { start, end } = clinicDayRange(date);
  const sameDay = await Appointment.exists({ patientId, doctorId, isActive: true, startAt: { $gte: start, $lt: end } });
  if (sameDay) throw conflict('The patient already has an appointment with this doctor on this day.');

  const year = date.slice(0, 4);
  const seq = await nextSeq(`appointmentNo:${year}`);
  // The unique partial indexes {doctorId,startAt} and {patientId,startAt} (isActive:true) make this insert
  // fail with a duplicate-key error if someone else took the slot a moment ago → 409 (see errorHandler).
  const appt = await Appointment.create({
    appointmentNo: `APT-${year}-${pad(seq, 5)}`,
    patientId,
    doctorId,
    startAt,
    endAt,
    reason,
    status: 'scheduled',
    isActive: true,
    bookedBy: { userId: actor._id, channel },
    statusHistory: [{ status: 'scheduled', by: actor._id, note: channel === 'portal' ? 'Booked via patient portal' : 'Booked at reception' }],
  });
  return appt.populate(POPULATE);
}

/** FR-APT-07: list with filters; doctors see only their own, patients only theirs. */
export async function list({ date, from, to, doctorId, status, patientId, q }, actor) {
  const filter = {};
  if (date) {
    const { start, end } = clinicDayRange(date);
    filter.startAt = { $gte: start, $lt: end };
  } else if (from || to) {
    filter.startAt = {};
    if (from) filter.startAt.$gte = clinicDayRange(from).start;
    if (to) filter.startAt.$lt = clinicDayRange(to).end;
  }
  if (status) filter.status = status;
  if (doctorId) filter.doctorId = doctorId;
  if (patientId) filter.patientId = patientId;
  if (actor.role === 'doctor') filter.doctorId = actor._id;
  if (actor.role === 'patient') filter.patientId = actor.patientId;
  if (actor.role === 'clinician') throw forbidden('Clinicians do not have booked appointments.');

  let query = Appointment.find(filter).populate(POPULATE).sort({ startAt: date ? 1 : -1 }).limit(300);
  let rows = await query;
  if (q) {
    const term = q.toLowerCase();
    rows = rows.filter((a) =>
      [a.appointmentNo, a.patientId?.patientNo, a.patientId?.firstName, a.patientId?.lastName].some((v) => v?.toLowerCase().includes(term)),
    );
  }
  return rows;
}

export async function getById(id, actor) {
  const appt = await Appointment.findById(id).populate(POPULATE);
  if (!appt) throw notFound('Appointment');
  if (actor?.role === 'patient' && String(appt.patientId._id) !== String(actor.patientId)) throw notFound('Appointment'); // IDOR protection
  if (actor?.role === 'doctor' && String(appt.doctorId._id) !== String(actor._id)) throw notFound('Appointment');
  return appt;
}

/**
 * Generic, race-safe status change. The update only matches if the appointment is still in a state
 * from which `to` is allowed, so concurrent conflicting actions cannot both succeed.
 */
export async function transition(id, to, { by, note, extra = {}, session } = {}) {
  const current = await Appointment.findById(id).session(session || null);
  if (!current) throw notFound('Appointment');
  assertTransition(APPOINTMENT_TRANSITIONS, 'appointment', current.status, to);
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: { $in: fromStatesFor(APPOINTMENT_TRANSITIONS, to) } },
    {
      $set: { status: to, isActive: ['scheduled', 'checked_in'].includes(to), ...extra },
      $push: { statusHistory: { status: to, at: new Date(), by, note } },
    },
    { returnDocument: 'after', session },
  );
  if (!updated) throw conflict('The appointment was changed by someone else. Refresh and try again.');
  return updated;
}

/** FR-APT-05: reception may cancel any scheduled appointment; patients only their own, ≥ 2 h before start. */
export async function cancel(id, actor, reason) {
  const appt = await getById(id, actor);
  if (actor.role === 'patient') {
    const cutoff = appt.startAt.getTime() - config.patientCancelCutoffHours * 3600 * 1000;
    if (Date.now() > cutoff) {
      throw new AppError(422, 'CANCEL_WINDOW_CLOSED', `Appointments can only be cancelled online up to ${config.patientCancelCutoffHours} hours before the start time. Please contact reception.`);
    }
  }
  if (appt.status !== 'scheduled') assertTransition(APPOINTMENT_TRANSITIONS, 'appointment', appt.status, 'cancelled');
  if (appt.status === 'checked_in') throw badRequest('This patient is already checked in. Cancel the visit from the queue instead.');
  const note = actor.role === 'patient' ? `Cancelled by patient: ${reason}` : `Cancelled by clinic: ${reason}`;
  await transition(id, 'cancelled', { by: actor._id, note, extra: { cancellation: { at: new Date(), by: actor._id, reason } } });
  return getById(id);
}

/** FR-APT-08: mark a past, un-attended appointment as a no-show. */
export async function markNoShow(id, actor) {
  const appt = await getById(id);
  if (appt.startAt.getTime() > Date.now()) throw badRequest('An appointment can only be marked as a no-show after its start time.');
  await transition(id, 'no_show', { by: actor._id, note: 'Patient did not attend' });
  return getById(id);
}

/** Today's appointments that are still "scheduled" although their start time has passed. */
export async function bulkNoShow(actor) {
  const { start } = clinicDayRange(clinicDate());
  const due = await Appointment.find({ status: 'scheduled', startAt: { $gte: start, $lt: new Date(Date.now() - 30 * 60000) } }).select('_id');
  let count = 0;
  for (const a of due) {
    try {
      await transition(a._id, 'no_show', { by: actor._id, note: 'Marked as no-show (end of session)' });
      count++;
    } catch {
      /* changed concurrently — skip */
    }
  }
  return count;
}
