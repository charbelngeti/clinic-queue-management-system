// Reception / admin operational dashboard (FR-RPT-01): today's appointments and live queue at a glance.
import { api, qs } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toastError } from '../ui/feedback.js';
import { fullName, fmtTime, statusBadge, clinicToday, fmtWeekday } from '../ui/format.js';
import { openBookingDialog, openCheckInDialog, patientPicker } from '../components/booking.js';
import { openPatientForm } from '../components/patient-form.js';
import { navigate } from '../app.js';

const stat = (label, value, ic, tone, hint = '') => html`<div class="stat">
  <div><p class="stat-label">${label}</p><p class="stat-value">${value}</p>${hint ? html`<p class="mt-1 text-xs text-slate-500">${hint}</p>` : ''}</div>
  <span class="flex h-10 w-10 items-center justify-center rounded-xl ${tone}">${icon(ic)}</span>
</div>`;

export async function render(root, { user }) {
  const isReception = user.role === 'receptionist';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Nairobi' }).format(new Date()));
  mount(
    root,
    html`<div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-900">${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${user.firstName}</h2>
          <p class="text-sm text-slate-500">${fmtWeekday(new Date())} · here is the clinic at a glance.</p>
        </div>
        ${isReception
          ? html`<div class="flex flex-wrap gap-2">
              <button class="btn btn-secondary" data-act="register">${icon('userPlus', 'h-4 w-4')}Register patient</button>
              <button class="btn btn-secondary" data-act="book">${icon('calendarPlus', 'h-4 w-4')}Book appointment</button>
              <button class="btn btn-primary" data-act="walkin">${icon('queue', 'h-4 w-4')}Walk-in check-in</button>
            </div>`
          : ''}
      </div>
      <div id="stats" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${[1, 2, 3, 4].map(() => html`<div class="skeleton h-28"></div>`)}</div>
      <div class="grid gap-5 xl:grid-cols-3">
        <div class="card xl:col-span-2">
          <div class="card-header"><h3 class="card-title">Today's appointments</h3><a href="#/appointments" class="text-sm font-semibold text-brand-700 hover:underline">View all</a></div>
          <div class="overflow-x-auto"><table class="table"><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th></th></tr></thead><tbody id="appts"></tbody></table></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Live queues</h3><a href="#/queue" class="text-sm font-semibold text-brand-700 hover:underline">Open board</a></div>
          <ul id="queues" class="divide-y divide-slate-100"></ul>
        </div>
      </div>
    </div>`,
  );

  async function load() {
    try {
      const today = clinicToday();
      const [{ appointments }, board] = await Promise.all([api.get(`/appointments${qs({ date: today })}`), api.get('/queue/board')]);
      const by = (s) => appointments.filter((a) => a.status === s).length;
      const active = Object.values(board.stages).flat();
      mount(
        $('#stats', root),
        html`${stat("Today's appointments", appointments.length, 'calendar', 'bg-sky-50 text-sky-600', `${by('scheduled')} still expected`)}
          ${stat('Checked in today', by('checked_in') + by('completed'), 'check', 'bg-violet-50 text-violet-600', `${by('no_show')} no-show · ${by('cancelled')} cancelled`)}
          ${stat('Patients in clinic now', active.length, 'users', 'bg-brand-50 text-brand-600', `${active.filter((v) => v.queueStatus === 'waiting').length} waiting`)}
          ${stat('Visits completed', board.completedToday, 'checkCircle', 'bg-emerald-50 text-emerald-600', 'today')}`,
      );
      const upcoming = appointments.filter((a) => ['scheduled', 'checked_in'].includes(a.status)).slice(0, 8);
      mount(
        $('#appts', root),
        upcoming.length
          ? upcoming.map(
              (a) => html`<tr>
                <td class="font-semibold">${fmtTime(a.startAt)}</td>
                <td><a class="font-medium hover:text-brand-700" href="#/patients/${a.patientId._id}">${fullName(a.patientId)}</a><p class="text-xs text-slate-500">${a.patientId.patientNo}</p></td>
                <td class="text-slate-600">Dr. ${a.doctorId.lastName}</td>
                <td>${statusBadge(a.status)}</td>
                <td class="text-right">${isReception && a.status === 'scheduled' ? html`<button class="btn btn-primary btn-sm" data-checkin="${a._id}">Check in</button>` : ''}</td>
              </tr>`,
            )
          : html`<tr><td colspan="5" class="py-10 text-center text-slate-500">No more appointments expected today.</td></tr>`,
      );
      root.querySelectorAll('[data-checkin]').forEach((b) => (b.onclick = () => openCheckInDialog({ appointment: appointments.find((a) => a._id === b.dataset.checkin), onDone: load })));
      const STAGES = [['triage', 'Triage', 'heart'], ['consultation', 'Consultation', 'stethoscope'], ['lab', 'Laboratory', 'flask'], ['pharmacy', 'Pharmacy', 'pill']];
      mount(
        $('#queues', root),
        STAGES.map(([k, label, ic]) => {
          const list = board.stages[k] || [];
          const waiting = list.filter((v) => v.queueStatus === 'waiting').length;
          return html`<li class="flex items-center gap-3 px-5 py-4">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">${icon(ic, 'h-4 w-4')}</span>
            <div class="flex-1"><p class="text-sm font-semibold text-slate-900">${label}</p><p class="text-xs text-slate-500">${list.length - waiting} being served</p></div>
            <span class="text-2xl font-bold text-slate-900">${waiting}</span><span class="text-xs text-slate-500">waiting</span>
          </li>`;
        }),
      );
    } catch (err) {
      if (err.status !== 401) toastError(err);
    }
  }

  if (isReception) {
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'register') openPatientForm({ onSaved: (p) => navigate(`/patients/${p._id}`) });
      if (act === 'book') openBookingDialog({ onBooked: load });
      if (act === 'walkin') openWalkIn(load);
    });
  }
  await load();
  const timer = setInterval(load, 15000);
  return () => clearInterval(timer);
}

async function openWalkIn(onDone) {
  const { openModal } = await import('../ui/feedback.js');
  const { el, close } = openModal({
    title: 'Walk-in check-in',
    subtitle: 'Find the patient. New patients must be registered first.',
    size: 'md',
    content: html`<div class="space-y-4 p-5"><div data-picker></div>
      <p class="text-xs text-slate-500">Not registered yet? <button type="button" class="font-semibold text-brand-700 hover:underline" data-register>Register a new patient</button></p></div>`,
  });
  patientPicker($('[data-picker]', el), (p) => {
    close();
    openCheckInDialog({ patient: p, onDone });
  });
  $('[data-register]', el).onclick = () => {
    close();
    openPatientForm({ onSaved: (p) => openCheckInDialog({ patient: p, onDone }) });
  };
}
