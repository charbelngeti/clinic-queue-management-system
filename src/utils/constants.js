export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
  DOCTOR: 'doctor',
  CLINICIAN: 'clinician',
  NURSE: 'nurse',
  LAB_TECH: 'lab_tech',
  PHARMACIST: 'pharmacist',
  PATIENT: 'patient',
});
export const ALL_ROLES = Object.values(ROLES);
export const STAFF_ROLES = ALL_ROLES.filter((r) => r !== ROLES.PATIENT);
export const PRESCRIBER_ROLES = [ROLES.DOCTOR, ROLES.CLINICIAN];

export const ROLE_LABELS = {
  admin: 'Administrator',
  receptionist: 'Receptionist',
  doctor: 'Doctor',
  clinician: 'Clinician',
  nurse: 'Nurse',
  lab_tech: 'Lab Technician',
  pharmacist: 'Pharmacist',
  patient: 'Patient',
};

export const APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'];
export const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'checked_in'];

export const STAGES = ['triage', 'consultation', 'lab', 'pharmacy', 'done'];
export const QUEUE_STATUSES = ['waiting', 'called', 'in_service', 'skipped', 'completed', 'cancelled'];
export const PRIORITIES = { emergency: 0, urgent: 1, normal: 2 };

export const LAB_STATUSES = ['requested', 'sample_collected', 'in_progress', 'completed', 'cancelled'];
export const RX_STATUSES = ['pending', 'partially_dispensed', 'dispensed', 'cancelled'];

/** Which role serves each queue stage. */
export const STAGE_ROLES = {
  triage: [ROLES.NURSE],
  consultation: [ROLES.DOCTOR, ROLES.CLINICIAN],
  lab: [ROLES.LAB_TECH],
  pharmacy: [ROLES.PHARMACIST],
};
