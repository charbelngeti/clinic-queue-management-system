import mongoose from 'mongoose';

const { Schema } = mongoose;

const patientSchema = new Schema(
  {
    patientNo: { type: String, required: true }, // e.g. P-2026-00042, generated from a counter
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    dateOfBirth: { type: Date, required: true },
    sex: { type: String, enum: ['female', 'male', 'other'], required: true },
    nationalId: { type: String, trim: true, maxlength: 20 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 200 },
    // Embedded 1:1 — owned by the patient, always read with them.
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 120 },
      relationship: { type: String, trim: true, maxlength: 40 },
      phone: { type: String, trim: true, maxlength: 20 },
    },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }, // portal account, if created
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

patientSchema.index({ patientNo: 1 }, { unique: true });
// Sparse-like uniqueness: only enforced when a national ID is present (children may have none).
patientSchema.index({ nationalId: 1 }, { unique: true, partialFilterExpression: { nationalId: { $type: 'string' } } });
patientSchema.index({ lastName: 1, firstName: 1, dateOfBirth: 1 });
patientSchema.index({ phone: 1 });

patientSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});
patientSchema.set('toJSON', { virtuals: true, versionKey: false, transform: (_d, r) => { delete r.id; return r; } });

export const Patient = mongoose.model('Patient', patientSchema, 'patients');
