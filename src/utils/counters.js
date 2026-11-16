import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema, 'counters');

/**
 * Atomically increment and return the next number in a named sequence.
 * findOneAndUpdate + $inc is atomic, so two simultaneous registrations never get the same number.
 */
export async function nextSeq(key, session) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return doc.seq;
}

export const pad = (n, width) => String(n).padStart(width, '0');
