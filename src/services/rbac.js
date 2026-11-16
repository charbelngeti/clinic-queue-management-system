// Role-based access control: the single source of truth for "who may do what" (FR-AUTH-03, BLUEPRINT §3.2).
// Routes declare the permission they need; the authorize() middleware checks it here.
import { ROLES as R } from '../utils/constants.js';

const CLINICAL = [R.DOCTOR, R.CLINICIAN];
const ALL_STAFF = [R.ADMIN, R.RECEPTIONIST, R.DOCTOR, R.CLINICIAN, R.NURSE, R.LAB_TECH, R.PHARMACIST];

export const PERMISSIONS = {
  // accounts
  'users:manage': [R.ADMIN],
  'users:directory': ALL_STAFF, // see staff names (e.g. to message or refer)
  'patientAccounts:create': [R.RECEPTIONIST],

  // patients
  'patients:read': [R.ADMIN, R.RECEPTIONIST, R.NURSE, ...CLINICAL],
  'patients:write': [R.RECEPTIONIST],
  'patients:clinicalSummary': [R.NURSE, ...CLINICAL],

  // doctors & availability
  'doctors:read': [...ALL_STAFF, R.PATIENT],
  'availability:manage': [R.ADMIN],

  // appointments
  'appointments:read': [R.ADMIN, R.RECEPTIONIST, R.NURSE, ...CLINICAL],
  'appointments:write': [R.RECEPTIONIST],
  'appointments:own': [R.PATIENT],

  // visits / queues
  'queue:monitor': [R.ADMIN, R.RECEPTIONIST],
  'visits:checkin': [R.RECEPTIONIST],
  'visits:cancel': [R.RECEPTIONIST],
  'queue:serve:triage': [R.NURSE],
  'queue:serve:consultation': CLINICAL,
  'queue:serve:lab': [R.LAB_TECH],
  'queue:serve:pharmacy': [R.PHARMACIST],

  // clinical
  'triage:write': [R.NURSE],
  'consultations:write': CLINICAL,
  'labRequests:create': CLINICAL,
  'labRequests:process': [R.LAB_TECH],
  'labRequests:read': [R.LAB_TECH, ...CLINICAL],
  'prescriptions:create': CLINICAL,
  'prescriptions:dispense': [R.PHARMACIST],
  'prescriptions:read': [R.PHARMACIST, ...CLINICAL],

  // catalogues
  'labTests:read': [R.ADMIN, R.LAB_TECH, ...CLINICAL],
  'labTests:manage': [R.ADMIN],
  'medications:read': [R.ADMIN, R.PHARMACIST, ...CLINICAL],
  'medications:manage': [R.ADMIN], // formulary (names, strengths, clinician flag)
  'medications:stock': [R.PHARMACIST], // receive stock

  // messaging
  'messages:use': [...ALL_STAFF.filter((r) => r !== R.ADMIN), R.PATIENT],

  // insight
  'reports:read': [R.ADMIN],
  'audit:read': [R.ADMIN],
};

export function can(role, permission) {
  const roles = PERMISSIONS[permission];
  if (!roles) throw new Error(`Unknown permission "${permission}"`);
  return roles.includes(role);
}
