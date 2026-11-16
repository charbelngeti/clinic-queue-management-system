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

export async function seed({ log = console.log, withLiveQueue = false } = {}) {
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

  const hist = await seedHistory({ staff, patients: patientDocs, today, year, aptSeq });
  log(`  ✓ ${hist.visits} completed past visits over 14 days (${hist.labs} lab requests, ${hist.rx} prescriptions, ${hist.missed} missed/cancelled appointments)`);
  if (withLiveQueue) {
    const n = await seedLiveQueue({ staff, patients: patientDocs, today });
    log(`  ✓ ${n} patients already waiting today (live queue for the demo)`);
  }

  return { staff, patients: patientDocs };
}

const minutes = (d, m) => new Date(d.getTime() + m * 60000);
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const normalVitals = () => {
  const weight = between(48, 95);
  const height = between(150, 185);
  return {
    temperature: Math.round((36.2 + rand() * 1.2) * 10) / 10,
    systolic: between(105, 138), diastolic: between(65, 88), pulse: between(62, 96), respRate: between(14, 20), spo2: between(95, 99),
    weight, height, bmi: Math.round((weight / (height / 100) ** 2) * 10) / 10,
  };
};
const COMPLAINTS = [
  ['Fever and headache', 'Malaria (confirmed)', ['MPS', 'FBC'], ['Artemether/Lumefantrine', 'Paracetamol']],
  ['Cough and sore throat', 'Upper respiratory tract infection', null, ['Amoxicillin', 'Paracetamol']],
  ['Burning urination', 'Urinary tract infection', ['UA'], ['Ciprofloxacin']],
  ['Epigastric pain', 'Gastritis', ['HPYL'], ['Omeprazole']],
  ['Blood pressure review', 'Essential hypertension, controlled', null, ['Amlodipine']],
  ['Diabetes review', 'Type 2 diabetes mellitus', ['RBS', 'HBA1C'], ['Metformin']],
  ['Diarrhoea for 2 days', 'Acute gastroenteritis', ['STOOL'], ['Oral Rehydration Salts', 'Zinc Sulphate']],
  ['Skin rash and itching', 'Allergic dermatitis', null, ['Cetirizine']],
  ['Back pain', 'Mechanical low back pain', null, ['Paracetamol']],
  ['General check-up', 'Healthy adult, no acute illness', ['FBC'], null],
];

