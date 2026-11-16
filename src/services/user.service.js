import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { STAFF_ROLES, ROLES } from '../utils/constants.js';
import { AppError, badRequest, notFound, unauthorized } from '../utils/errors.js';
import { escapeRegex } from '../utils/validate.js';

const BCRYPT_COST = 10; // NFR-SEC-01

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

export async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  // Same message whether the email or the password is wrong, so attackers can't discover valid emails.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('Incorrect email or password.');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Contact the administrator.');
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
  }
  if (currentPassword === newPassword) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a password different from the current one.', {
      newPassword: 'Must be different from the current password.',
    });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  return user;
}

export async function listStaff({ q, role, status }) {
  const filter = { role: { $in: STAFF_ROLES } };
  if (role) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { 'staffProfile.staffNo': re }];
  }
  return User.find(filter).sort({ role: 1, lastName: 1 }).limit(500);
}

export async function createStaff(data) {
  if (!STAFF_ROLES.includes(data.role)) throw badRequest('Staff role is invalid.');
  const { password, ...rest } = data;
  return User.create({ ...rest, passwordHash: await hashPassword(password), mustChangePassword: true });
}

export async function updateStaff(actor, id, changes) {
  const user = await User.findById(id);
  if (!user || user.role === ROLES.PATIENT) throw notFound('Staff member');
  if (String(user._id) === String(actor._id) && (changes.isActive === false || (changes.role && changes.role !== user.role))) {
    throw badRequest('You cannot deactivate your own account or change your own role.');
  }
  if (changes.role && !STAFF_ROLES.includes(changes.role)) throw badRequest('Staff role is invalid.');
  const { staffProfile, ...rest } = changes;
  Object.assign(user, rest);
  if (staffProfile) {
    const current = user.staffProfile ? user.staffProfile.toObject() : {};
    user.staffProfile = { ...current, ...staffProfile };
  }
  await user.save();
  return user;
}

export async function resetPassword(id, newPassword) {
  const user = await User.findById(id);
  if (!user) throw notFound('User');
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = true;
  await user.save();
  return user;
}

/** Lightweight staff list (names, roles) visible to all staff — e.g. to pick a doctor for referral. */
export async function directory({ role }) {
  const filter = { isActive: true, role: role ? role : { $in: STAFF_ROLES } };
  return User.find(filter)
    .select('firstName lastName role staffProfile.specialization staffProfile.room')
    .sort({ lastName: 1 });
}
