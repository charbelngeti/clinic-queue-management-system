import mongoose from 'mongoose';
import { APPOINTMENT_STATUSES } from '../utils/constants.js';

const { Schema } = mongoose;

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    appointmentNo: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'scheduled', required: true },
    // true while scheduled/checked_in: the partial unique indexes below only consider active appointments,
    // so a cancelled slot can be booked again.
    isActive: { type: Boolean, default: true, required: true },
    bookedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      channel: { type: String, enum: ['reception', 'portal'] },
    },
    cancellation: {
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, maxlength: 300 },
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit' },
  },
  { timestamps: true },
);

appointmentSchema.index({ appointmentNo: 1 }, { unique: true });
// FR-APT-03: a doctor cannot have two active appointments starting at the same time…
appointmentSchema.index({ doctorId: 1, startAt: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
// …and neither can a patient.
appointmentSchema.index({ patientId: 1, startAt: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
appointmentSchema.index({ startAt: 1, status: 1 });

appointmentSchema.set('toJSON', { versionKey: false });

export const Appointment = mongoose.model('Appointment', appointmentSchema, 'appointments');
