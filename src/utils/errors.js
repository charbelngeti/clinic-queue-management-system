// Application error carrying an HTTP status and a stable machine-readable code (NFR-REL-01).
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please log in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Record') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
export const invalid = (details, message = 'Some fields are invalid.') =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
export const invalidTransition = (entity, from, to) =>
  new AppError(409, 'INVALID_TRANSITION', `A ${entity} cannot move from "${from}" to "${to}".`);

export const isDuplicateKeyError = (err) => err?.code === 11000 || err?.cause?.code === 11000;
