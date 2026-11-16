// Pharmacy (FR-PHA-01..06): review prescriptions, dispense with stock control, basic inventory.
import { Visit, Prescription, Medication, Patient } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { clinicDayRange, clinicDate } from '../utils/dates.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { moveToStage } from './queue.service.js';
import { projectForRole } from './patient.service.js';
import { allergyConflicts } from './consultation.service.js';

export async function forVisit(visitId, actor) {
  const visit = await Visit.findById(visitId).select('-triage');
  if (!visit) throw notFound('Visit');
  const [prescription, patient] = await Promise.all([Prescription.findOne({ visitId }), Patient.findById(visit.patientId)]);
  if (!prescription) return { visit, patient: projectForRole(patient, actor.role), prescription: null, stock: {} };
  const meds = await Medication.find({ _id: { $in: prescription.items.map((i) => i.medicationId) } }).select('stockQty unit reorderLevel');
  const stock = Object.fromEntries(meds.map((m) => [String(m._id), { stockQty: m.stockQty, unit: m.unit }]));
  const conflicts = allergyConflicts(patient.allergies, prescription.items);
  return { visit, patient: projectForRole(patient, actor.role), prescription, stock, allergyConflicts: conflicts };
}

/**
 * FR-PHA-03/04 — the backup code snippet. All-or-nothing transaction:
 *   1. for each item, decrement stock only if enough is available (conditional update),
 *   2. record the dispensed quantity on the prescription,
 *   3. complete the visit.
 * If any step fails (e.g. insufficient stock) nothing is saved.
 */
export async function dispense(prescriptionId, lines, actor) {
  return withTransaction(async (session) => {
    const rx = await Prescription.findById(prescriptionId).session(session);
    if (!rx) throw notFound('Prescription');
    if (!['pending', 'partially_dispensed'].includes(rx.status)) throw conflict(`This prescription is already ${rx.status.replace('_', ' ')}.`);
    const visit = await Visit.findById(rx.visitId).session(session);
    if (!visit?.isActive || visit.stage !== 'pharmacy') throw conflict('This patient is not at the pharmacy.');
    if (String(visit.calledBy) !== String(actor._id)) throw forbidden('Call this patient from the pharmacy queue first.');

    const qty = new Map(lines.map((l) => [String(l.itemId), l.quantity]));
    let any = false;
    for (const item of rx.items) {
      const q = qty.get(String(item._id)) || 0;
      if (!q) continue;
      const remaining = item.quantity - item.dispensedQty;
      if (q > remaining) throw badRequest(`Cannot dispense ${q} of ${item.name}: only ${remaining} remain on the prescription.`);
      // Conditional decrement: only succeeds if stock >= q, so stock can never go negative (also enforced by $jsonSchema).
      const med = await Medication.findOneAndUpdate(
        { _id: item.medicationId, stockQty: { $gte: q } },
        { $inc: { stockQty: -q } },
        { returnDocument: 'after', session },
      );
      if (!med) {
        const current = await Medication.findById(item.medicationId).session(session);
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${item.name} ${item.strength}: ${current?.stockQty ?? 0} available, ${q} requested.`);
      }
      item.dispensedQty += q;
      any = true;
    }
    if (!any) throw badRequest('Enter a quantity to dispense for at least one item.');

    const complete = rx.items.every((i) => i.dispensedQty >= i.quantity);
    Object.assign(rx, {
      status: complete ? 'dispensed' : 'partially_dispensed',
      dispensedBy: actor._id,
      dispensedByName: `${actor.firstName} ${actor.lastName}`,
      dispensedAt: new Date(),
    });
    await rx.save({ session });
    // The patient leaves the pharmacy either way; anything not dispensed is recorded on the prescription.
    await moveToStage(visit._id, { from: 'pharmacy', to: 'done' }, actor, session);
    return rx;
  });
}

export async function listPrescriptions({ status, date }) {
  const filter = {};
  if (status) filter.status = status;
  const { start, end } = clinicDayRange(date || clinicDate());
  filter.createdAt = { $gte: start, $lt: end };
  return Prescription.find(filter).sort({ createdAt: -1 }).limit(200).populate('patientId', 'patientNo firstName lastName');
}

/* ---------------- inventory / formulary ---------------- */
export const listMedications = ({ all } = {}) => Medication.find(all ? {} : { isActive: true }).sort({ name: 1, strength: 1 });

export async function receiveStock(id, quantity) {
  const med = await Medication.findOneAndUpdate({ _id: id }, { $inc: { stockQty: quantity } }, { returnDocument: 'after' });
  if (!med) throw notFound('Medication');
  return med;
}

export const createMedication = (data) => Medication.create(data);

export async function updateMedication(id, data) {
  const med = await Medication.findById(id);
  if (!med) throw notFound('Medication');
  Object.assign(med, data);
  await med.save();
  return med;
}
