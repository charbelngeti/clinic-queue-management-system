import { issueSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import * as users from '../services/user.service.js';
import { validate, PASSWORD_RULE } from '../utils/validate.js';
import { config } from '../config/env.js';

export async function login(req, res) {
  const { email, password } = validate(req.body, {
    email: { type: 'string', required: true, max: 120, label: 'Email' },
    password: { type: 'string', required: true, max: 72, label: 'Password' },
  });
  const user = await users.login(email, password);
  issueSessionCookie(res, user);
  res.json({ user });
}

export function logout(_req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user, clinic: { timeZone: config.clinicTz } });
}

export async function changePassword(req, res) {
  const body = validate(req.body, {
    currentPassword: { type: 'string', required: true, max: 72, label: 'Current password' },
    newPassword: { ...PASSWORD_RULE, required: true, label: 'New password' },
  });
  const user = await users.changePassword(req.user._id, body.currentPassword, body.newPassword);
  issueSessionCookie(res, user);
  res.json({ user });
}
