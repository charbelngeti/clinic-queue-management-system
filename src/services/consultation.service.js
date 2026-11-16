// Clinical consultation, shared by doctors and clinicians (FR-CON-01..09). Their only differences are
// permission rules: clinicians may prescribe only medications flagged `clinicianMayPrescribe`.
import { Visit, Patient, Consultation, LabRequest, LabTest, Prescription, Medication, User } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { nextSeq, pad } from '../utils/counters.js';
import { clinicDate } from '../utils/dates.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { moveToStage } from './queue.service.js';

const name = (u) => `${u.role === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}`;

/** The visit must be at consultation and currently being served by this clinician. */
async function loadServedVisit(visitId, actor, session) {
  const visit = await Visit.findById(visitId).session(session || null);
  if (!visit || !visit.isActive) throw notFound('Active visit');
  if (visit.stage !== 'consultation') throw conflict('This patient is not in consultation.');
  if (!['called', 'in_service'].includes(visit.queueStatus) || String(visit.calledBy) !== String(actor._id)) {
    throw forbidden('Call this patient from your consultation queue first.');
  }
  return visit;
}

/** Everything the clinician needs on screen: visit, vitals, patient, history, this visit's lab/Rx (FR-CON-02). */
export async function context(visitId, actor) {
  const visit = await loadServedVisit(visitId, actor);
  const [patient, consultation, labRequests, prescription, history, pastLabs, pastRx] = await Promise.all([
    Patient.findById(visit.patientId),
    Consultation.findOne({ visitId, clinicianId: actor._id }).sort({ createdAt: -1 }),
    LabRequest.find({ visitId }).sort({ createdAt: 1 }),
    Prescription.findOne({ visitId }),
    Consultation.find({ patientId: visit.patientId, visitId: { $ne: visitId }, status: 'final' }).sort({ createdAt: -1 }).limit(10),
    LabRequest.find({ patientId: visit.patientId, visitId: { $ne: visitId }, status: 'completed' }).sort({ createdAt: -1 }).limit(10),
    Prescription.find({ patientId: visit.patientId, visitId: { $ne: visitId } }).sort({ createdAt: -1 }).limit(10),
  ]);
  // Earlier consultations in THIS visit by other clinicians (e.g. before a referral).
  const visitNotes = await Consultation.find({ visitId, clinicianId: { $ne: actor._id } }).sort({ createdAt: 1 });
  // Mark lab results as reviewed when the requesting clinician opens them.
  await LabRequest.updateMany({ visitId, requestedBy: actor._id, status: 'completed', reviewedAt: null }, { $set: { reviewedAt: new Date() } });
  return { visit, patient, consultation, visitNotes, labRequests, prescription, history: { consultations: history, labs: pastLabs, prescriptions: pastRx } };
}

/** Save (create or update) this clinician's draft consultation note for the visit (FR-CON-03, FR-CON-09). */
export async function saveNote(visitId, data, actor, session) {
  const visit = await loadServedVisit(visitId, actor, session);
  const existing = await Consultation.findOne({ visitId, clinicianId: actor._id }).sort({ createdAt: -1 }).session(session || null);
  if (existing && existing.status === 'final') throw conflict('This consultation is finalised and can no longer be edited.');
  if (existing) {
    Object.assign(existing, data);
    await existing.save({ session });
    return existing;
  }
  const [created] = await Consultation.create(
    [{ ...data, visitId, patientId: visit.patientId, clinicianId: actor._id, clinicianName: name(actor), clinicianRole: actor.role, status: 'draft' }],
    { session },
  );
  return created;
}

async function requireNote(visitId, actor, session) {
  const note = await Consultation.findOne({ visitId, clinicianId: actor._id, status: 'draft' }).session(session);
  if (!note || !(note.chiefComplaint || note.diagnosis || note.notes || note.examination)) {
    throw new AppError(422, 'NOTE_REQUIRED', 'Record the consultation (at least the complaint or diagnosis) before continuing.');
  }
  return note;
}

async function finalize(note, session, extra = {}) {
  Object.assign(note, { status: 'final', finalizedAt: new Date(), ...extra });
  await note.save({ session });
}

/** FR-CON-04: request lab tests → patient moves to the lab queue (transaction). */
export async function requestLab(visitId, { testIds, priority, clinicalNotes }, actor) {
  return withTransaction(async (session) => {
    await loadServedVisit(visitId, actor, session);
    await requireNote(visitId, actor, session);
    const tests = await LabTest.find({ _id: { $in: testIds }, isActive: true }).session(session);
    if (tests.length !== new Set(testIds).size) throw badRequest('One or more selected tests are not available.');
    const year = clinicDate().slice(0, 4);
    const seq = await nextSeq(`labRequestNo:${year}`, session);
    const visit = await Visit.findById(visitId).session(session);
    const [request] = await LabRequest.create(
      [
        {
          requestNo: `LAB-${year}-${pad(seq, 5)}`,
          visitId,
          patientId: visit.patientId,
          requestedBy: actor._id,
          requestedByName: name(actor),
          priority,
          clinicalNotes,
          status: 'requested',
          tests: tests.map((t) => ({ testId: t._id, code: t.code, name: t.name })),
        },
      ],
      { session },
    );
    await moveToStage(visitId, { from: 'consultation', to: 'lab', set: { labResultsReady: false, consultedBy: actor._id } }, actor, session);
    return request;
  });
}

