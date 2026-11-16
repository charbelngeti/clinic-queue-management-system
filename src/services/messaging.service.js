// Internal messaging (FR-MSG-01..05). Reception is a shared desk: every conversation is between
// "Reception" and exactly one other user (staff member or patient). Receptionists can start a conversation
// with anyone; everyone else can only start one with reception.
import { Conversation, Message, User } from '../models/index.js';
import { withTransaction } from '../config/db.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';

const isDesk = (u) => u.role === 'receptionist';
const display = (u) => `${u.role === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}`;

export async function recipients() {
  return User.find({ isActive: true, role: { $in: ['doctor', 'clinician', 'nurse', 'lab_tech', 'pharmacist', 'patient'] } })
    .select('firstName lastName role')
    .sort({ role: 1, lastName: 1 });
}

export async function list(actor) {
  const filter = isDesk(actor) ? {} : { counterpartId: actor._id };
  return Conversation.find(filter).sort({ lastMessageAt: -1 }).limit(100).populate('counterpartId', 'firstName lastName role').populate('patientId', 'patientNo firstName lastName');
}

export async function unreadCount(actor) {
  const match = isDesk(actor) ? { unreadForReception: { $gt: 0 } } : { counterpartId: actor._id, unreadForCounterpart: { $gt: 0 } };
  const field = isDesk(actor) ? '$unreadForReception' : '$unreadForCounterpart';
  const [r] = await Conversation.aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: field } } }]);
  return r?.n || 0;
}

async function loadConversation(id, actor) {
  const conv = await Conversation.findById(id);
  // Not-found (rather than forbidden) so users cannot probe for other people's conversations.
  if (!conv || (!isDesk(actor) && String(conv.counterpartId) !== String(actor._id))) throw notFound('Conversation');
  return conv;
}

export async function start(actor, { toUserId, subject, body, patientId }) {
  let counterpartId = actor._id;
  if (isDesk(actor)) {
    if (!toUserId) throw badRequest('Choose a recipient.');
    const to = await User.findOne({ _id: toUserId, isActive: true });
    if (!to || ['receptionist', 'admin'].includes(to.role)) throw badRequest('Messages can be sent to clinical staff and patients.');
    counterpartId = to._id;
  } else if (toUserId) {
    throw forbidden('You can only message the reception desk.');
  }
  const counterpart = await User.findById(counterpartId);
  return withTransaction(async (session) => {
    const fromDesk = isDesk(actor);
    const [conv] = await Conversation.create(
      [
        {
          counterpartId,
          counterpartRole: counterpart.role,
          subject,
          patientId: actor.role === 'patient' ? actor.patientId : patientId,
          createdBy: actor._id,
          lastMessageAt: new Date(),
          lastMessagePreview: body.slice(0, 120),
          unreadForReception: fromDesk ? 0 : 1,
          unreadForCounterpart: fromDesk ? 1 : 0,
        },
      ],
      { session },
    );
    await Message.create([{ conversationId: conv._id, senderId: actor._id, senderName: display(actor), senderRole: actor.role, body }], { session });
    return conv;
  });
}

export async function thread(id, actor) {
  const conv = await loadConversation(id, actor);
  const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).limit(500);
  // Opening the thread marks it read for this side.
  await Conversation.updateOne({ _id: id }, { $set: isDesk(actor) ? { unreadForReception: 0 } : { unreadForCounterpart: 0 } });
  await conv.populate([{ path: 'counterpartId', select: 'firstName lastName role' }, { path: 'patientId', select: 'patientNo firstName lastName' }]);
  return { conversation: conv, messages };
}

export async function reply(id, actor, body) {
  await loadConversation(id, actor);
  const fromDesk = isDesk(actor);
  return withTransaction(async (session) => {
    const [msg] = await Message.create([{ conversationId: id, senderId: actor._id, senderName: display(actor), senderRole: actor.role, body }], { session });
    await Conversation.updateOne(
      { _id: id },
      { $set: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) }, $inc: fromDesk ? { unreadForCounterpart: 1 } : { unreadForReception: 1 } },
      { session },
    );
    return msg;
  });
}
