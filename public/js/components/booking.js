// Shared components: patient picker, appointment booking (with slot grid) and check-in dialogs.
import { api, qs } from '../api.js';
import { html, mount, $, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy } from '../ui/feedback.js';
import { fullName, fmtDate, fmtTime, age, sexShort, clinicToday, fmtWeekday } from '../ui/format.js';

/** Search-as-you-type patient picker. Calls onPick(patient). */
export function patientPicker(container, onPick, { placeholder = 'Search by name, patient no., phone or ID…' } = {}) {
  mount(
    container,
    html`<div class="relative">
      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">${icon('search', 'h-4 w-4')}</span>
      <input class="input pl-9" data-pp-input placeholder="${placeholder}" autocomplete="off" aria-label="Search patients" />
      <div data-pp-results class="absolute z-10 mt-1 hidden max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-pop"></div>
    </div>`,
  );
  const input = $('[data-pp-input]', container);
  const results = $('[data-pp-results]', container);
  let t;
  let last = [];
  const search = async () => {
    const q = input.value.trim();
    if (q.length < 2) return results.classList.add('hidden');
    try {
      const { patients } = await api.get(`/patients${qs({ q })}`);
      last = patients;
      results.classList.remove('hidden');
      mount(
        results,
        patients.length
          ? patients.map(
              (p) => html`<button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50" data-id="${p._id}">
                <span><span class="font-medium text-slate-900">${fullName(p)}</span>
                  <span class="block text-xs text-slate-500">${p.patientNo} · ${sexShort(p.sex)}, ${age(p.dateOfBirth)} y · ${p.phone}</span></span>
                ${icon('chevronRight', 'h-4 w-4 text-slate-400')}
              </button>`,
            )
          : html`<p class="px-3 py-3 text-sm text-slate-500">No matching patients.</p>`,
      );
    } catch (err) {
      toastError(err);
    }
  };
  input.oninput = () => {
    clearTimeout(t);
    t = setTimeout(search, 200);
  };
  results.onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = last.find((x) => x._id === b.dataset.id);
    results.classList.add('hidden');
    input.value = '';
    onPick(p);
  };
  input.focus();
}

/**
 * Book an appointment. For reception, `patient` may be preset or chosen with the picker.
 * For the patient portal, `selfBooking` hides the picker. Resolves after a successful booking.
 */
export function openBookingDialog({ patient = null, selfBooking = false, onBooked } = {}) {
  const state = { patient, doctorId: '', date: clinicToday(), time: '', doctors: [] };
  const { el, close } = openModal({
    title: 'Book appointment',
    subtitle: selfBooking ? 'Choose a doctor, a date and a free time slot.' : 'Select the patient, doctor and a free time slot.',
    size: 'lg',
    content: html`<form class="space-y-5 p-5" novalidate>
      ${selfBooking ? '' : html`<div data-field><label class="label">Patient</label><div data-patient></div><input type="hidden" name="patientId" /></div>`}
      <div class="grid gap-4 sm:grid-cols-2">
        <div data-field><label class="label" for="b-doctor">Doctor</label><select id="b-doctor" name="doctorId" class="input"><option value="">Loading…</option></select></div>
        <div data-field><label class="label" for="b-date">Date</label><input id="b-date" name="date" type="date" class="input" min="${clinicToday()}" value="${state.date}" /></div>
      </div>
      <div data-field>
        <div class="mb-1.5 flex items-center justify-between"><span class="label mb-0">Time slot</span><span data-slot-info class="text-xs text-slate-500"></span></div>
        <div data-slots class="grid grid-cols-4 gap-2 sm:grid-cols-6"></div>
        <input type="hidden" name="time" />
      </div>
      <div data-field><label class="label" for="b-reason">Reason for visit <span class="label-hint">(optional)</span></label>
        <input id="b-reason" name="reason" class="input" maxlength="300" placeholder="e.g. Blood pressure review" /></div>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button class="btn btn-primary" data-submit>${icon('calendarPlus', 'h-4 w-4')}Book appointment</button>
      </div>
    </form>`,
  });
  const form = $('form', el);

  function renderPatient() {
    if (selfBooking) return;
    const box = $('[data-patient]', form);
    if (state.patient) {
      mount(
        box,
        html`<div class="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <div><p class="text-sm font-semibold text-slate-900">${fullName(state.patient)}</p>
          <p class="text-xs text-slate-600">${state.patient.patientNo} · ${sexShort(state.patient.sex)}, ${age(state.patient.dateOfBirth)} y</p></div>
          <button type="button" class="btn btn-ghost btn-sm" data-change>Change</button>
        </div>`,
      );
      $('[data-change]', box).onclick = () => ((state.patient = null), renderPatient());
    } else {
      patientPicker(box, (p) => ((state.patient = p), renderPatient()));
    }
  }

  // Only the most recent request may update the grid: changing doctor and date quickly fires two
  // requests, and a slower, older response must not overwrite a newer one (race condition).
  let slotRequest = 0;
  async function loadSlots() {
    const requestId = ++slotRequest;
    const grid = $('[data-slots]', form);
    const info = $('[data-slot-info]', form);
    state.time = '';
    if (!state.doctorId || !state.date) {
      info.textContent = '';
      return mount(grid, html`<p class="col-span-full text-sm text-slate-500">Choose a doctor and date to see free slots.</p>`);
    }
    mount(grid, html`<div class="skeleton col-span-full h-10"></div>`);
    try {
      const data = await api.get(`/doctors/${state.doctorId}/slots${qs({ date: state.date })}`);
      if (requestId !== slotRequest) return; // a newer request is in flight
      const free = data.slots.filter((s) => s.status === 'free').length;
      info.textContent = data.slots.length ? `${fmtWeekday(data.slots[0].startAt)} · ${free} free · ${data.doctor.slotMinutes} min each` : '';
      mount(
        grid,
        data.slots.length
          ? data.slots.map((s) =>
              s.status === 'free'
                ? html`<button type="button" class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700" data-time="${s.time}">${s.time}</button>`
                : html`<span class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm text-slate-400 line-through" title="${s.status === 'booked' ? 'Already booked' : 'Time has passed'}">${s.time}</span>`,
            )
          : html`<p class="col-span-full rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">The doctor does not work on this day. Try another date.</p>`,
      );
    } catch (err) {
      toastError(err);
    }
  }

  $('[data-slots]', form).onclick = (e) => {
    const b = e.target.closest('[data-time]');
    if (!b) return;
    form.querySelectorAll('[data-time]').forEach((x) => x.classList.remove('!border-brand-600', '!bg-brand-600', '!text-white'));
    b.classList.add('!border-brand-600', '!bg-brand-600', '!text-white');
    state.time = b.dataset.time;
  };
  form.doctorId.onchange = (e) => ((state.doctorId = e.target.value), loadSlots());
  form.date.onchange = (e) => ((state.date = e.target.value), loadSlots());

  api
    .get('/doctors')
    .then(({ doctors }) => {
      state.doctors = doctors;
      mount(
        form.doctorId,
        html`<option value="">Select a doctor…</option>${doctors.map(
          (d) => html`<option value="${d._id}">Dr. ${d.firstName} ${d.lastName} — ${d.staffProfile?.specialization || 'General'}</option>`,
        )}`,
      );
    })
    .catch(toastError);

  renderPatient();
  loadSlots();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!selfBooking && !state.patient) errors.patientId = 'Choose a patient.';
    if (!state.doctorId) errors.doctorId = 'Choose a doctor.';
    if (!state.time) errors.time = 'Choose a free time slot.';
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    await withBusy($('[data-submit]', form), async () => {
      try {
        const { appointment } = await api.post('/appointments', {
          patientId: state.patient?._id,
          doctorId: state.doctorId,
          date: state.date,
          time: state.time,
          reason: form.reason.value.trim() || undefined,
        });
        toast(`Appointment ${appointment.appointmentNo} booked for ${fmtDate(appointment.startAt)} at ${state.time}.`);
        close();
        onBooked?.(appointment);
      } catch (err) {
        if (err.status === 409) loadSlots();
        if (err.details) showFieldErrors(form, err.details);
        toastError(err);
      }
    });
  };
}

