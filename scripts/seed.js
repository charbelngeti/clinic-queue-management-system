// Resets the database and loads SYNTHETIC demo data (no real patient information).
// Usage: npm run seed
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initDatabase } from './init-db.js';
import * as M from '../src/models/index.js';
import { hashPassword } from '../src/services/user.service.js';
import { clinicDate, clinicDateTimeToUtc, addDays, weekdayOf, timeToMinutes, minutesToTime } from '../src/utils/dates.js';

export const DEMO_PASSWORD = 'Clinic@2026';

// Deterministic pseudo-random generator so every seed run produces the same data.
let rngState = 20261120;
const rand = () => ((rngState = (rngState * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const WEEKDAYS_FULL = [
  { start: '08:00', end: '13:00' },
  { start: '14:00', end: '17:00' },
];
const weekly = (days, blocks = WEEKDAYS_FULL) => days.flatMap((d) => blocks.map((b) => ({ dayOfWeek: d, ...b })));

const STAFF = [
  ['admin', 'Grace', 'Wanjiku', 'admin@clinic.test', { staffNo: 'ADM-001', department: 'Administration' }],
  ['receptionist', 'Mercy', 'Achieng', 'reception@clinic.test', { staffNo: 'REC-001', department: 'Front Desk' }],
  ['receptionist', 'Brian', 'Kiprono', 'reception2@clinic.test', { staffNo: 'REC-002', department: 'Front Desk' }],
  ['doctor', 'James', 'Otieno', 'dr.otieno@clinic.test',
    { staffNo: 'DOC-001', department: 'Outpatient', specialization: 'General Medicine', licenseNo: 'KMPDC-A1023', room: 'Room 3',
      availability: weekly([1, 2, 3, 4, 5]), slotMinutes: 20 }],
  ['doctor', 'Lucy', 'Mwangi', 'dr.mwangi@clinic.test',
    { staffNo: 'DOC-002', department: 'Outpatient', specialization: 'Paediatrics', licenseNo: 'KMPDC-A2210', room: 'Room 4',
      availability: [...weekly([1, 3, 5]), { dayOfWeek: 6, start: '09:00', end: '12:00' }], slotMinutes: 20 }],
  ['doctor', 'Ahmed', 'Hassan', 'dr.hassan@clinic.test',
    { staffNo: 'DOC-003', department: 'Outpatient', specialization: 'Internal Medicine', licenseNo: 'KMPDC-A3391', room: 'Room 5',
      availability: weekly([2, 4], [{ start: '09:00', end: '16:00' }]), slotMinutes: 30 }],
  ['clinician', 'Peter', 'Njoroge', 'co.njoroge@clinic.test',
    { staffNo: 'CO-001', department: 'Outpatient', specialization: 'Clinical Officer', licenseNo: 'COC-11872', room: 'Room 1' }],
  ['clinician', 'Esther', 'Wekesa', 'co.wekesa@clinic.test',
    { staffNo: 'CO-002', department: 'Outpatient', specialization: 'Clinical Officer', licenseNo: 'COC-12406', room: 'Room 2' }],
  ['nurse', 'Diana', 'Akinyi', 'nurse.akinyi@clinic.test', { staffNo: 'NUR-001', department: 'Triage', room: 'Triage A' }],
  ['nurse', 'Samuel', 'Mutua', 'nurse.mutua@clinic.test', { staffNo: 'NUR-002', department: 'Triage', room: 'Triage B' }],
  ['lab_tech', 'John', 'Kamau', 'lab.kamau@clinic.test', { staffNo: 'LAB-001', department: 'Laboratory', room: 'Lab' }],
  ['lab_tech', 'Faith', 'Chebet', 'lab.chebet@clinic.test', { staffNo: 'LAB-002', department: 'Laboratory', room: 'Lab' }],
  ['pharmacist', 'Kevin', 'Omondi', 'pharm.omondi@clinic.test', { staffNo: 'PHA-001', department: 'Pharmacy', licenseNo: 'PPB-5521', room: 'Pharmacy' }],
  ['pharmacist', 'Ann', 'Nduta', 'pharm.nduta@clinic.test', { staffNo: 'PHA-002', department: 'Pharmacy', licenseNo: 'PPB-6034', room: 'Pharmacy' }],
];

const FIRST_F = ['Wanjiru', 'Achieng', 'Nekesa', 'Chepkoech', 'Mumbua', 'Atieno', 'Njeri', 'Kerubo', 'Halima', 'Zawadi', 'Amani', 'Imani', 'Moraa', 'Awino', 'Faith', 'Mary', 'Joy', 'Sharon'];
const FIRST_M = ['Kamau', 'Ochieng', 'Kiplagat', 'Mutiso', 'Baraka', 'Juma', 'Omondi', 'Wafula', 'Kibet', 'Mwenda', 'Otieno', 'Daniel', 'Brian', 'Collins', 'Dennis', 'Hassan', 'Kevin', 'Victor'];
const LAST = ['Mwangi', 'Odhiambo', 'Kiprotich', 'Wambua', 'Njoroge', 'Onyango', 'Cheruiyot', 'Muthoni', 'Owino', 'Kariuki', 'Mohamed', 'Wekesa', 'Ndungu', 'Barasa', 'Kimani', 'Langat', 'Okoth', 'Nyambura'];
const TOWNS = ['Nairobi, Westlands', 'Nairobi, Kilimani', 'Nairobi, Embakasi', 'Kiambu, Ruiru', 'Nairobi, Kasarani', 'Machakos, Athi River', 'Nairobi, South B', 'Kajiado, Kitengela'];
const ALLERGIES = ['Penicillin', 'Sulfonamides', 'Aspirin', 'Ibuprofen', 'Peanuts'];
const CHRONIC = ['Hypertension', 'Type 2 diabetes', 'Asthma'];

const LAB_TESTS = [
  ['FBC', 'Full Blood Count', 'Blood (EDTA)', '', 'See report'],
  ['HB', 'Haemoglobin', 'Blood (EDTA)', 'g/dL', '12.0–17.5'],
  ['MPS', 'Malaria Parasites (Blood Slide)', 'Blood', '', 'Not seen'],
  ['MRDT', 'Malaria Rapid Diagnostic Test', 'Blood', '', 'Negative'],
  ['RBS', 'Random Blood Sugar', 'Blood', 'mmol/L', '3.9–7.8'],
  ['FBS', 'Fasting Blood Sugar', 'Blood', 'mmol/L', '3.9–5.6'],
  ['HBA1C', 'HbA1c', 'Blood (EDTA)', '%', '4.0–5.6'],
  ['UA', 'Urinalysis', 'Urine', '', 'See report'],
  ['UECS', 'Urea, Electrolytes & Creatinine', 'Blood (serum)', '', 'See report'],
  ['LFT', 'Liver Function Tests', 'Blood (serum)', '', 'See report'],
  ['LIPID', 'Lipid Profile', 'Blood (serum)', 'mmol/L', 'Total chol < 5.2'],
  ['HIV', 'HIV 1&2 Rapid Test', 'Blood', '', 'Non-reactive'],
  ['ESR', 'Erythrocyte Sedimentation Rate', 'Blood (EDTA)', 'mm/hr', '0–20'],
  ['WIDAL', 'Widal Test (Typhoid)', 'Blood (serum)', '', '< 1:80'],
  ['HPYL', 'H. pylori Antigen', 'Stool', '', 'Negative'],
  ['STOOL', 'Stool Microscopy', 'Stool', '', 'No ova/cysts'],
  ['PDT', 'Pregnancy Test (urine hCG)', 'Urine', '', 'Negative'],
];

// [name, strength, form, stockQty, reorderLevel, clinicianMayPrescribe]
const MEDICATIONS = [
  ['Paracetamol', '500 mg', 'Tablet', 2400, 300, true],
  ['Ibuprofen', '400 mg', 'Tablet', 900, 200, true],
  ['Amoxicillin', '500 mg', 'Capsule', 600, 150, true],
  ['Amoxicillin', '250 mg/5 mL', 'Suspension', 40, 15, true],
  ['Amoxicillin/Clavulanate', '625 mg', 'Tablet', 180, 60, false],
  ['Artemether/Lumefantrine', '20/120 mg', 'Tablet', 480, 120, true],
  ['Metformin', '500 mg', 'Tablet', 1200, 200, false],
  ['Amlodipine', '5 mg', 'Tablet', 700, 150, false],
  ['Losartan', '50 mg', 'Tablet', 35, 100, false],
  ['Omeprazole', '20 mg', 'Capsule', 500, 100, true],
  ['Cetirizine', '10 mg', 'Tablet', 450, 100, true],
  ['Salbutamol', '100 mcg', 'Inhaler', 25, 10, true],
  ['Prednisolone', '5 mg', 'Tablet', 300, 80, false],
  ['Ciprofloxacin', '500 mg', 'Tablet', 260, 80, false],
  ['Metronidazole', '400 mg', 'Tablet', 520, 120, true],
  ['Oral Rehydration Salts', '20.5 g', 'Sachet', 300, 100, true],
  ['Zinc Sulphate', '20 mg', 'Tablet', 8, 50, true],
  ['Ferrous Sulphate', '200 mg', 'Tablet', 600, 150, true],
  ['Folic Acid', '5 mg', 'Tablet', 400, 100, true],
  ['Ceftriaxone', '1 g', 'Injection', 60, 20, false],
  ['Diclofenac', '50 mg', 'Tablet', 350, 100, false],
  ['Albendazole', '400 mg', 'Tablet', 200, 50, true],
  ['Chlorpheniramine', '4 mg', 'Tablet', 380, 100, true],
  ['Hydrochlorothiazide', '25 mg', 'Tablet', 0, 50, false],
];

const REASONS = ['Follow-up review', 'Fever and headache', 'Persistent cough', 'Blood pressure review', 'Diabetes review',
  'Abdominal pain', 'Child immunisation follow-up', 'Skin rash', 'Back pain', 'General check-up', 'Sore throat', 'Joint pains'];

export async function seed({ log = console.log } = {}) {
  // Clear every collection (deleteMany works with the Atlas readWrite role; dropDatabase does not).
  for (const model of Object.values(M)) await model.deleteMany({});
  await initDatabase();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  /* ---------- staff ---------- */
  const staff = await M.User.insertMany(
    STAFF.map(([role, firstName, lastName, email, staffProfile]) => ({
      role, firstName, lastName, email, staffProfile, passwordHash,
      phone: `+2547${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
    })),
  );
  const byEmail = Object.fromEntries(staff.map((u) => [u.email, u]));
  const doctors = staff.filter((u) => u.role === 'doctor');
  const reception = byEmail['reception@clinic.test'];
  log(`  ✓ ${staff.length} staff accounts`);

  /* ---------- patients ---------- */
  const today = clinicDate();
  const year = today.slice(0, 4);
  const patients = [];
  for (let i = 1; i <= 42; i++) {
    const female = rand() < 0.55;
    const child = i % 7 === 0;
    const ageYears = child ? 1 + Math.floor(rand() * 12) : 18 + Math.floor(rand() * 60);
    const dob = new Date(Date.UTC(Number(year) - ageYears, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));
    const firstName = pick(female ? FIRST_F : FIRST_M);
    const lastName = pick(LAST);
    patients.push({
      patientNo: `P-${year}-${String(i).padStart(5, '0')}`,
      firstName,
      lastName,
      dateOfBirth: dob,
      sex: female ? 'female' : 'male',
      nationalId: child ? undefined : String(20000000 + Math.floor(rand() * 19999999)),
      phone: `+2547${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
      email: i % 3 === 0 ? `${firstName}.${lastName}${i}@example.com`.toLowerCase() : undefined,
      address: pick(TOWNS),
      emergencyContact: { name: `${pick(FIRST_F)} ${lastName}`, relationship: child ? 'Parent' : pick(['Spouse', 'Sibling', 'Parent']),
        phone: `+2547${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}` },
      allergies: rand() < 0.2 ? [pick(ALLERGIES)] : [],
      chronicConditions: !child && rand() < 0.25 ? [pick(CHRONIC)] : [],
      bloodGroup: pick(['A+', 'B+', 'O+', 'O+', 'AB+', 'A-', 'O-']),
      createdBy: reception._id,
    });
  }
  const patientDocs = await M.Patient.insertMany(patients);
  await M.Counter.create({ _id: `patientNo:${year}`, seq: patientDocs.length });
  log(`  ✓ ${patientDocs.length} patients`);

  /* ---------- patient portal accounts (created by reception) ---------- */
  const portalPatients = [patientDocs[0], patientDocs[1]];
  const portalUsers = await M.User.insertMany(
    portalPatients.map((p, i) => ({
      role: 'patient', firstName: p.firstName, lastName: p.lastName, phone: p.phone,
      email: i === 0 ? 'patient@clinic.test' : 'patient2@clinic.test', passwordHash, patientId: p._id,
    })),
  );
  for (let i = 0; i < portalPatients.length; i++) {
    await M.Patient.updateOne({ _id: portalPatients[i]._id }, { userId: portalUsers[i]._id });
  }
  log(`  ✓ ${portalUsers.length} patient portal accounts`);

  /* ---------- catalogues ---------- */
  await M.LabTest.insertMany(LAB_TESTS.map(([code, name, sampleType, unit, refRange]) => ({ code, name, sampleType, unit, refRange })));
  await M.Medication.insertMany(
    MEDICATIONS.map(([name, strength, form, stockQty, reorderLevel, clinicianMayPrescribe]) => ({
      name, strength, form, stockQty, reorderLevel, clinicianMayPrescribe, unit: form === 'Suspension' || form === 'Inhaler' ? 'bottles' : 'units',
    })),
  );
  log(`  ✓ ${LAB_TESTS.length} lab tests, ${MEDICATIONS.length} medications`);

  /* ---------- appointments: today + next 7 days ---------- */
  const appointments = [];
  let aptSeq = 0;
  const usedPatientsAt = new Set();
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const date = addDays(today, dayOffset);
    const dow = weekdayOf(date);
    for (const doc of doctors) {
      const { availability, slotMinutes } = doc.staffProfile;
      for (const block of availability.filter((a) => a.dayOfWeek === dow)) {
        for (let m = timeToMinutes(block.start); m + slotMinutes <= timeToMinutes(block.end); m += slotMinutes) {
          if (rand() > (dayOffset === 0 ? 0.45 : 0.3)) continue; // leave most slots free
          const startAt = clinicDateTimeToUtc(date, minutesToTime(m));
          let patient;
          for (let tries = 0; tries < 10; tries++) {
            patient = pick(patientDocs);
            if (!usedPatientsAt.has(`${patient._id}|${startAt.toISOString()}`) && !usedPatientsAt.has(`${patient._id}|${date}`)) break;
          }
          usedPatientsAt.add(`${patient._id}|${startAt.toISOString()}`);
          usedPatientsAt.add(`${patient._id}|${date}`);
          aptSeq++;
          appointments.push({
            appointmentNo: `APT-${year}-${String(aptSeq).padStart(5, '0')}`,
            patientId: patient._id,
            doctorId: doc._id,
            startAt,
            endAt: new Date(startAt.getTime() + slotMinutes * 60000),
            reason: pick(REASONS),
            status: 'scheduled',
            isActive: true,
            bookedBy: { userId: reception._id, channel: 'reception' },
            statusHistory: [{ status: 'scheduled', at: new Date(), by: reception._id }],
          });
        }
      }
    }
  }
  await M.Appointment.insertMany(appointments);
  await M.Counter.create({ _id: `appointmentNo:${year}`, seq: aptSeq });
  log(`  ✓ ${appointments.length} appointments (today and the next 7 days)`);

  return { staff, patients: patientDocs };
}

if (process.argv[1].endsWith('seed.js')) {
  await connectDB();
  console.log(`Seeding database "${mongoose.connection.name}" with synthetic data…`);
  await seed();
  await disconnectDB();
  console.log(`Done. All demo accounts use the password: ${DEMO_PASSWORD}`);
}
