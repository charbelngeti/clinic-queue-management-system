import { User, Appointment } from '../models/index.js';
import { clinicDateTimeToUtc, clinicDayRange, weekdayOf, timeToMinutes, minutesToTime, clinicDate } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/errors.js';

export async function listDoctors() {
  return User.find({ role: 'doctor', isActive: true })
    .select('firstName lastName staffProfile.specialization staffProfile.room staffProfile.availability staffProfile.slotMinutes staffProfile.unavailableDates')
    .sort({ lastName: 1 });
}

export async function getDoctor(id) {
  const doc = await User.findOne({ _id: id, role: 'doctor' });
  if (!doc) throw notFound('Doctor');
  return doc;
}

/** FR-DOC-01: admin maintains a doctor's weekly availability template. */
export async function updateAvailability(id, { availability, slotMinutes, unavailableDates }) {
  for (const a of availability) {
    if (timeToMinutes(a.start) >= timeToMinutes(a.end)) throw badRequest(`On day ${a.dayOfWeek}, start time must be before end time.`);
  }
  // reject overlapping blocks on the same day
  for (let d = 0; d < 7; d++) {
    const blocks = availability.filter((a) => a.dayOfWeek === d).sort((x, y) => timeToMinutes(x.start) - timeToMinutes(y.start));
    for (let i = 1; i < blocks.length; i++) {
      if (timeToMinutes(blocks[i].start) < timeToMinutes(blocks[i - 1].end)) throw badRequest('Availability blocks on the same day must not overlap.');
    }
  }
  const doc = await getDoctor(id);
  doc.staffProfile = {
    ...(doc.staffProfile?.toObject?.() || {}),
    availability,
    slotMinutes,
    unavailableDates: [...new Set(unavailableDates || [])].sort(),
  };
  await doc.save();
  return doc;
}

/** All slot start times ("HH:MM") a doctor works on a date, from the weekly template. */
export function templateSlots(doctor, dateStr) {
  const sp = doctor.staffProfile || {};
  if (!sp.availability?.length || !sp.slotMinutes) return [];
  if ((sp.unavailableDates || []).includes(dateStr)) return [];
  const dow = weekdayOf(dateStr);
  const slots = [];
  for (const block of sp.availability.filter((a) => a.dayOfWeek === dow)) {
    for (let m = timeToMinutes(block.start); m + sp.slotMinutes <= timeToMinutes(block.end); m += sp.slotMinutes) {
      slots.push(minutesToTime(m));
    }
  }
  return slots;
}

/** FR-DOC-02: free slots = template slots − active booked appointments − past times. */
export async function availableSlots(doctorId, dateStr) {
  const doctor = await getDoctor(doctorId);
  const slots = templateSlots(doctor, dateStr);
  const { start, end } = clinicDayRange(dateStr);
  const booked = await Appointment.find({ doctorId, isActive: true, startAt: { $gte: start, $lt: end } }).select('startAt');
  const bookedSet = new Set(booked.map((a) => a.startAt.getTime()));
  const now = Date.now();
  return {
    doctor: { _id: doctor._id, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, slotMinutes: doctor.staffProfile?.slotMinutes },
    date: dateStr,
    isToday: dateStr === clinicDate(),
    slots: slots.map((time) => {
      const at = clinicDateTimeToUtc(dateStr, time);
      const status = bookedSet.has(at.getTime()) ? 'booked' : at.getTime() <= now ? 'past' : 'free';
      return { time, startAt: at, status };
    }),
  };
}