/** Check in an appointment or a walk-in patient: choose the first stop (triage or consultation) and priority. */
export function openCheckInDialog({ appointment = null, patient = null, onDone } = {}) {
  const p = appointment?.patientId || patient;
  const { el, close } = openModal({
    title: appointment ? 'Check in appointment' : 'Register walk-in',
    subtitle: `${fullName(p)} · ${p.patientNo}`,
    size: 'md',
    content: html`<form class="space-y-5 p-5" novalidate>
      ${appointment
        ? html`<div class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">${icon('calendar', 'mr-1 inline h-4 w-4')}
            With <strong>Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}</strong> at ${fmtTime(appointment.startAt)}</div>`
        : ''}
      <fieldset>
        <legend class="label">First stop</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex cursor-pointer gap-3 rounded-lg border border-slate-300 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="firstStage" value="triage" checked class="mt-1 accent-brand-600" />
            <span><span class="block text-sm font-semibold text-slate-900">Nurse triage</span><span class="text-xs text-slate-500">Vitals first, then consultation</span></span>
          </label>
          <label class="flex cursor-pointer gap-3 rounded-lg border border-slate-300 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="firstStage" value="consultation" class="mt-1 accent-brand-600" />
            <span><span class="block text-sm font-semibold text-slate-900">Straight to consultation</span><span class="text-xs text-slate-500">${appointment ? 'Joins the booked doctor’s queue' : 'Joins the general consultation queue'}</span></span>
          </label>
        </div>
      </fieldset>
      <div data-field><label class="label" for="ci-priority">Priority</label>
        <select id="ci-priority" name="priority" class="input">
          <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
        </select>
        <p class="mt-1 text-xs text-slate-500">Nurses can change the priority after triage.</p></div>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button class="btn btn-primary" data-submit>${icon('check', 'h-4 w-4')}Check in &amp; issue ticket</button>
      </div>
    </form>`,
  });
  const form = $('form', el);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await withBusy($('[data-submit]', form), async () => {
      try {
        const { visit } = await api.post('/visits/check-in', {
          appointmentId: appointment?._id,
          patientId: appointment ? undefined : p._id,
          firstStage: form.querySelector('[name=firstStage]:checked').value,
          priority: form.priority.value,
        });
        close();
        showTicket(visit, p);
        onDone?.(visit);
      } catch (err) {
        toastError(err);
      }
    });
  };
}

function showTicket(visit, patient) {
  openModal({
    title: 'Patient checked in',
    size: 'sm',
    content: html`<div class="p-6 text-center">
      <p class="text-sm text-slate-500">Ticket number</p>
      <p class="mt-1 text-5xl font-black tracking-tight text-brand-700">${visit.ticketNo}</p>
      <p class="mt-3 text-sm text-slate-600">${fullName(patient)} → <strong>${visit.stage === 'triage' ? 'Nurse triage' : 'Consultation'}</strong></p>
      <p class="mt-1 text-xs text-slate-500">Ask the patient to watch the “Who's Next” screen.</p>
      <button class="btn btn-primary mt-6 w-full" data-close>Done</button>
    </div>`,
  });
}
