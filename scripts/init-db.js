// Creates collections, MongoDB $jsonSchema validators and all indexes.
// Usage: npm run db:init   (safe to run repeatedly)
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import * as models from '../src/models/index.js';
import { APPOINTMENT_STATUSES, STAGES, QUEUE_STATUSES, RX_STATUSES, LAB_STATUSES } from '../src/utils/constants.js';

// Database-level validators: the last line of defence, enforced even for writes that bypass the
// application (e.g. edits in MongoDB Compass). Mongoose validates first and gives friendlier messages.
const VALIDATORS = {
  patients: {
    bsonType: 'object',
    required: ['patientNo', 'firstName', 'lastName', 'dateOfBirth', 'sex', 'phone'],
    properties: {
      patientNo: { bsonType: 'string', pattern: '^P-\\d{4}-\\d{5}$' },
      firstName: { bsonType: 'string', minLength: 1 },
      lastName: { bsonType: 'string', minLength: 1 },
      dateOfBirth: { bsonType: 'date' },
      sex: { enum: ['female', 'male', 'other'] },
      phone: { bsonType: 'string' },
      allergies: { bsonType: 'array', items: { bsonType: 'string' } },
    },
  },
  appointments: {
    bsonType: 'object',
    required: ['appointmentNo', 'patientId', 'doctorId', 'startAt', 'endAt', 'status', 'isActive'],
    properties: {
      patientId: { bsonType: 'objectId' },
      doctorId: { bsonType: 'objectId' },
      startAt: { bsonType: 'date' },
      endAt: { bsonType: 'date' },
      status: { enum: APPOINTMENT_STATUSES },
      isActive: { bsonType: 'bool' },
    },
  },
  visits: {
    bsonType: 'object',
    required: ['visitNo', 'ticketNo', 'clinicDate', 'patientId', 'type', 'stage', 'queueStatus', 'isActive', 'queueTime'],
    properties: {
      patientId: { bsonType: 'objectId' },
      clinicDate: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      type: { enum: ['appointment', 'walk_in'] },
      stage: { enum: STAGES },
      queueStatus: { enum: QUEUE_STATUSES },
      isActive: { bsonType: 'bool' },
      priorityRank: { bsonType: 'number', minimum: 0, maximum: 2 },
    },
  },
  labRequests: {
    bsonType: 'object',
    required: ['requestNo', 'visitId', 'patientId', 'requestedBy', 'status', 'tests'],
    properties: {
      status: { enum: LAB_STATUSES },
      tests: { bsonType: 'array', minItems: 1 },
    },
  },
  prescriptions: {
    bsonType: 'object',
    required: ['rxNo', 'visitId', 'patientId', 'status', 'items'],
    properties: {
      status: { enum: RX_STATUSES },
      items: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['medicationId', 'quantity', 'dispensedQty'],
          properties: {
            quantity: { bsonType: 'number', minimum: 1 },
            dispensedQty: { bsonType: 'number', minimum: 0 },
          },
        },
      },
    },
  },
  medications: {
    bsonType: 'object',
    required: ['name', 'strength', 'form', 'stockQty'],
    properties: {
      stockQty: { bsonType: 'number', minimum: 0 }, // stock can never go negative
    },
  },
};

export async function initDatabase() {
  const db = mongoose.connection.db;
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const model of Object.values(models)) {
    const name = model.collection.collectionName;
    const validator = VALIDATORS[name] ? { $jsonSchema: VALIDATORS[name] } : undefined;
    const options = validator ? { validator, validationLevel: 'strict', validationAction: 'error' } : {};
    if (!existing.has(name)) {
      await db.createCollection(name, options);
    } else if (validator) {
      try {
        await db.command({ collMod: name, ...options });
      } catch (err) {
        // collMod needs the dbAdmin role. An empty collection can simply be recreated with the validator instead.
        if ((await db.collection(name).estimatedDocumentCount()) === 0) {
          await db.collection(name).drop();
          await db.createCollection(name, options);
        } else {
          console.warn(`  ! ${name}: could not update validator (${err.message}). Run "npm run seed" to rebuild.`);
        }
      }
    }
    await model.syncIndexes();
    const idx = await model.collection.indexes();
    console.log(`  ✓ ${name.padEnd(14)} ${validator ? 'validator + ' : ''}${idx.length} indexes`);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('init-db.js')) {
  await connectDB();
  console.log(`Initialising database "${mongoose.connection.name}"…`);
  await initDatabase();
  await disconnectDB();
  console.log('Done.');
}
