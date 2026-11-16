import mongoose from 'mongoose';
import { ALL_ROLES } from '../utils/constants.js';

const { Schema } = mongoose;

// Weekly availability template for doctors (embedded: small, bounded, always read with the doctor).
const availabilitySchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false },
);

const staffProfileSchema = new Schema(
  {
    staffNo: { type: String, trim: true },
    department: { type: String, trim: true },
    specialization: { type: String, trim: true },
    licenseNo: { type: String, trim: true },
    room: { type: String, trim: true },
    availability: { type: [availabilitySchema], default: undefined },
    slotMinutes: { type: Number, min: 5, max: 120 },
    unavailableDates: { type: [String], default: undefined }, // "YYYY-MM-DD"
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ALL_ROLES, required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 20 },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    staffProfile: { type: staffProfileSchema, default: undefined },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' }, // role = patient only
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'staffProfile.staffNo': 1 }, { unique: true, partialFilterExpression: { 'staffProfile.staffNo': { $type: 'string' } } });
userSchema.index({ patientId: 1 }, { unique: true, partialFilterExpression: { patientId: { $type: 'objectId' } } });

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.id;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema, 'users');
