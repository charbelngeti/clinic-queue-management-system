// Centralised configuration, read once from environment variables (.env is loaded by `node --env-file`).
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: required('MONGODB_URI'),
  mongoDb: process.env.MONGODB_DB || 'clinic_qms',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresHours: 8,
  clinicTz: process.env.CLINIC_TZ || 'Africa/Nairobi',
  // Patients may cancel their own appointment until this many hours before it starts (FR-APT-05).
  patientCancelCutoffHours: 2,
};

export const isProduction = config.env === 'production';
export const isTest = config.env === 'test';
