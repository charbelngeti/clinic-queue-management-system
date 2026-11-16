// Reports & dashboard statistics (FR-RPT-01/02, FR-AUD-02) — MongoDB aggregation pipelines.
import { Visit, Appointment, LabRequest, Prescription, AuditLog } from '../models/index.js';
import { clinicDayRange, clinicDate, addDays } from '../utils/dates.js';
import { STAGE_ROLES } from '../utils/constants.js';
import { forbidden } from '../utils/errors.js';
import { escapeRegex } from '../utils/validate.js';

const avgMinutes = (from, to) => ({ $avg: { $divide: [{ $subtract: [to, from] }, 60000] } });
const round = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** Operational report for a date range (inclusive, clinic-local dates). */
export async function summary(from, to) {
  const start = clinicDayRange(from).start;
  const end = clinicDayRange(to).end;
  const range = { $gte: start, $lt: end };

  const [visitStatus, visitTypes, stageTimes, apptStatus, labStats, rxStatus, topMeds, daily] = await Promise.all([
    Visit.aggregate([{ $match: { createdAt: range } }, { $group: { _id: '$queueStatus', n: { $sum: 1 } } }]),
    Visit.aggregate([{ $match: { createdAt: range } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    // Average waiting time (entered → called) and service time (called → left) per department.
    Visit.aggregate([
      { $match: { createdAt: range } },
      { $unwind: '$stageHistory' },
      { $match: { 'stageHistory.calledAt': { $ne: null } } },
      {
        $group: {
          _id: '$stageHistory.stage',
          avgWait: avgMinutes('$stageHistory.enteredAt', '$stageHistory.calledAt'),
          avgService: { $avg: { $cond: [{ $ifNull: ['$stageHistory.leftAt', false] }, { $divide: [{ $subtract: ['$stageHistory.leftAt', '$stageHistory.calledAt'] }, 60000] }, null] } },
          served: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate([{ $match: { startAt: range } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    LabRequest.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, avgTurnaround: avgMinutes('$createdAt', '$completedAt') } },
    ]),
    Prescription.aggregate([{ $match: { createdAt: range } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Prescription.aggregate([
      { $match: { createdAt: range } },
      { $unwind: '$items' },
      { $match: { 'items.dispensedQty': { $gt: 0 } } },
      { $group: { _id: { $concat: ['$items.name', ' ', '$items.strength'] }, qty: { $sum: '$items.dispensedQty' } } },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
    Visit.aggregate([{ $match: { createdAt: range } }, { $group: { _id: '$clinicDate', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);

  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const appts = toObj(apptStatus);
  const attended = (appts.checked_in || 0) + (appts.completed || 0);
  const due = attended + (appts.no_show || 0);

  // fill missing days with zero for the chart
  const days = [];
  for (let d = from; d <= to && days.length < 62; d = addDays(d, 1)) days.push({ date: d, visits: daily.find((x) => x._id === d)?.n || 0 });

  return {
    from,
    to,
    visits: { byStatus: toObj(visitStatus), byType: toObj(visitTypes), total: visitStatus.reduce((a, r) => a + r.n, 0) },
    stages: Object.fromEntries(stageTimes.map((s) => [s._id, { avgWait: round(s.avgWait), avgService: round(s.avgService), served: s.served }])),
    appointments: { byStatus: appts, total: Object.values(appts).reduce((a, n) => a + n, 0), noShowRate: due ? round(((appts.no_show || 0) / due) * 100) : null },
    lab: { total: labStats[0]?.total || 0, completed: labStats[0]?.completed || 0, avgTurnaround: round(labStats[0]?.avgTurnaround) },
    prescriptions: { byStatus: toObj(rxStatus), topMedications: topMeds.map((m) => ({ name: m._id, qty: m.qty })) },
    daily: days,
  };
}

/** Small per-department stats for the staff workspaces (FR-RPT-01). */
export async function stageStats(stage, actor) {
  if (!STAGE_ROLES[stage]?.includes(actor.role)) throw forbidden();
  const today = clinicDate();
  const { start } = clinicDayRange(today);
  const [mine, all] = await Promise.all([
    Visit.countDocuments({ stageHistory: { $elemMatch: { stage, servedBy: actor._id, leftAt: { $gte: start } } } }),
    Visit.aggregate([
      { $match: { clinicDate: today } },
      { $unwind: '$stageHistory' },
      { $match: { 'stageHistory.stage': stage, 'stageHistory.calledAt': { $ne: null } } },
      { $group: { _id: null, served: { $sum: 1 }, avgWait: avgMinutes('$stageHistory.enteredAt', '$stageHistory.calledAt') } },
    ]),
  ]);
  return { servedByMeToday: mine, servedToday: all[0]?.served || 0, avgWaitToday: round(all[0]?.avgWait) };
}

export async function auditLog({ q, action, from, to, limit = 200 }) {
  const filter = {};
  if (action) filter.action = new RegExp(`^${escapeRegex(action)}`);
  if (from || to) {
    filter.at = {};
    if (from) filter.at.$gte = clinicDayRange(from).start;
    if (to) filter.at.$lt = clinicDayRange(to).end;
  }
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ userName: re }, { summary: re }];
  }
  return AuditLog.find(filter).sort({ at: -1 }).limit(limit);
}
