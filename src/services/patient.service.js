import { Patient, User } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { nextSeq, pad } from '../utils/counters.js';
import { clinicDate } from '../utils/dates.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { escapeRegex } from '../utils/validate.js';
import { hashPassword } from './user.service.js';

/** FR-PAT-03: search by patient no., phone, national ID or name. */
export async function search({ q, limit = 25 }) {
  if (!q) return Patient.find().sort({ createdAt: -1 }).limit(limit);
  const term = q.trim();
  const re = new RegExp(`^${escapeRegex(term)}`, 'i');
  const words = term.split(/\s+/).filter(Boolean).map((w) => new RegExp(`^${escapeRegex(w)}`, 'i'));
  const or = [{ patientNo: re }, { phone: new RegExp(escapeRegex(term.replace(/\s/g, ''))) }, { nationalId: re }, { firstName: re }, { lastName: re }];
  if (words.length >= 2) or.push({ firstName: words[0], lastName: words[1] }, { firstName: words[1], lastName: words[0] });
  return Patient.find({ $or: or }).sort({ lastName: 1, firstName: 1 }).limit(limit);
}

export async function getById(id) {
  const p = await Patient.findById(id);
  if (!p) throw notFound('Patient');
  return p;
}

/** FR-PAT-02: likely duplicates = same name + date of birth, or same phone, or same national ID. */
export async function findPossibleDuplicates({ firstName, lastName, dateOfBirth, phone, nationalId }, excludeId) {
  const or = [];
  if (firstName && lastName && dateOfBirth) {
    or.push({
      firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(lastName)}$`, 'i'),
      dateOfBirth: new Date(dateOfBirth),
    });
  }
  if (phone) or.push({ phone });
  if (nationalId) or.push({ nationalId });
  if (!or.length) return [];
  const filter = { $or: or };
  if (excludeId) filter._id = { $ne: excludeId };
  return Patient.find(filter).limit(5).select('patientNo firstName lastName dateOfBirth phone nationalId');
}

export async function create(data, actor) {
  if (!data.confirmNotDuplicate) {
    const dupes = await findPossibleDuplicates(data);
    if (dupes.length) {
      throw conflict('This patient may already be registered. Check the matches below.', { code: 'POSSIBLE_DUPLICATE', matches: dupes });
    }
  }
  const { confirmNotDuplicate, ...fields } = data; // eslint-disable-line no-unused-vars
  const year = clinicDate().slice(0, 4);
  const seq = await nextSeq(`patientNo:${year}`);
  return Patient.create({ ...fields, patientNo: `P-${year}-${pad(seq, 5)}`, createdBy: actor._id });
}

export async function update(id, changes) {
  const patient = await getById(id);
  for (const [k, v] of Object.entries(changes)) patient.set(k, v === null ? undefined : v);
  await patient.save();
  return patient;
}

/** FR-PAT-06: reception creates a portal login for a registered patient (transaction: user + link). */
export async function createPortalAccount(patientId, { email, password }) {
  return withTransaction(async (session) => {
    const patient = await Patient.findById(patientId).session(session);
    if (!patient) throw notFound('Patient');
    if (patient.userId) throw badRequest('This patient already has a portal account.');
    const [user] = await User.create(
      [
        {
          role: 'patient',
          email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          passwordHash: await hashPassword(password),
          mustChangePassword: true,
          patientId: patient._id,
        },
      ],
      { session },
    );
    patient.userId = user._id;
    await patient.save({ session });
    return user;
  });
}

/** Fields a role may see. Lab and pharmacy only get identifiers, age/sex and allergies (NFR-PRI-01). */
export function projectForRole(patient, role) {
  if (!patient) return patient;
  const p = typeof patient.toJSON === 'function' ? patient.toJSON() : patient;
  if (role === 'lab_tech' || role === 'pharmacist') {
    const { _id, patientNo, firstName, lastName, dateOfBirth, sex, allergies } = p;
    return { _id, patientNo, firstName, lastName, dateOfBirth, sex, allergies };
  }
  return p;
}
