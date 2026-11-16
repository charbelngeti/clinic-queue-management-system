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

  // administration
  { path: '/admin/users', title: 'Staff accounts', roles: ['admin'], load: () => import('./pages/admin-users.js') },
  { path: '/admin/doctors', title: 'Doctor schedules', roles: ['admin'], load: () => import('./pages/admin-doctors.js') },
];

/** Landing page per role. */
export const HOME = {
  admin: '/dashboard',
  receptionist: '/dashboard',
  nurse: '/triage',
  doctor: '/appointments',
  clinician: '/account/password',
  lab_tech: '/account/password',
  pharmacist: '/account/password',
  patient: '/account/password',
};

// Sidebar sections per role: [sectionTitle, [[path, label, icon]]]
export const NAV = {
  admin: [
    ['Overview', [['/dashboard', 'Dashboard', 'home'], ['/queue', 'Queue board', 'queue']]],
    ['Records (read-only)', [['/patients', 'Patients', 'users'], ['/appointments', 'Appointments', 'calendar']]],
    ['Administration', [['/admin/users', 'Staff accounts', 'shield'], ['/admin/doctors', 'Doctor schedules', 'clock']]],
  ],
  receptionist: [
    ['Front desk', [['/dashboard', 'Dashboard', 'home'], ['/queue', 'Queue board', 'queue'], ['/appointments', 'Appointments', 'calendar'], ['/patients', 'Patients', 'users']]],
  ],
  nurse: [['Nursing', [['/triage', 'Triage queue', 'heart']]]],
  doctor: [['Clinic', [['/appointments', 'My appointments', 'calendar']]]],
  clinician: [],
  lab_tech: [],
  pharmacist: [],
  patient: [],
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
