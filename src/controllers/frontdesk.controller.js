// HTTP layer for patients, doctors and appointments: validate input → call service → respond.
import * as patients from '../services/patient.service.js';
import * as doctors from '../services/doctor.service.js';
import * as appointments from '../services/appointment.service.js';
import { audit } from '../services/audit.service.js';
import { validate, PHONE, EMAIL, PASSWORD_RULE } from '../utils/validate.js';
import { clinicDate } from '../utils/dates.js';
import { APPOINTMENT_STATUSES } from '../utils/constants.js';
import { invalid } from '../utils/errors.js';

/* ---------------- patients ---------------- */
const patientRules = {
  firstName: { type: 'string', required: true, max: 60, label: 'First name' },
  lastName: { type: 'string', required: true, max: 60, label: 'Last name' },
  dateOfBirth: { type: 'dateString', required: true, label: 'Date of birth' },
  sex: { type: 'string', required: true, enum: ['female', 'male', 'other'], label: 'Sex' },
  nationalId: { type: 'string', max: 20, pattern: /^[A-Za-z0-9]{5,20}$/, patternMessage: 'National ID must be 5–20 letters or digits.', label: 'National ID' },
  phone: { type: 'string', required: true, ...PHONE, label: 'Phone' },
  email: { type: 'string', max: 120, lowercase: true, ...EMAIL, label: 'Email' },
  address: { type: 'string', max: 200, label: 'Address' },
  bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], label: 'Blood group' },
  allergies: { type: 'array', max: 20, of: { type: 'string', max: 60 }, label: 'Allergies' },
  chronicConditions: { type: 'array', max: 20, of: { type: 'string', max: 80 }, label: 'Chronic conditions' },
  emergencyContact: {
    type: 'object',
    label: 'Emergency contact',
    fields: {
      name: { type: 'string', max: 120, label: 'Name' },
      relationship: { type: 'string', max: 40, label: 'Relationship' },
      phone: { type: 'string', ...PHONE, label: 'Phone' },
    },
  },
};

function checkDob(data) {
  if (data.dateOfBirth && (data.dateOfBirth > clinicDate() || data.dateOfBirth < '1900-01-01')) {
    throw invalid({ dateOfBirth: 'Date of birth must be in the past.' });
  }
}

export async function searchPatients(req, res) {
  const { q } = validate(req.query, { q: { type: 'string', max: 60 } });
  res.json({ patients: await patients.search({ q }) });
}

export async function getPatient(req, res) {
  const patient = await patients.getById(req.params.id);
  await audit(req, 'patient.view', 'patient', patient._id, `Viewed ${patient.patientNo}`);
  res.json({ patient: patients.projectForRole(patient, req.user.role) });
}

export async function createPatient(req, res) {
  const data = validate(req.body, { ...patientRules, confirmNotDuplicate: { type: 'boolean' } });
  checkDob(data);
  const patient = await patients.create(data, req.user);
  await audit(req, 'patient.create', 'patient', patient._id, `Registered ${patient.patientNo}`);
  res.status(201).json({ patient });
}

export async function updatePatient(req, res) {
  const changes = validate(req.body, patientRules, { partial: true });
  checkDob(changes);
  const patient = await patients.update(req.params.id, changes);
  await audit(req, 'patient.update', 'patient', patient._id, `Updated ${patient.patientNo}: ${Object.keys(changes).join(', ')}`);
  res.json({ patient });
}

export async function createPortalAccount(req, res) {
  const data = validate(req.body, {
    email: { type: 'string', required: true, max: 120, lowercase: true, ...EMAIL, label: 'Email' },
    password: { ...PASSWORD_RULE, required: true, label: 'Temporary password' },
  });
  const user = await patients.createPortalAccount(req.params.id, data);
  await audit(req, 'patient.portalAccount', 'patient', req.params.id, `Created portal login ${user.email}`);
  res.status(201).json({ user });
}

/* ---------------- doctors ---------------- */
export async function listDoctors(_req, res) {
  res.json({ doctors: await doctors.listDoctors() });
}

export async function updateAvailability(req, res) {
  const data = validate(req.body, {
    slotMinutes: { type: 'int', required: true, min: 10, max: 60, label: 'Slot length' },
    availability: {
      type: 'array',
      required: true,
      max: 21,
      label: 'Availability',
      of: {
        type: 'object',
        fields: {
          dayOfWeek: { type: 'int', required: true, min: 0, max: 6, label: 'Day' },
          start: { type: 'time', required: true, label: 'Start' },
          end: { type: 'time', required: true, label: 'End' },
        },
      },
    },
    unavailableDates: { type: 'array', max: 60, of: { type: 'dateString' }, label: 'Unavailable dates', default: [] },
  });
  const doctor = await doctors.updateAvailability(req.params.id, data);
  await audit(req, 'doctor.availability', 'user', doctor._id, `Updated availability of Dr. ${doctor.lastName}`);
  res.json({ doctor });
}

export async function slots(req, res) {
  const { date } = validate(req.query, { date: { type: 'dateString', required: true, label: 'Date' } });
  res.json(await doctors.availableSlots(req.params.id, date));
}

/* ---------------- appointments ---------------- */
export async function listAppointments(req, res) {
  const f = validate(req.query, {
    date: { type: 'dateString' },
    from: { type: 'dateString' },
    to: { type: 'dateString' },
    doctorId: { type: 'objectId' },
    patientId: { type: 'objectId' },
    status: { type: 'string', enum: APPOINTMENT_STATUSES },
    q: { type: 'string', max: 60 },
  });
  res.json({ appointments: await appointments.list(f, req.user) });
}

export async function getAppointment(req, res) {
  res.json({ appointment: await appointments.getById(req.params.id, req.user) });
}

export async function bookAppointment(req, res) {
  const data = validate(req.body, {
    patientId: { type: 'objectId', required: req.user.role !== 'patient', label: 'Patient' },
    doctorId: { type: 'objectId', required: true, label: 'Doctor' },
    date: { type: 'dateString', required: true, label: 'Date' },
    time: { type: 'time', required: true, label: 'Time' },
    reason: { type: 'string', max: 300, label: 'Reason' },
  });
  const appt = await appointments.book(data, req.user);
  await audit(req, 'appointment.book', 'appointment', appt._id, `Booked ${appt.appointmentNo}`);
  res.status(201).json({ appointment: appt });
}

export async function cancelAppointment(req, res) {
  const { reason } = validate(req.body, { reason: { type: 'string', required: true, max: 300, label: 'Reason' } });
  const appt = await appointments.cancel(req.params.id, req.user, reason);
  await audit(req, 'appointment.cancel', 'appointment', appt._id, `Cancelled ${appt.appointmentNo}: ${reason}`);
  res.json({ appointment: appt });
}

export async function noShow(req, res) {
  const appt = await appointments.markNoShow(req.params.id, req.user);
  await audit(req, 'appointment.noShow', 'appointment', appt._id, `No-show ${appt.appointmentNo}`);
  res.json({ appointment: appt });
}

export async function bulkNoShow(req, res) {
  const count = await appointments.bulkNoShow(req.user);
  await audit(req, 'appointment.bulkNoShow', 'appointment', null, `Marked ${count} appointments as no-show`);
  res.json({ count });
}
