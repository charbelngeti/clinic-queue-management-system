import mongoose from 'mongoose';
import { config } from './env.js';

// NoSQL operator injection is blocked at the edge (rejectMongoOperators) and by typed validation;
// mongoose's global sanitizeFilter is NOT used because it would also neutralise our own $in/$or queries.
mongoose.set('strictQuery', true);

export async function connectDB({ dbName = config.mongoDb } = {}) {
  await mongoose.connect(config.mongoUri, {
    dbName,
    serverSelectionTimeoutMS: 15000,
    autoIndex: false, // indexes are created explicitly by scripts/init-db.js
    autoCreate: false, // collections (with $jsonSchema validators) are created by scripts/init-db.js
  });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

/**
 * Run `fn(session)` inside a MongoDB multi-document transaction (NFR-INT-01).
 * withTransaction() retries automatically on transient errors (e.g. write conflicts).
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
