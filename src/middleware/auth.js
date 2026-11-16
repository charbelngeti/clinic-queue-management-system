import jwt from 'jsonwebtoken';
import { config, isProduction } from '../config/env.js';
import { User } from '../models/index.js';
import { can } from '../services/rbac.js';
import { forbidden, unauthorized, AppError } from '../utils/errors.js';

export const COOKIE_NAME = 'cq_session';

export function issueSessionCookie(res, user) {
  const token = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: `${config.jwtExpiresHours}h`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // not readable from JavaScript → protects against token theft via XSS
    sameSite: 'strict', // not sent on cross-site requests → CSRF protection
    secure: isProduction,
    maxAge: config.jwtExpiresHours * 3600 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Verifies the session cookie and loads the (still active) user into req.user. */
export async function authenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized('Your account is not active.');
  req.user = user;

  // A user with a temporary password may only change it (FR-PAT-06).
  const allowed = ['/api/auth/me', '/api/auth/password', '/api/auth/logout'];
  if (user.mustChangePassword && !allowed.includes(req.originalUrl.split('?')[0])) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please change your temporary password first.');
  }
  next();
}

/** Route guard: the user's role must hold at least one of the given permissions (server-side RBAC). */
export function authorize(...permissions) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!permissions.some((p) => can(req.user.role, p))) throw forbidden();
    next();
  };
}