/** 14 days of completed visits so that reports, history panels and the portal have realistic content. */
async function seedHistory({ staff, patients, today, year, aptSeq }) {
  const role = (r) => staff.filter((u) => u.role === r);
  const [doctors, clinicians, nurses, labs, pharms] = ['doctor', 'clinician', 'nurse', 'lab_tech', 'pharmacist'].map(role);
  const reception = staff.find((u) => u.role === 'receptionist');
  const tests = await M.LabTest.find();
  const meds = await M.Medication.find();
  const visits = [], appts = [], consults = [], labReqs = [], rxs = [];
  let visitSeq = 0, labSeq = 0, rxSeq = 0, missed = 0;

  for (let back = 14; back >= 1; back--) {
    const date = addDays(today, -back);
    if (weekdayOf(date) === 0) continue; // closed on Sundays
    const used = new Set();
    const tickets = { A: 0, W: 0 };
    const n = between(6, 12);
    for (let i = 0; i < n; i++) {
      let patient = i === 0 && back % 4 === 1 ? patients[0] : pick(patients); // give the portal demo patient some history
      while (used.has(String(patient._id))) patient = pick(patients);
      used.add(String(patient._id));
      const isAppt = rand() < 0.6;
      const doctor = pick(doctors);
      const arrival = clinicDateTimeToUtc(date, minutesToTime(8 * 60 + i * 25 + between(0, 10)));
      const visitId = new mongoose.Types.ObjectId();
      let apptId;
      const prefix = isAppt ? 'A' : 'W';
      tickets[prefix]++;
      if (isAppt) {
        apptId = new mongoose.Types.ObjectId();
        const startAt = clinicDateTimeToUtc(date, minutesToTime(8 * 60 + i * 25));
        appts.push({
          _id: apptId, appointmentNo: `APT-${year}-${String(++aptSeq).padStart(5, '0')}`, patientId: patient._id, doctorId: doctor._id,
          startAt, endAt: minutes(startAt, 20), reason: pick(REASONS), status: 'completed', isActive: false, visitId,
          bookedBy: { userId: reception._id, channel: 'reception' },
          statusHistory: [{ status: 'scheduled', at: minutes(startAt, -3 * 1440), by: reception._id }, { status: 'checked_in', at: arrival, by: reception._id }, { status: 'completed', at: minutes(arrival, 90), by: doctor._id }],
        });
      }
      // walk through the departments with realistic waiting and service times
      const [complaint, diagnosis, labCodes, medNames] = pick(COMPLAINTS);
      const consultant = isAppt || rand() < 0.5 ? doctor : pick(clinicians);
      const history = [];
      let t = arrival;
      const stage = (name, servedBy, wait, service) => {
        const entered = t;
        const calledAt = minutes(entered, wait);
        const leftAt = minutes(calledAt, service);
        history.push({ stage: name, enteredAt: entered, calledAt, leftAt, servedBy: servedBy._id });
        t = leftAt;
        return { entered, calledAt, leftAt };
      };
      const triaged = rand() < 0.8;
      let triage;
      if (triaged) {
        const nurse = pick(nurses);
        const s = stage('triage', nurse, between(3, 18), between(4, 9));
        triage = { vitals: normalVitals(), flags: [], complaint, recordedBy: nurse._id, recordedAt: s.leftAt };
      }
      stage('consultation', consultant, between(8, 35), between(8, 20));
      const consultId = new mongoose.Types.ObjectId();
      consults.push({
        _id: consultId, visitId, patientId: patient._id, clinicianId: consultant._id, clinicianRole: consultant.role,
        clinicianName: `${consultant.role === 'doctor' ? 'Dr. ' : ''}${consultant.firstName} ${consultant.lastName}`,
        chiefComplaint: complaint, examination: 'Alert, not in distress. Findings consistent with history.', diagnosis, plan: medNames ? 'Medication as prescribed; review if not improving.' : 'Reassurance and advice.',
        status: 'final', finalizedAt: t, createdAt: history.at(-1).calledAt, updatedAt: t,
      });
      if (labCodes) {
        const lab = pick(labs);
        const requestedAt = t;
        const s = stage('lab', lab, between(5, 20), between(15, 40));
        const reqTests = tests.filter((x) => labCodes.includes(x.code));
        labReqs.push({
          requestNo: `LAB-${year}-${String(++labSeq).padStart(5, '0')}`, visitId, patientId: patient._id, requestedBy: consultant._id,
          requestedByName: consults.at(-1).clinicianName, status: 'completed', priority: 'routine',
          tests: reqTests.map((x) => ({ testId: x._id, code: x.code, name: x.name, result: { value: x.code === 'MPS' ? 'P. falciparum seen (+)' : 'Within normal limits', unit: x.unit, refRange: x.refRange, flag: x.code === 'MPS' ? 'high' : 'normal' } })),
          sampleCollectedAt: minutes(s.calledAt, 3), sampleCollectedBy: lab._id, completedBy: lab._id, completedByName: `${lab.firstName} ${lab.lastName}`,
          completedAt: s.leftAt, reviewedAt: minutes(s.leftAt, 15), createdAt: requestedAt, updatedAt: s.leftAt,
        });
        stage('consultation', consultant, between(3, 12), between(4, 8)); // review results
      }
      if (medNames) {
        const pharm = pick(pharms);
        const prescribedAt = t;
        const s = stage('pharmacy', pharm, between(4, 15), between(3, 8));
        const items = medNames.map((nm) => meds.find((m) => m.name === nm)).filter(Boolean).map((m) => {
          const qty = between(6, 30);
          return { medicationId: m._id, name: m.name, strength: m.strength, form: m.form, dose: '1 tablet', frequency: 'TDS (3× daily)', durationDays: 5, quantity: qty, dispensedQty: qty };
        });
        rxs.push({
          rxNo: `RX-${year}-${String(++rxSeq).padStart(5, '0')}`, visitId, patientId: patient._id, status: 'dispensed', items,
          prescriber: { userId: consultant._id, name: consults.at(-1).clinicianName, role: consultant.role, licenseNo: consultant.staffProfile?.licenseNo },
          dispensedBy: pharm._id, dispensedByName: `${pharm.firstName} ${pharm.lastName}`, dispensedAt: s.leftAt, createdAt: prescribedAt, updatedAt: s.leftAt,
        });
      }
      visits.push({
        _id: visitId, visitNo: `V-${year}-${String(++visitSeq).padStart(6, '0')}`, ticketNo: `${prefix}-${String(tickets[prefix]).padStart(3, '0')}`,
        clinicDate: date, patientId: patient._id, appointmentId: apptId, doctorId: isAppt ? doctor._id : undefined, type: isAppt ? 'appointment' : 'walk_in',
        stage: 'done', queueStatus: 'completed', isActive: false, priority: 'normal', priorityRank: 2, queueTime: arrival,
        consultedBy: consultant._id, triage, stageHistory: history, completedAt: t, createdBy: reception._id, createdAt: arrival, updatedAt: t,
      });
    }
    // a couple of missed / cancelled appointments per day (for the no-show rate)
    for (let k = 0; k < between(1, 3); k++) {
      const patient = pick(patients);
      const startAt = clinicDateTimeToUtc(date, minutesToTime(14 * 60 + k * 20));
      const status = rand() < 0.6 ? 'no_show' : 'cancelled';
      appts.push({
        appointmentNo: `APT-${year}-${String(++aptSeq).padStart(5, '0')}`, patientId: patient._id, doctorId: pick(doctors)._id, startAt, endAt: minutes(startAt, 20),
        reason: pick(REASONS), status, isActive: false, bookedBy: { userId: reception._id, channel: 'reception' },
        statusHistory: [{ status: 'scheduled', at: minutes(startAt, -2 * 1440), by: reception._id }, { status, at: minutes(startAt, status === 'no_show' ? 60 : -600), by: reception._id, note: status === 'no_show' ? 'Patient did not attend' : 'Cancelled by patient: unable to attend' }],
        cancellation: status === 'cancelled' ? { at: minutes(startAt, -600), by: reception._id, reason: 'Unable to attend' } : undefined,
      });
      missed++;
    }
  }
  // timestamps: false keeps the historical createdAt/updatedAt values instead of "now"
  await M.Appointment.insertMany(appts);
  await M.Visit.collection.insertMany(visits.map((v) => JSON.parse(JSON.stringify(v), reviveDates)));
  await M.Consultation.collection.insertMany(consults.map((c) => JSON.parse(JSON.stringify(c), reviveDates)));
  if (labReqs.length) await M.LabRequest.collection.insertMany(labReqs.map((l) => JSON.parse(JSON.stringify(l), reviveDates)));
  if (rxs.length) await M.Prescription.collection.insertMany(rxs.map((r) => JSON.parse(JSON.stringify(r), reviveDates)));
  await M.Counter.updateOne({ _id: `appointmentNo:${year}` }, { $set: { seq: aptSeq } });
  await M.Counter.create([{ _id: `visitNo:${year}`, seq: visitSeq }, { _id: `labRequestNo:${year}`, seq: labSeq }, { _id: `rxNo:${year}`, seq: rxSeq }]);
  return { visits: visits.length, labs: labReqs.length, rx: rxs.length, missed };
}

