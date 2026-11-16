import * as users from '../services/user.service.js';
import { audit } from '../services/audit.service.js';
import { validate, PASSWORD_RULE, PHONE, EMAIL } from '../utils/validate.js';
import { STAFF_ROLES } from '../utils/constants.js';

const staffProfileRule = {
  type: 'object',
  label: 'Staff profile',
  fields: {
    staffNo: { type: 'string', max: 20, label: 'Staff number' },
    department: { type: 'string', max: 60, label: 'Department' },
    specialization: { type: 'string', max: 60, label: 'Specialisation' },
    licenseNo: { type: 'string', max: 30, label: 'Licence number' },
    room: { type: 'string', max: 20, label: 'Room' },
  },
};

const staffFields = {
  firstName: { type: 'string', required: true, max: 60, label: 'First name' },
  lastName: { type: 'string', required: true, max: 60, label: 'Last name' },
  email: { type: 'string', required: true, max: 120, lowercase: true, ...EMAIL, label: 'Email' },
  phone: { type: 'string', max: 20, ...PHONE, label: 'Phone' },
  role: { type: 'string', required: true, enum: STAFF_ROLES, label: 'Role' },
  staffProfile: staffProfileRule,
};

export async function list(req, res) {
  const q = validate(req.query, {
    q: { type: 'string', max: 60 },
    role: { type: 'string', enum: STAFF_ROLES },
    status: { type: 'string', enum: ['active', 'inactive', 'all'] },
  });
  res.json({ users: await users.listStaff(q) });
}

export async function create(req, res) {
  const data = validate(req.body, { ...staffFields, password: { ...PASSWORD_RULE, required: true, label: 'Temporary password' } });
  const user = await users.createStaff(data);
  await audit(req, 'user.create', 'user', user._id, `Created ${user.role} account ${user.email}`);
  res.status(201).json({ user });
}

export async function update(req, res) {
  const changes = validate(req.body, { ...staffFields, isActive: { type: 'boolean', label: 'Active' } }, { partial: true });
  const user = await users.updateStaff(req.user, req.params.id, changes);
  await audit(req, 'user.update', 'user', user._id, `Updated account ${user.email}`);
  res.json({ user });
}

export async function resetPassword(req, res) {
  const { password } = validate(req.body, { password: { ...PASSWORD_RULE, required: true, label: 'Temporary password' } });
  const user = await users.resetPassword(req.params.id, password);
  await audit(req, 'user.resetPassword', 'user', user._id, `Reset password for ${user.email}`);
  res.json({ ok: true });
}

export async function directory(req, res) {
  const q = validate(req.query, { role: { type: 'string', enum: STAFF_ROLES } });
  res.json({ users: await users.directory(q) });
}
