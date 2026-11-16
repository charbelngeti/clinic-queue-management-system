import { html } from './html.js';

let TZ = 'Africa/Nairobi';
export const setClinicTimeZone = (tz) => (TZ = tz || TZ);
export const clinicTz = () => TZ;

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts });

export const fmtDate = (d) => (d ? fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—');
export const fmtTime = (d) => (d ? fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—');
export const fmtWeekday = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));

/** Clinic-local YYYY-MM-DD for a date (default: now). */
export function clinicToday(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** "5 min", "1 h 20 min" since a timestamp. */
export function since(d, now = Date.now()) {
  if (!d) return '—';
  const min = Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function age(dob) {
  if (!dob) return '';
  const b = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export const fullName = (p) => (p ? `${p.firstName} ${p.lastName}` : '—');
export const initials = (p) => (p ? `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase() : '?');
export const sexShort = (s) => ({ female: 'F', male: 'M', other: 'O' })[s] || '';

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

const STATUS_BADGES = {
  // appointments
  scheduled: ['badge-blue', 'Scheduled'],
  checked_in: ['badge-violet', 'Checked in'],
  completed: ['badge-green', 'Completed'],
  cancelled: ['badge-slate', 'Cancelled'],
  no_show: ['badge-amber', 'No-show'],
  // queue
  waiting: ['badge-amber', 'Waiting'],
  called: ['badge-blue', 'Called'],
  in_service: ['badge-violet', 'In service'],
  skipped: ['badge-red', 'Skipped'],
  // lab
  requested: ['badge-amber', 'Requested'],
  sample_collected: ['badge-blue', 'Sample collected'],
  in_progress: ['badge-violet', 'In progress'],
  // prescriptions
  pending: ['badge-amber', 'Pending'],
  partially_dispensed: ['badge-blue', 'Partially dispensed'],
  dispensed: ['badge-green', 'Dispensed'],
  // generic
  active: ['badge-green', 'Active'],
  inactive: ['badge-slate', 'Inactive'],
  draft: ['badge-slate', 'Draft'],
  final: ['badge-green', 'Final'],
};
export function statusBadge(status) {
  const [cls, label] = STATUS_BADGES[status] || ['badge-slate', status];
  return html`<span class="badge ${cls}">${label}</span>`;
}

const STAGE_LABELS = { triage: 'Triage', consultation: 'Consultation', lab: 'Laboratory', pharmacy: 'Pharmacy', done: 'Done' };
export const stageLabel = (s) => STAGE_LABELS[s] || s;

const PRIORITY_BADGES = {
  emergency: ['badge-red', 'Emergency'],
  urgent: ['badge-amber', 'Urgent'],
  normal: ['badge-slate', 'Normal'],
};
export function priorityBadge(p) {
  const [cls, label] = PRIORITY_BADGES[p] || PRIORITY_BADGES.normal;
  return html`<span class="badge ${cls}">${label}</span>`;
}
