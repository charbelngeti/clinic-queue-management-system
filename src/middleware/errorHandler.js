import mongoose from 'mongoose';
import { isProduction, isTest } from '../config/env.js';
import { AppError, isDuplicateKeyError } from '../utils/errors.js';

// Friendly messages for unique-index violations, keyed by the index that was violated.
const DUPLICATE_MESSAGES = [
  [/email/, 'An account with this email already exists.'],
  [/nationalId/, 'A patient with this national ID is already registered.'],
  [/doctorId_1_startAt_1/, 'This time slot has just been booked. Please choose another slot.'],
  [/patientId_1_startAt_1/, 'The patient already has an appointment at this time.'],
  [/patientId_1/, 'This patient is already in the queue (an active visit exists).'],
  [/staffNo/, 'This staff number is already in use.'],
  [/visitId_1/, 'A prescription already exists for this visit.'],
  [/name_1_strength_1_form_1/, 'This medication already exists in the formulary.'],
  [/code_1/, 'A lab test with this code already exists.'],
];

/** Rejects request bodies containing MongoDB operators or dotted keys (NoSQL injection, NFR-SEC-04). */
export function rejectMongoOperators(req, _res, next) {
  const bad = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 10) return false;
    return Object.keys(obj).some((k) => k.startsWith('$') || k.includes('.') || bad(obj[k], depth + 1));
  };
  if (bad(req.body) || bad(req.query)) {
    throw new AppError(400, 'BAD_REQUEST', 'Request contains forbidden characters in field names.');
  }
  next();
}

export function notFoundApi(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `No API route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (isDuplicateKeyError(err)) {
    const text = `${err.message} ${JSON.stringify(err.keyPattern || {})}`;
    const match = DUPLICATE_MESSAGES.find(([re]) => re.test(text));
    error = new AppError(409, 'DUPLICATE', match ? match[1] : 'This record already exists.');
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    error = new AppError(422, 'VALIDATION_ERROR', 'Some fields are invalid.', details);
  } else if (err instanceof mongoose.Error.CastError) {
    error = new AppError(400, 'BAD_REQUEST', `Invalid value for ${err.path}.`);
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'BAD_REQUEST', 'Malformed JSON body.');
  } else if (!(err instanceof AppError)) {
    if (!isTest) console.error('[unhandled]', err);
    error = new AppError(500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
    if (!isProduction) error.details = { cause: err.message };
  }

  res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
}
