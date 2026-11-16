import * as messaging from '../services/messaging.service.js';
import * as reports from '../services/report.service.js';
import { validate } from '../utils/validate.js';
import { clinicDate, addDays } from '../utils/dates.js';
import { badRequest } from '../utils/errors.js';

/* ---------------- messaging ---------------- */
export async function listConversations(req, res) {
  res.json({ conversations: await messaging.list(req.user) });
}
export async function unread(req, res) {
  res.json({ unread: await messaging.unreadCount(req.user) });
}
export async function recipients(_req, res) {
  res.json({ recipients: await messaging.recipients() });
}
export async function startConversation(req, res) {
  const data = validate(req.body, {
    toUserId: { type: 'objectId', label: 'Recipient' },
    subject: { type: 'string', required: true, max: 120, label: 'Subject' },
    body: { type: 'string', required: true, max: 2000, label: 'Message' },
    patientId: { type: 'objectId', label: 'Patient' },
  });
  res.status(201).json({ conversation: await messaging.start(req.user, data) });
}
export async function getThread(req, res) {
  res.json(await messaging.thread(req.params.id, req.user));
}
export async function replyThread(req, res) {
  const { body } = validate(req.body, { body: { type: 'string', required: true, max: 2000, label: 'Message' } });
  res.status(201).json({ message: await messaging.reply(req.params.id, req.user, body) });
}

/* ---------------- reports ---------------- */
export async function summary(req, res) {
  const today = clinicDate();
  const q = validate(req.query, { from: { type: 'dateString', default: addDays(today, -6) }, to: { type: 'dateString', default: today } });
  if (q.from > q.to) throw badRequest('“From” must be before “to”.');
  res.json(await reports.summary(q.from, q.to));
}
export async function stageStats(req, res) {
  const { stage } = validate(req.params, { stage: { type: 'string', required: true, enum: ['triage', 'consultation', 'lab', 'pharmacy'] } });
  res.json(await reports.stageStats(stage, req.user));
}
export async function audit(req, res) {
  const q = validate(req.query, {
    q: { type: 'string', max: 60 },
    action: { type: 'string', max: 40 },
    from: { type: 'dateString' },
    to: { type: 'dateString' },
  });
  res.json({ entries: await reports.auditLog(q) });
}
