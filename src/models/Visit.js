import mongoose from 'mongoose';
import { QUEUE_STATUSES, STAGES, PRIORITIES } from '../utils/constants.js';

const { Schema } = mongoose;

// Vitals + nursing assessment: embedded 1:1 in the visit (owned by it, always read with it).
const triageSchema = new Schema(
  {
    vitals: {
      temperature: Number, // °C
      systolic: Number, // mmHg
      diastolic: Number,
      pulse: Number, // bpm
      respRate: Number, // breaths/min
      spo2: Number, // %
      weight: Number, // kg
      height: Number, // cm
      bmi: Number,
    },
    flags: { type: [String], default: [] },
    complaint: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 2000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    recordedAt: Date,
  },
  { _id: false },
);

// One entry per stage the patient passes through — used for waiting-time reports (FR-QUE-12).
const stageHistorySchema = new Schema(
  {
    stage: { type: String, enum: STAGES, required: true },
    enteredAt: { type: Date, required: true },
    calledAt: Date,
    leftAt: Date,
    servedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const visitSchema = new Schema(
  {
    visitNo: { type: String, required: true },
    ticketNo: { type: String, required: true }, // e.g. A-014 (appointment) / W-007 (walk-in)
    clinicDate: { type: String, required: true }, // clinic-local YYYY-MM-DD
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User' }, // booked doctor (appointment visits)
    type: { type: String, enum: ['appointment', 'walk_in'], required: true },

    // Current queue state — embedded, so moving a patient between departments is one atomic update.
    stage: { type: String, enum: STAGES, required: true },
    queueStatus: { type: String, enum: QUEUE_STATUSES, required: true },
    isActive: { type: Boolean, default: true, required: true },
    priority: { type: String, enum: Object.keys(PRIORITIES), default: 'normal' },
    priorityRank: { type: Number, min: 0, max: 2, default: 2 },
    queueTime: { type: Date, required: true }, // ordering key within a priority band
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = any staff at the stage
    calledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    calledAt: Date,
    room: String,
    labResultsReady: { type: Boolean, default: false },
    consultedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // last clinician who consulted

    triage: { type: triageSchema, default: undefined },
    stageHistory: { type: [stageHistorySchema], default: [] },
    completedAt: Date,
    cancelReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

visitSchema.index({ visitNo: 1 }, { unique: true });
// FR-QUE-03: a patient can only have ONE active visit (= one queue entry) at a time.
visitSchema.index({ patientId: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
// "Call next" and the Who's Next board: Equality (stage, status) → Sort (priority, time).
visitSchema.index({ stage: 1, queueStatus: 1, priorityRank: 1, queueTime: 1 });
visitSchema.index({ clinicDate: 1, ticketNo: 1 }, { unique: true });
visitSchema.index({ patientId: 1, createdAt: -1 });

visitSchema.set('toJSON', { versionKey: false });

export const Visit = mongoose.model('Visit', visitSchema, 'visits');
