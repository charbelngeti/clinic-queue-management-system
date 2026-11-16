import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.js';
import { isTest } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import * as usersCtl from '../controllers/users.controller.js';
import * as fd from '../controllers/frontdesk.controller.js';
import * as q from '../controllers/queue.controller.js';
import * as cl from '../controllers/clinical.controller.js';

const router = Router();

// NFR-SEC-05: throttle login attempts (brute-force protection).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' } }),
});

/* ---------- public ---------- */
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/public/queue', q.publicBoard); // "Who's Next" display: tickets only, no personal data

/* ---------- everything below requires a valid session ---------- */
router.use(authenticate);

router.get('/auth/me', auth.me);
router.patch('/auth/password', auth.changePassword);

/* users (admin) */
router.get('/users/directory', authorize('users:directory'), usersCtl.directory);
router.get('/users', authorize('users:manage'), usersCtl.list);
router.post('/users', authorize('users:manage'), usersCtl.create);
router.patch('/users/:id', authorize('users:manage'), usersCtl.update);
router.post('/users/:id/reset-password', authorize('users:manage'), usersCtl.resetPassword);

/* patients */
router.get('/patients', authorize('patients:read'), fd.searchPatients);
router.post('/patients', authorize('patients:write'), fd.createPatient);
router.get('/patients/:id', authorize('patients:read'), fd.getPatient);
router.patch('/patients/:id', authorize('patients:write'), fd.updatePatient);
router.post('/patients/:id/portal-account', authorize('patientAccounts:create'), fd.createPortalAccount);

/* doctors & availability */
router.get('/doctors', authorize('doctors:read'), fd.listDoctors);
router.get('/doctors/:id/slots', authorize('doctors:read'), fd.slots);
router.put('/doctors/:id/availability', authorize('availability:manage'), fd.updateAvailability);

/* appointments */
router.get('/appointments', authorize('appointments:read', 'appointments:own'), fd.listAppointments);
router.post('/appointments', authorize('appointments:write', 'appointments:own'), fd.bookAppointment);
router.post('/appointments/no-show/bulk', authorize('appointments:write'), fd.bulkNoShow);
router.get('/appointments/:id', authorize('appointments:read', 'appointments:own'), fd.getAppointment);
router.post('/appointments/:id/cancel', authorize('appointments:write', 'appointments:own'), fd.cancelAppointment);
router.post('/appointments/:id/no-show', authorize('appointments:write'), fd.noShow);

/* visits & queues */
router.post('/visits/check-in', authorize('visits:checkin'), q.checkIn);
router.get('/queue/board', authorize('queue:monitor'), q.board);
router.get('/queue/:stage/staff', authorize('users:directory'), q.stageStaff);
router.get('/queue/:stage', q.worklist); // permission checked per stage in controller
router.post('/queue/:stage/call-next', q.callNext);
router.get('/me/visit', authorize('appointments:own'), q.myVisit);
router.get('/visits/:id', authorize('patients:clinicalSummary'), q.getVisit);
router.post('/visits/:id/start', q.start);
router.post('/visits/:id/skip', q.skip);
router.post('/visits/:id/recall', q.recall);
router.post('/visits/:id/requeue', q.requeue);
router.post('/visits/:id/cancel', authorize('visits:cancel'), q.cancelVisit);
router.post('/visits/:id/triage', authorize('triage:write'), q.recordTriage);
router.post('/visits/:id/send-to-consultation', authorize('triage:write'), q.sendToConsultation);

/* consultation (doctor / clinician) */
router.get('/catalogues', authorize('consultations:write'), cl.catalogues);
router.get('/lab-tests', authorize('labTests:read'), cl.labTests);
router.get('/consultations/visit/:visitId', authorize('consultations:write'), cl.consultationContext);
router.put('/consultations/visit/:visitId', authorize('consultations:write'), cl.saveNote);
router.post('/consultations/visit/:visitId/lab-request', authorize('labRequests:create'), cl.requestLab);
router.post('/consultations/visit/:visitId/prescription', authorize('prescriptions:create'), cl.prescribe);
router.post('/consultations/visit/:visitId/complete', authorize('consultations:write'), cl.completeVisit);
router.post('/consultations/visit/:visitId/refer', authorize('consultations:write'), cl.refer);

/* laboratory */
router.get('/lab/requests', authorize('labRequests:process'), cl.labList);
router.get('/lab/visit/:visitId', authorize('labRequests:process'), cl.labForVisit);
router.post('/lab/requests/:id/status', authorize('labRequests:process'), cl.labStatus);
router.post('/lab/requests/:id/results', authorize('labRequests:process'), cl.labResults);

/* pharmacy & formulary */
router.get('/pharmacy/prescriptions', authorize('prescriptions:dispense'), cl.rxList);
router.get('/pharmacy/visit/:visitId', authorize('prescriptions:dispense'), cl.rxForVisit);
router.post('/pharmacy/prescriptions/:id/dispense', authorize('prescriptions:dispense'), cl.dispense);
router.get('/medications', authorize('medications:read'), cl.listMedications);
router.post('/medications', authorize('medications:manage'), cl.createMedication);
router.patch('/medications/:id', authorize('medications:manage'), cl.updateMedication);
router.post('/medications/:id/receive', authorize('medications:stock'), cl.receiveStock);

export default router;
