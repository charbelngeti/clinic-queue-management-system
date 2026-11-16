// Route table + role-specific navigation (FR-AUTH-04). The server enforces permissions on every API call;
// these lists only decide what each role sees in the interface.
const STAFF = ['admin', 'receptionist', 'doctor', 'clinician', 'nurse', 'lab_tech', 'pharmacist'];
const ALL = [...STAFF, 'patient'];

export const ROUTES = [
  { path: '/dashboard', title: 'Dashboard', roles: ['admin', 'receptionist'], load: () => import('./pages/dash-reception.js') },
  { path: '/account/password', title: 'Change password', roles: ALL, load: () => import('./pages/account-password.js') },

  // front desk
  { path: '/patients', title: 'Patients', roles: ['admin', 'receptionist'], load: () => import('./pages/patients.js') },
  { path: '/patients/:id', title: 'Patient record', roles: ['admin', 'receptionist'], load: () => import('./pages/patient-profile.js') },
  { path: '/appointments', title: 'Appointments', roles: ['admin', 'receptionist', 'doctor'], load: () => import('./pages/appointments.js') },
  { path: '/queue', title: 'Queue board', roles: ['admin', 'receptionist'], load: () => import('./pages/queue-board.js') },

  // nursing
  { path: '/triage', title: 'Triage', roles: ['nurse'], load: () => import('./pages/triage.js') },

  // clinical departments
  { path: '/consultations', title: 'Consultations', roles: ['doctor', 'clinician'], load: () => import('./pages/consultation.js') },
  { path: '/lab', title: 'Laboratory', roles: ['lab_tech'], load: () => import('./pages/lab.js') },
  { path: '/lab/records', title: 'Lab requests', roles: ['lab_tech'], load: () => import('./pages/records.js') },
  { path: '/pharmacy', title: 'Pharmacy', roles: ['pharmacist'], load: () => import('./pages/pharmacy.js') },
  { path: '/pharmacy/records', title: 'Prescriptions', roles: ['pharmacist'], load: () => import('./pages/records.js') },
  { path: '/medications', title: 'Medications & stock', roles: ['pharmacist', 'admin'], load: () => import('./pages/medications.js') },

  // portal, messaging & insight
  { path: '/portal', title: 'My care', roles: ['patient'], load: () => import('./pages/portal.js') },
  { path: '/messages', title: 'Messages', roles: STAFF.filter((x) => x !== 'admin').concat('patient'), load: () => import('./pages/messages.js') },
  { path: '/admin/reports', title: 'Reports', roles: ['admin'], load: () => import('./pages/reports.js') },
  { path: '/admin/audit', title: 'Activity log', roles: ['admin'], load: () => import('./pages/audit.js') },

  // administration
  { path: '/admin/users', title: 'Staff accounts', roles: ['admin'], load: () => import('./pages/admin-users.js') },
  { path: '/admin/doctors', title: 'Doctor schedules', roles: ['admin'], load: () => import('./pages/admin-doctors.js') },
];

/** Landing page per role. */
export const HOME = {
  admin: '/dashboard',
  receptionist: '/dashboard',
  nurse: '/triage',
  doctor: '/consultations',
  clinician: '/consultations',
  lab_tech: '/lab',
  pharmacist: '/pharmacy',
  patient: '/portal',
};

// Sidebar sections per role: [sectionTitle, [[path, label, icon]]]
export const NAV = {
  admin: [
    ['Overview', [['/dashboard', 'Dashboard', 'home'], ['/queue', 'Queue board', 'queue'], ['/admin/reports', 'Reports', 'chart']]],
    ['Records (read-only)', [['/patients', 'Patients', 'users'], ['/appointments', 'Appointments', 'calendar']]],
    ['Administration', [['/admin/users', 'Staff accounts', 'shield'], ['/admin/doctors', 'Doctor schedules', 'clock'], ['/medications', 'Medication formulary', 'pill'], ['/admin/audit', 'Activity log', 'file']]],
  ],
  receptionist: [
    ['Front desk', [['/dashboard', 'Dashboard', 'home'], ['/queue', 'Queue board', 'queue'], ['/appointments', 'Appointments', 'calendar'], ['/patients', 'Patients', 'users'], ['/messages', 'Messages', 'message']]],
  ],
  nurse: [['Nursing', [['/triage', 'Triage queue', 'heart'], ['/messages', 'Messages', 'message']]]],
  doctor: [['Clinic', [['/consultations', 'Consultations', 'stethoscope'], ['/appointments', 'My appointments', 'calendar'], ['/messages', 'Messages', 'message']]]],
  clinician: [['Clinic', [['/consultations', 'Consultations', 'stethoscope'], ['/messages', 'Messages', 'message']]]],
  lab_tech: [['Laboratory', [['/lab', 'Lab queue', 'flask'], ['/lab/records', 'Lab requests', 'file'], ['/messages', 'Messages', 'message']]]],
  pharmacist: [['Pharmacy', [['/pharmacy', 'Dispensing queue', 'pill'], ['/pharmacy/records', 'Prescriptions', 'file'], ['/medications', 'Medications & stock', 'package'], ['/messages', 'Messages', 'message']]]],
  patient: [['My care', [['/portal', 'Home', 'home'], ['/messages', 'Messages', 'message']]]],
};

/** Match "#/patients/abc123" against "/patients/:id" style paths (most specific first). */
export function matchRoute(hashPath) {
  for (const route of ROUTES) {
    const keys = [];
    const re = new RegExp(
      `^${route.path.replace(/:([a-zA-Z]+)/g, (_m, k) => {
        keys.push(k);
        return '([^/]+)';
      })}$`,
    );
    const m = hashPath.match(re);
    if (m) return { route, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
