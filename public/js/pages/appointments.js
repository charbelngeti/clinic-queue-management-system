// FR-APT-01/05/07/08 + FR-QUE-01: appointment book for reception (admin: read-only, doctor: own schedule).
import { api, qs } from '../api.js';
import { html, mount, $, esc } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, promptDialog, confirmDialog, withBusy } from '../ui/feedback.js';
import { fullName, fmtTime, fmtWeekday, statusBadge, clinicToday, age, sexShort } from '../ui/format.js';
import { openBookingDialog, openCheckInDialog } from '../components/booking.js';

export async function render(root, { user }) {
  const isReception = user.role === 'receptionist';
  const isDoctor = user.role === 'doctor';
  const f = { date: clinicToday(), doctorId: '', status: '', q: '' };
  let doctors = [];

  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button class="btn-icon border border-slate-300 bg-white" id="prev" aria-label="Previous day">${icon('chevronLeft')}</button>
          <input type="date" id="date" class="input w-auto" value="${f.date}" aria-label="Date" />
          <button class="btn-icon border border-slate-300 bg-white" id="next" aria-label="Next day">${icon('chevronRight')}</button>
          <button class="btn btn-secondary btn-sm" id="today">Today</button>
        </div>
        ${isReception
          ? html`<div class="flex gap-2">
              <button id="bulk-noshow" class="btn btn-secondary">${icon('ban', 'h-4 w-4')}Mark past as no-show</button>
              <button id="book" class="btn btn-primary">${icon('calendarPlus', 'h-4 w-4')}Book appointment</button>
            </div>`
          : ''}
      </div>
      <div class="card">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <h3 id="day-label" class="mr-auto text-sm font-semibold text-slate-900"></h3>
          <input id="q" class="input w-56" placeholder="Filter by patient…" aria-label="Filter by patient" />
          ${isDoctor ? '' : html`<select id="doctor" class="input w-auto" aria-label="Doctor"><option value="">All doctors</option></select>`}
          <select id="status" class="input w-auto" aria-label="Status">
            <option value="">All statuses</option><option value="scheduled">Scheduled</option><option value="checked_in">Checked in</option>
            <option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option>
          </select>
        </div>
        <div id="summary" class="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3"></div>
        <div class="overflow-x-auto"><table class="table">
          <thead><tr><th>Time</th><th>Patient</th>${isDoctor ? '' : html`<th>Doctor</th>`}<th>Reason</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>
    </div>`,
  );

  async function load() {
    $('#day-label', root).textContent = fmtWeekday(`${f.date}T12:00:00`);
    try {
      const { appointments } = await api.get(`/appointments${qs(f)}`);
      const counts = appointments.reduce((acc, a) => ((acc[a.status] = (acc[a.status] || 0) + 1), acc), {});
      mount(
        $('#summary', root),
        html`<span class="badge badge-slate">${appointments.length} total</span>
          ${Object.entries(counts).map(([s, n]) => html`<span class="inline-flex items-center gap-1">${statusBadge(s)}<span class="text-xs font-semibold text-slate-600">${n}</span></span>`)}`,
      );
      const isToday = f.date === clinicToday();
      mount(
        $('#rows', root),
        appointments.length
          ? appointments.map(
              (a) => html`<tr>
                <td class="font-semibold text-slate-900">${fmtTime(a.startAt)}</td>
                <td><a href="#/patients/${a.patientId._id}" class="font-medium text-slate-900 hover:text-brand-700">${fullName(a.patientId)}</a>
                  <p class="text-xs text-slate-500">${a.patientId.patientNo} · ${sexShort(a.patientId.sex)}, ${age(a.patientId.dateOfBirth)} y</p></td>
                ${isDoctor ? '' : html`<td class="text-slate-600">Dr. ${a.doctorId.firstName} ${a.doctorId.lastName}</td>`}
                <td class="max-w-56 truncate text-slate-600" title="${a.reason || ''}">${a.reason || '—'}</td>
                <td>${statusBadge(a.status)}</td>
                <td class="text-right whitespace-nowrap">${isReception && a.status === 'scheduled'
                  ? html`${isToday ? html`<button class="btn btn-primary btn-sm" data-checkin="${a._id}">${icon('check', 'h-4 w-4')}Check in</button>` : ''}
                      ${new Date(a.startAt) < new Date() ? html`<button class="btn btn-ghost btn-sm" data-noshow="${a._id}">No-show</button>` : ''}
                      <button class="btn btn-ghost btn-sm text-rose-600" data-cancel="${a._id}">Cancel</button>`
                  : ''}</td>
              </tr>`,
            )
          : html`<tr><td colspan="6" class="py-12 text-center text-slate-500">No appointments for this day.</td></tr>`,
      );
      if (!isReception) return;
      root.querySelectorAll('[data-checkin]').forEach((b) => (b.onclick = () => openCheckInDialog({ appointment: appointments.find((a) => a._id === b.dataset.checkin), onDone: load })));
      root.querySelectorAll('[data-cancel]').forEach(
        (b) =>
          (b.onclick = async () => {
            const reason = await promptDialog({ title: 'Cancel appointment', label: 'Reason (visible to the patient)', confirmText: 'Cancel appointment', danger: true });
            if (!reason) return;
            try {
              await api.post(`/appointments/${b.dataset.cancel}/cancel`, { reason });
              toast('Appointment cancelled.');
              load();
            } catch (err) {
              toastError(err);
            }
          }),
      );
      root.querySelectorAll('[data-noshow]').forEach(
        (b) =>
          (b.onclick = async () => {
            if (!(await confirmDialog({ title: 'Mark as no-show?', message: 'The patient did not attend this appointment.', confirmText: 'Mark no-show' }))) return;
            try {
              await api.post(`/appointments/${b.dataset.noshow}/no-show`);
              toast('Marked as no-show.');
              load();
            } catch (err) {
              toastError(err);
            }
          }),
      );
    } catch (err) {
      toastError(err);
    }
  }

  const shift = (days) => {
    const d = new Date(`${f.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    f.date = d.toISOString().slice(0, 10);
    $('#date', root).value = f.date;
    load();
  };
  $('#prev', root).onclick = () => shift(-1);
  $('#next', root).onclick = () => shift(1);
  $('#today', root).onclick = () => (($('#date', root).value = f.date = clinicToday()), load());
  $('#date', root).onchange = (e) => ((f.date = e.target.value || clinicToday()), load());
  $('#status', root).onchange = (e) => ((f.status = e.target.value), load());
  let t;
  $('#q', root).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => ((f.q = e.target.value.trim()), load()), 250);
  };
  if (!isDoctor) {
    $('#doctor', root).onchange = (e) => ((f.doctorId = e.target.value), load());
    api.get('/doctors').then(({ doctors: d }) => {
      doctors = d;
      $('#doctor', root).insertAdjacentHTML(
        'beforeend',
        doctors.map((x) => `<option value="${esc(x._id)}">Dr. ${esc(x.firstName)} ${esc(x.lastName)}</option>`).join(''),
      );
    });
  }
  if (isReception) {
    $('#book', root).onclick = () => openBookingDialog({ onBooked: load });
    $('#bulk-noshow', root).onclick = async (e) => {
      const btn = e.currentTarget;
      if (!(await confirmDialog({ title: 'Mark no-shows', message: 'All of today’s appointments that are still “scheduled” more than 30 minutes after their start time will be marked as no-show.', confirmText: 'Mark no-shows' }))) return;
      await withBusy(btn, async () => {
        try {
          const { count } = await api.post('/appointments/no-show/bulk');
          toast(`${count} appointment(s) marked as no-show.`);
          load();
        } catch (err) {
          toastError(err);
        }
      });
    };
  }
  await load();
}
