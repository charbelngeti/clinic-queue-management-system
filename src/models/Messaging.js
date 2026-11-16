import mongoose from 'mongoose';

const { Schema } = mongoose;

// A conversation is either between reception (as a shared desk) and one other user,
// or — when started by a receptionist — between that desk and a chosen staff member / patient.
const conversationSchema = new Schema(
  {
    // The non-reception participant (staff member or patient user).
    counterpartId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    counterpartRole: String,
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' }, // optional context
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: String,
    unreadForReception: { type: Number, default: 0 },
    unreadForCounterpart: { type: Number, default: 0 },
  },
  { timestamps: true },
);
conversationSchema.index({ counterpartId: 1, lastMessageAt: -1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.set('toJSON', { versionKey: false });
export const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations');

// Messages are referenced (not embedded) because a thread can grow without bound.
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: String,
    senderRole: String,
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.set('toJSON', { versionKey: false });
export const Message = mongoose.model('Message', messageSchema, 'messages');

/* ---------------- audit log ---------------- */
const auditSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    role: String,
    action: { type: String, required: true }, // e.g. patient.update, consultation.finalize
    entity: String,
    entityId: Schema.Types.ObjectId,
    summary: String,
    ip: String,
  },
  { versionKey: false },
);
auditSchema.index({ at: -1 });
auditSchema.index({ entity: 1, entityId: 1, at: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema, 'auditLogs');