// Raw driver inserts bypass Mongoose casting, so restore ObjectIds and Dates after the JSON round trip.
const OID = /^[a-f0-9]{24}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function reviveDates(key, value) {
  if (typeof value !== 'string') return value;
  if (ISO.test(value)) return new Date(value);
  if (OID.test(value) && key !== 'clinicDate') return new mongoose.Types.ObjectId(value);
  return value;
}

/** A few walk-ins already waiting today, so the queues and the display look alive at the start of a demo. */
async function seedLiveQueue({ staff, patients, today }) {
  const year = today.slice(0, 4);
  const nurse = staff.find((u) => u.role === 'nurse');
  const reception = staff.find((u) => u.role === 'receptionist');
  const chosen = patients.slice(-5); // last registered patients, avoids today's appointment holders where possible
  const now = Date.now();
  let visitSeq = (await M.Counter.findById(`visitNo:${year}`))?.seq || 0;
  const docs = chosen.map((p, i) => {
    const atConsult = i >= 3;
    const queueTime = new Date(now - (25 - i * 4) * 60000);
    const history = atConsult
      ? [{ stage: 'triage', enteredAt: queueTime, calledAt: minutes(queueTime, 6), leftAt: minutes(queueTime, 12), servedBy: nurse._id }, { stage: 'consultation', enteredAt: minutes(queueTime, 12) }]
      : [{ stage: 'triage', enteredAt: queueTime }];
    return {
      visitNo: `V-${year}-${String(++visitSeq).padStart(6, '0')}`, ticketNo: `W-${String(i + 1).padStart(3, '0')}`, clinicDate: today, patientId: p._id, type: 'walk_in',
      stage: atConsult ? 'consultation' : 'triage', queueStatus: 'waiting', isActive: true, priority: i === 1 ? 'urgent' : 'normal', priorityRank: i === 1 ? 1 : 2,
      queueTime, assignedTo: null, stageHistory: history, createdBy: reception._id,
      triage: atConsult ? { vitals: normalVitals(), flags: [], complaint: pick(COMPLAINTS)[0], recordedBy: nurse._id, recordedAt: minutes(queueTime, 12) } : undefined,
    };
  });
  await M.Visit.insertMany(docs);
  await M.Counter.updateOne({ _id: `visitNo:${year}` }, { $set: { seq: visitSeq } }, { upsert: true });
  await M.Counter.create({ _id: `ticket:${today}:W`, seq: docs.length });
  return docs.length;
}

if (process.argv[1].endsWith('seed.js')) {
  await connectDB();
  console.log(`Seeding database "${mongoose.connection.name}" with synthetic data…`);
  await seed({ withLiveQueue: true });
  await disconnectDB();
  console.log(`Done. All demo accounts use the password: ${DEMO_PASSWORD}`);
}
