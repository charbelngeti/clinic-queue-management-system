// FR-QUE-08: live queue monitor for reception (actions) and admin (read-only). Polls every 5 s (NFR-PERF-02).
import { api } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, promptDialog } from '../ui/feedback.js';
import { fullName, since, statusBadge, priorityBadge } from '../ui/format.js';

const COLUMNS = [
  ['triage', 'Triage', 'heart', 'text-rose-600 bg-rose-50'],
  ['consultation', 'Consultation', 'stethoscope', 'text-brand-700 bg-brand-50'],
  ['lab', 'Laboratory', 'flask', 'text-violet-700 bg-violet-50'],
  ['pharmacy', 'Pharmacy', 'pill', 'text-amber-700 bg-amber-50'],
];
const staff = (u) => (u ? `${u.role === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}` : '');

export async function render(root, { user }) {
  const canAct = user.role === 'receptionist';
  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div id="totals" class="flex flex-wrap gap-2"></div>
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-2 text-xs text-slate-500"><span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span>Live · updates every 5 s</span>
          <a href="/display" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">${icon('monitor', 'h-4 w-4')}Open “Who's Next” display</a>
        </div>
      </div>
      <div id="cols" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"></div>
    </div>`,
  );

  async function load() {
    try {
      const data = await api.get('/queue/board');
      const all = Object.values(data.stages).flat();
      mount(
        $('#totals', root),
        html`<span class="badge badge-brand px-3 py-1 text-sm">${all.length} in clinic</span>
          <span class="badge badge-amber px-3 py-1 text-sm">${all.filter((v) => v.queueStatus === 'waiting').length} waiting</span>
          <span class="badge badge-green px-3 py-1 text-sm">${data.completedToday} completed today</span>`,
      );
      mount(
        $('#cols', root),
        COLUMNS.map(([key, label, ic, tone]) => {
          const list = data.stages[key] || [];
          return html`<section class="card flex flex-col">
            <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg ${tone}">${icon(ic, 'h-4 w-4')}</span>
              <h3 class="flex-1 text-sm font-semibold text-slate-900">${label}</h3>
              <span class="badge badge-slate">${list.length}</span>
            </header>
            <ul class="flex-1 divide-y divide-slate-100">
              ${list.length
                ? list.map(
                    (v) => html`<li class="px-4 py-3 ${v.queueStatus !== 'waiting' ? 'bg-sky-50/40' : ''}">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono text-base font-bold text-slate-900">${v.ticketNo}</span>
                        <span class="flex gap-1">${v.priority !== 'normal' ? priorityBadge(v.priority) : ''}${statusBadge(v.queueStatus)}</span>
                      </div>
                      <p class="mt-1 text-sm font-medium text-slate-800">${fullName(v.patientId)}</p>
                      <p class="text-xs text-slate-500">
                        ${v.queueStatus === 'waiting' ? `Waiting ${since(v.queueTime < new Date().toISOString() ? v.queueTime : v.createdAt)}` : `With ${staff(v.calledBy)}${v.room ? ` · ${v.room}` : ''}`}
                        ${v.assignedTo && v.queueStatus === 'waiting' ? ` · for ${staff(v.assignedTo)}` : ''}
                        ${v.labResultsReady ? ' · results ready' : ''}
                      </p>
                      ${canAct
                        ? html`<div class="mt-2 flex gap-1">
                            ${v.queueStatus === 'skipped' ? html`<button class="btn btn-secondary btn-sm" data-requeue="${v._id}">${icon('refresh', 'h-3.5 w-3.5')}Re-queue</button>` : ''}
                            <button class="btn btn-ghost btn-sm text-rose-600" data-cancel="${v._id}" data-ticket="${v.ticketNo}">Cancel visit</button>
                          </div>`
                        : ''}
                    </li>`,
                  )
                : html`<li class="px-4 py-10 text-center text-sm text-slate-400">No patients</li>`}
            </ul>
          </section>`;
        }),
      );
    } catch (err) {
      if (err.status !== 401) toastError(err);
    }
  }

  if (canAct) {
    root.addEventListener('click', async (e) => {
      const rq = e.target.closest('[data-requeue]');
      const cn = e.target.closest('[data-cancel]');
      try {
        if (rq) {
          await api.post(`/visits/${rq.dataset.requeue}/requeue`);
          toast('Patient returned to the queue.');
          load();
        }
        if (cn) {
          const reason = await promptDialog({ title: `Cancel visit ${cn.dataset.ticket}?`, label: 'Reason (e.g. patient left)', confirmText: 'Cancel visit', danger: true });
          if (!reason) return;
          await api.post(`/visits/${cn.dataset.cancel}/cancel`, { reason });
          toast('Visit cancelled.');
          load();
        }
      } catch (err) {
        toastError(err);
      }
    });
  }

  await load();
  const timer = setInterval(load, 5000);
  return () => clearInterval(timer);
}