/** Simple allergy check: a prescribed drug whose name matches a recorded allergy (DR-07). */
export function allergyConflicts(allergies, medications) {
  const a = (allergies || []).map((x) => x.toLowerCase().trim()).filter(Boolean);
  return medications
    .filter((m) => a.some((al) => m.name.toLowerCase().includes(al) || al.includes(m.name.toLowerCase().split(/[ /]/)[0])))
    .map((m) => m.name);
}

/** FR-CON-06: prescribe → finalise note → patient moves to the pharmacy queue (transaction). */
export async function prescribe(visitId, { items, notes, acknowledgeAllergy }, actor) {
  return withTransaction(async (session) => {
    const visit = await loadServedVisit(visitId, actor, session);
    const note = await requireNote(visitId, actor, session);
    const meds = await Medication.find({ _id: { $in: items.map((i) => i.medicationId) }, isActive: true }).session(session);
    const byId = new Map(meds.map((m) => [String(m._id), m]));
    for (const it of items) if (!byId.has(String(it.medicationId))) throw badRequest('One or more medications are not in the formulary.');

    // DR-05: clinicians prescribe only from the approved list.
    if (actor.role === 'clinician') {
      const restricted = meds.filter((m) => !m.clinicianMayPrescribe).map((m) => `${m.name} ${m.strength}`);
      if (restricted.length) throw forbidden(`Clinicians may not prescribe: ${restricted.join(', ')}. Refer the patient to a doctor.`);
    }
    // DR-07: allergy warning must be explicitly acknowledged.
    const patient = await Patient.findById(visit.patientId).session(session);
    const conflicts = allergyConflicts(patient.allergies, meds);
    if (conflicts.length && !acknowledgeAllergy) {
      throw new AppError(409, 'ALLERGY_WARNING', `Allergy alert: the patient is allergic to ${patient.allergies.join(', ')}. Check: ${conflicts.join(', ')}.`, { conflicts });
    }

    const year = clinicDate().slice(0, 4);
    const seq = await nextSeq(`rxNo:${year}`, session);
    const [rx] = await Prescription.create(
      [
        {
          rxNo: `RX-${year}-${pad(seq, 5)}`,
          visitId,
          patientId: visit.patientId,
          prescriber: { userId: actor._id, name: name(actor), role: actor.role, licenseNo: actor.staffProfile?.licenseNo },
          status: 'pending',
          notes,
          items: items.map((it) => {
            const m = byId.get(String(it.medicationId));
            return { ...it, name: m.name, strength: m.strength, form: m.form, dispensedQty: 0 };
          }),
        },
      ],
      { session },
    );
    await finalize(note, session);
    await moveToStage(visitId, { from: 'consultation', to: 'pharmacy', set: { consultedBy: actor._id, labResultsReady: false } }, actor, session);
    return rx;
  });
}

/** FR-CON-07: discharge without a prescription. */
export async function complete(visitId, actor) {
  return withTransaction(async (session) => {
    await loadServedVisit(visitId, actor, session);
    const note = await requireNote(visitId, actor, session);
    await finalize(note, session);
    return moveToStage(visitId, { from: 'consultation', to: 'done', set: { consultedBy: actor._id } }, actor, session);
  });
}

/** FR-CON-08: refer to a specific doctor — the patient re-joins consultation, assigned to that doctor. */
export async function refer(visitId, { toDoctorId, reason }, actor) {
  return withTransaction(async (session) => {
    await loadServedVisit(visitId, actor, session);
    if (String(toDoctorId) === String(actor._id)) throw badRequest('You cannot refer a patient to yourself.');
    const doctor = await User.findOne({ _id: toDoctorId, role: 'doctor', isActive: true }).session(session);
    if (!doctor) throw badRequest('Choose an active doctor.');
    const note = await requireNote(visitId, actor, session);
    await finalize(note, session, { referral: { toDoctorId, toDoctorName: name(doctor), reason, at: new Date() } });
    return moveToStage(visitId, { from: 'consultation', to: 'consultation', assignedTo: doctor._id, keepQueueTime: true, set: { consultedBy: actor._id } }, actor, session);
  });
}

/** Formulary and lab test catalogue as seen by prescribers (clinician restriction shown in UI). */
export async function catalogues() {
  const [medications, labTests] = await Promise.all([
    Medication.find({ isActive: true }).sort({ name: 1, strength: 1 }),
    LabTest.find({ isActive: true }).sort({ name: 1 }),
  ]);
  return { medications, labTests };
}
