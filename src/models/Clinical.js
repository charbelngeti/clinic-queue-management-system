// Clinical records are kept in collections separate from operational queue data, so that
// front-desk queries never touch clinical information (privacy by design, DR-01).
import mongoose from 'mongoose';
import { LAB_STATUSES, RX_STATUSES } from '../utils/constants.js';

const { Schema } = mongoose;

/* ---------------- consultations ---------------- */
const consultationSchema = new Schema(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clinicianName: String, // snapshot
    clinicianRole: { type: String, enum: ['doctor', 'clinician'] },
    chiefComplaint: { type: String, maxlength: 500 },
    history: { type: String, maxlength: 4000 },
    examination: { type: String, maxlength: 4000 },
    diagnosis: { type: String, maxlength: 1000 },
    plan: { type: String, maxlength: 2000 },
    notes: { type: String, maxlength: 4000 },
    referral: {
      toDoctorId: { type: Schema.Types.ObjectId, ref: 'User' },
      toDoctorName: String,
      reason: String,
      at: Date,
    },
    status: { type: String, enum: ['draft', 'final'], default: 'draft' },
    finalizedAt: Date,
  },
  { timestamps: true },
);
consultationSchema.index({ visitId: 1, clinicianId: 1 });
consultationSchema.index({ patientId: 1, createdAt: -1 });
consultationSchema.set('toJSON', { versionKey: false });
export const Consultation = mongoose.model('Consultation', consultationSchema, 'consultations');

/* ---------------- lab test catalogue ---------------- */
const labTestSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    sampleType: { type: String, trim: true },
    unit: { type: String, trim: true },
    refRange: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
labTestSchema.index({ code: 1 }, { unique: true });
labTestSchema.set('toJSON', { versionKey: false });
export const LabTest = mongoose.model('LabTest', labTestSchema, 'labTests');

/* ---------------- lab requests ---------------- */
const labResultSchema = new Schema(
  {
    value: { type: String, maxlength: 100 },
    unit: String,
    refRange: String,
    flag: { type: String, enum: ['normal', 'low', 'high', 'critical'] },
    comment: { type: String, maxlength: 500 },
  },
  { _id: false },
);
const labRequestSchema = new Schema(
  {
    requestNo: { type: String, required: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: String,
    priority: { type: String, enum: ['routine', 'urgent'], default: 'routine' },
    clinicalNotes: { type: String, maxlength: 1000 },
    status: { type: String, enum: LAB_STATUSES, default: 'requested' },
    // Embedded: test lines are bounded and never accessed without their request.
    tests: [
      new Schema(
        {
          testId: { type: Schema.Types.ObjectId, ref: 'LabTest' },
          code: String,
          name: String, // snapshot of catalogue entry
          result: { type: labResultSchema, default: undefined },
        },
        { _id: true },
      ),
    ],
    sampleCollectedAt: Date,
    sampleCollectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedByName: String,
    completedAt: Date,
    reviewedAt: Date, // when the requesting clinician opened the results
  },
  { timestamps: true },
);
labRequestSchema.index({ requestNo: 1 }, { unique: true });
labRequestSchema.index({ status: 1, createdAt: 1 });
labRequestSchema.index({ visitId: 1 });
labRequestSchema.index({ patientId: 1, createdAt: -1 });
labRequestSchema.set('toJSON', { versionKey: false });
export const LabRequest = mongoose.model('LabRequest', labRequestSchema, 'labRequests');

/* ---------------- medications (formulary + stock) ---------------- */
const medicationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    strength: { type: String, required: true, trim: true },
    form: { type: String, required: true, trim: true }, // tablet, syrup, …
    unit: { type: String, default: 'units' },
    stockQty: { type: Number, min: 0, default: 0 },
    reorderLevel: { type: Number, min: 0, default: 20 },
    clinicianMayPrescribe: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
medicationSchema.index({ name: 1, strength: 1, form: 1 }, { unique: true });
medicationSchema.set('toJSON', { versionKey: false });
export const Medication = mongoose.model('Medication', medicationSchema, 'medications');

/* ---------------- prescriptions ---------------- */
const rxItemSchema = new Schema({
  medicationId: { type: Schema.Types.ObjectId, ref: 'Medication', required: true },
  name: String, // snapshots
  strength: String,
  form: String,
  dose: { type: String, required: true, maxlength: 60 },
  frequency: { type: String, required: true, maxlength: 60 },
  durationDays: { type: Number, min: 1, max: 365, required: true },
  quantity: { type: Number, min: 1, max: 1000, required: true },
  dispensedQty: { type: Number, min: 0, default: 0 },
  instructions: { type: String, maxlength: 300 },
});
const prescriptionSchema = new Schema(
  {
    rxNo: { type: String, required: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    prescriber: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: String,
      role: String,
      licenseNo: String,
    },
    status: { type: String, enum: RX_STATUSES, default: 'pending' },
    items: { type: [rxItemSchema], validate: [(v) => v.length > 0, 'At least one item is required.'] },
    notes: { type: String, maxlength: 500 },
    dispensedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dispensedByName: String,
    dispensedAt: Date,
  },
  { timestamps: true },
);
prescriptionSchema.index({ rxNo: 1 }, { unique: true });
prescriptionSchema.index({ visitId: 1 }, { unique: true }); // one prescription per visit
prescriptionSchema.index({ status: 1, createdAt: 1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.set('toJSON', { versionKey: false });
export const Prescription = mongoose.model('Prescription', prescriptionSchema, 'prescriptions');
