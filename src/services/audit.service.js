import { AuditLog } from '../models/index.js';

/** Record who did what to which record (FR-AUD-01). Never throws: auditing must not break the main action. */
export async function audit(req, action, entity, entityId, summary, session) {
  try {
    const u = req.user;
    await AuditLog.create(
      [
        {
          userId: u?._id,
          userName: u ? `${u.firstName} ${u.lastName}` : undefined,
          role: u?.role,
          action,
          entity,
          entityId,
          summary,
          ip: req.ip,
        },
      ],
      { session },
    );
  } catch (err) {
    console.error('[audit] failed to write audit log', err.message);
  }
}
