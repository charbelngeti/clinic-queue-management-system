import './setup-env.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seed, DEMO_PASSWORD } from '../scripts/seed.js';

export const app = createApp();

export async function setupDatabase() {
  await connectDB();
  await seed({ log: () => {} });
}

export const teardown = () => disconnectDB();

/** Log in as a demo user; returns a supertest agent that keeps the session cookie. */
export async function loginAs(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const EMAILS = {
  admin: 'admin@clinic.test',
  reception: 'reception@clinic.test',
  doctor: 'dr.otieno@clinic.test',
  doctor2: 'dr.mwangi@clinic.test',
  clinician: 'co.njoroge@clinic.test',
  nurse: 'nurse.akinyi@clinic.test',
  nurse2: 'nurse.mutua@clinic.test',
  lab: 'lab.kamau@clinic.test',
  pharmacist: 'pharm.omondi@clinic.test',
  patient: 'patient@clinic.test',
  patient2: 'patient2@clinic.test',
};

/** Find the first free future slot of a doctor within the next 21 days. */
export async function findFreeSlot(agent, doctorId, startOffset = 1) {
  for (let i = startOffset; i < startOffset + 21; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    const res = await agent.get(`/api/doctors/${doctorId}/slots?date=${d}`);
    const free = res.body.slots?.find((s) => s.status === 'free');
    if (free) return { date: d, time: free.time };
  }
  throw new Error('no free slot found');
}

export { request };
