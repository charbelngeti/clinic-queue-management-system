// Patient portal (FR-POR-01..03, FR-QUE-10): live queue status, appointments, booking and cancellation.
import { api } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, promptDialog } from '../ui/feedback.js';
import { fmtDate, fmtTime, fmtWeekday, statusBadge, stageLabel } from '../ui/format.js';
import { openBookingDialog } from '../components/booking.js';

const STEPS = ['triage', 'consultation', 'lab', 'pharmacy'];

export async function render(root, { user }) {
  mount(
    root,
    html`<div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><h2 class="text-2xl font-bold tracking-tight text-slate-900">Hello, ${user.firstName}</h2>
          <p class="text-sm text-slate-500">${fmtWeekday(new Date())}</p></div>
        <button id="book" class="btn btn-primary">${icon('calendarPlus', 'h-4 w-4')}Book an appointment</button>
      </div>
      <section id="visit"></section>
      <div class="card">
        <div class="card-header"><h3 class="card-title">Upcoming appointments</h3></div>
        <ul id="upcoming" class="divide-y divide-slate-100"></ul>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">Past & cancelled appointments</h3></div>
        <ul id="past" class="divide-y divide-slate-100"></ul>
      </div>
    </div>`,
  );

  async function loadVisit() {
    try {
      const { visit } = await api.get('/me/visit');
      if (!visit) {
        return mount(
          $('#visit', root),
          html`<div class="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            ${icon('info', 'h-6 w-6 text-slate-400')}<p>You are not checked in today. When you arrive, reception will check you in and your queue position will appear here.</p></div>`,
        );
      }
      const idx = STEPS.indexOf(visit.stage);
      const called = visit.queueStatus === 'called';
      mount(
        $('#visit', root),
        html`<div class="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-pop">
          <div class="flex flex-wrap items-center gap-6 p-6">
            <div><p class="text-sm text-brand-100">Your ticket</p><p class="font-mono text-5xl font-black tracking-tight">${visit.ticketNo}</p></div>
            <div class="flex-1">
              ${called
                ? html`<p class="text-2xl font-bold">It's your turn: please go to ${visit.room || stageLabel(visit.stage)}</p>`
                : visit.queueStatus === 'waiting'
                  ? html`<p class="text-2xl font-bold">${visit.position === 1 ? 'You are next' : `${visit.position} in line`} for ${stageLabel(visit.stage)}</p>
                      <p class="text-sm text-brand-100">Please stay nearby and watch the “Who's Next” screen.</p>`
                  : html`<p class="text-2xl font-bold">You are being seen at ${stageLabel(visit.stage)}</p>`}
              ${visit.assignedTo ? html`<p class="mt-1 text-sm text-brand-100">With ${visit.assignedTo}</p>` : ''}
            </div>
          </div>
          <ol class="grid grid-cols-4 border-t border-white/15 text-center text-xs">
            ${STEPS.map(
              (s, i) => html`<li class="px-2 py-3 ${i === idx ? 'bg-white/15 font-semibold' : i < idx ? 'text-brand-100' : 'text-brand-200/70'}">
                ${i < idx ? '✓ ' : ''}${stageLabel(s)}</li>`,
            )}
          </ol>
        </div>`,
      );
    } catch (err) {
      if (err.status !== 401) toastError(err);
    }
  }

  async function loadAppointments() {
    try {
      const { appointments } = await api.get('/appointments');
      const now = Date.now();
      const upcoming = appointments.filter((a) => a.status === 'scheduled' && new Date(a.startAt) > now).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      const past = appointments.filter((a) => !upcoming.includes(a));
      const item = (a, canCancel) => {
        const last = a.statusHistory?.[a.statusHistory.length - 1];
        return html`<li class="flex flex-wrap items-center gap-4 px-5 py-4">
          <div class="w-16 rounded-xl bg-slate-100 py-2 text-center"><p class="text-xs text-slate-500 uppercase">${fmtDate(a.startAt).split(' ')[1]}</p><p class="text-xl font-bold text-slate-900">${fmtDate(a.startAt).split(' ')[0]}</p></div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-slate-900">${fmtTime(a.startAt)} · Dr. ${a.doctorId.firstName} ${a.doctorId.lastName}</p>
            <p class="text-sm text-slate-500">${a.doctorId.staffProfile?.specialization || ''}${a.reason ? ` · ${a.reason}` : ''}</p>
            ${last?.note && ['cancelled', 'no_show'].includes(a.status) ? html`<p class="mt-1 text-xs text-slate-500">${last.note}</p>` : ''}
          </div>
          ${statusBadge(a.status)}
          ${canCancel ? html`<button class="btn btn-ghost btn-sm text-rose-600" data-cancel="${a._id}">Cancel</button>` : ''}
        </li>`;
      };
      mount($('#upcoming', root), upcoming.length ? upcoming.map((a) => item(a, true)) : html`<li class="px-5 py-8 text-center text-sm text-slate-500">No upcoming appointments.</li>`);
      mount($('#past', root), past.length ? past.slice(0, 15).map((a) => item(a, false)) : html`<li class="px-5 py-8 text-center text-sm text-slate-500">Nothing here yet.</li>`);
    } catch (err) {
      toastError(err);
    }
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cancel]');
    if (!b) return;
    const reason = await promptDialog({ title: 'Cancel appointment', label: 'Reason', confirmText: 'Cancel appointment', danger: true });
    if (!reason) return;
    try {
      await api.post(`/appointments/${b.dataset.cancel}/cancel`, { reason });
      toast('Appointment cancelled.');
      loadAppointments();
    } catch (err) {
      toastError(err);
    }
  });
  $('#book', root).onclick = () => openBookingDialog({ selfBooking: true, onBooked: loadAppointments });

  await Promise.all([loadVisit(), loadAppointments()]);
  const timer = setInterval(loadVisit, 10000);
  return () => clearInterval(timer);
}
