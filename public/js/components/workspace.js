// Department workspace shared by triage, consultation, lab and pharmacy (avoids duplicate functionality):
// left = my queue (waiting / skipped) with "Call next"; right = the patient I'm serving, rendered by the page.
import { api } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, withBusy, confirmDialog } from '../ui/feedback.js';
import { fullName, since, statusBadge, priorityBadge, age, sexShort } from '../ui/format.js';

/**
 * @param root      container element
 * @param stage     'triage' | 'consultation' | 'lab' | 'pharmacy'
 * @param renderCurrent(el, visit, reload) renders the work area for the patient being served
 * @param emptyHint text shown when nobody is being served
 * @param extraTag(visit) optional badge for queue rows (e.g. "Results ready")
 */
export async function stageWorkspace(root, { stage, renderCurrent, emptyHint, extraTag }) {
  mount(
    root,
    html`<div class="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <aside class="card flex flex-col self-start lg:sticky lg:top-20">
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 p-4">
          <div><h3 class="card-title">My queue</h3><p id="ws-sub" class="text-xs text-slate-500"></p></div>
          <button id="ws-call" class="btn btn-primary">${icon('megaphone', 'h-4 w-4')}Call next</button>
        </div>
        <div id="ws-stats" class="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center"></div>
        <ul id="ws-waiting" class="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto"></ul>
        <div id="ws-skipped"></div>
      </aside>
      <section id="ws-current"></section>
    </div>`,
  );
  let currentId; // undefined until the first load, so the empty state is drawn too
  let statsTick = 0;

  // Small personal dashboard (FR-RPT-01): refreshed every 30 s.
  async function loadStats() {
    try {
      const s = await api.get(`/queue/${stage}/stats`);
      const cell = (v, l) => html`<div class="px-2 py-3"><p class="text-lg font-bold text-slate-900">${v}</p><p class="text-[11px] text-slate-500">${l}</p></div>`;
      mount($('#ws-stats', root), html`${cell(s.servedByMeToday, 'Seen by me today')}${cell(s.servedToday, 'Seen by team')}${cell(s.avgWaitToday != null ? `${s.avgWaitToday}m` : '—', 'Avg. wait today')}`);
    } catch {
      /* stats are optional */
    }
  }

  async function load() {
    if (statsTick++ % 6 === 0) loadStats();
    let data;
    try {
      data = await api.get(`/queue/${stage}`);
    } catch (err) {
      if (err.status !== 401) toastError(err);
      return;
    }
    $('#ws-sub', root).textContent = `${data.waiting.length} waiting${data.othersServing ? ` · ${data.othersServing} with colleagues` : ''}`;
    mount(
      $('#ws-waiting', root),
      data.waiting.length
        ? data.waiting.map(
            (v, i) => html`<li class="flex items-center gap-3 px-4 py-3">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">${i + 1}</span>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2"><span class="font-mono font-bold text-slate-900">${v.ticketNo}</span>
                  ${v.priority !== 'normal' ? priorityBadge(v.priority) : ''}${extraTag?.(v) || ''}</p>
                <p class="truncate text-sm text-slate-600">${fullName(v.patientId)} · ${sexShort(v.patientId?.sex)}, ${age(v.patientId?.dateOfBirth)} y</p>
                <p class="text-xs text-slate-400">Waiting ${since(new Date(v.queueTime) < new Date() ? v.queueTime : v.createdAt)}${v.assignedTo ? ' · assigned to you' : ''}</p>
              </div>
            </li>`,
          )
        : html`<li class="px-4 py-10 text-center text-sm text-slate-400">${icon('checkCircle', 'mx-auto mb-2 h-6 w-6 text-emerald-400')}No patients waiting</li>`,
    );
    mount(
      $('#ws-skipped', root),
      data.skipped.length
        ? html`<div class="border-t border-slate-100 p-4">
            <p class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Skipped (did not respond)</p>
            ${data.skipped.map(
              (v) => html`<div class="flex items-center justify-between py-1 text-sm"><span><span class="font-mono font-semibold">${v.ticketNo}</span> · ${fullName(v.patientId)}</span>
                <button class="btn btn-ghost btn-sm" data-requeue="${v._id}">Re-queue</button></div>`,
            )}
          </div>`
        : '',
    );
    $('#ws-call', root).disabled = Boolean(data.current) || !data.waiting.length;
    $('#ws-call', root).title = data.current ? 'Finish with the current patient first' : '';

    // Only re-render the work area when the served patient changes (keeps half-filled forms intact).
    const newId = data.current?._id || null;
    if (newId !== currentId) {
      currentId = newId;
      renderCurrentArea(data.current);
    }
  }

  function renderCurrentArea(visit) {
    const el = $('#ws-current', root);
    if (!visit) {
      return mount(
        el,
        html`<div class="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">${icon('megaphone', 'h-7 w-7')}</span>
          <h3 class="mt-4 text-lg font-semibold text-slate-900">No patient with you right now</h3>
          <p class="mt-1 max-w-sm text-sm text-slate-500">${emptyHint}</p>
        </div>`,
      );
    }
    mount(
      el,
      html`<div class="space-y-5">
        <div class="card flex flex-wrap items-center gap-4 p-4">
          <span class="rounded-xl bg-brand-600 px-3 py-2 font-mono text-2xl font-black text-white">${visit.ticketNo}</span>
          <div class="min-w-0 flex-1">
            <p class="text-lg font-semibold text-slate-900">${fullName(visit.patientId)}</p>
            <p class="text-sm text-slate-500">${visit.patientId.patientNo} · ${sexShort(visit.patientId.sex)}, ${age(visit.patientId.dateOfBirth)} years
              ${visit.patientId.allergies?.length ? html` · <span class="font-semibold text-rose-600">Allergies: ${visit.patientId.allergies.join(', ')}</span>` : ''}</p>
          </div>
          <div class="flex items-center gap-2">
            ${priorityBadge(visit.priority)} ${statusBadge(visit.queueStatus)}
            ${visit.queueStatus === 'called'
              ? html`<button class="btn btn-secondary btn-sm" data-recall>${icon('megaphone', 'h-4 w-4')}Call again</button>
                  <button class="btn btn-secondary btn-sm" data-skip>Not here</button>
                  <button class="btn btn-primary btn-sm" data-start>${icon('check', 'h-4 w-4')}Patient arrived</button>`
              : ''}
          </div>
        </div>
        <div data-work></div>
      </div>`,
    );
    const act = (sel, fn) => $(sel, el) && ($(sel, el).onclick = (e) => withBusy(e.currentTarget, fn));
    act('[data-recall]', async () => {
      await api.post(`/visits/${visit._id}/recall`).catch(toastError);
      toast(`${visit.ticketNo} called again on the display.`, 'info');
    });
    act('[data-skip]', async () => {
      if (!(await confirmDialog({ title: `Skip ${visit.ticketNo}?`, message: 'The patient did not respond. They move to the skipped list and can be re-queued when they return.', confirmText: 'Skip patient' }))) return;
      await api.post(`/visits/${visit._id}/skip`).catch(toastError);
      reload();
    });
    act('[data-start]', async () => {
      try {
        await api.post(`/visits/${visit._id}/start`);
        await reload();
      } catch (err) {
        toastError(err);
      }
    });
    renderCurrent($('[data-work]', el), visit, reload);
  }

  const reload = () => {
    currentId = '__force__';
    return load();
  };

  $('#ws-call', root).onclick = (e) =>
    withBusy(e.currentTarget, async () => {
      try {
        const { visit } = await api.post(`/queue/${stage}/call-next`);
        if (!visit) toast('No patients are waiting.', 'info');
        else toast(`Calling ${visit.ticketNo}: shown on the “Who's Next” display.`);
        await reload();
      } catch (err) {
        toastError(err);
      }
    });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-requeue]');
    if (!b) return;
    try {
      await api.post(`/visits/${b.dataset.requeue}/requeue`);
      toast('Patient returned to the queue.');
      load();
    } catch (err) {
      toastError(err);
    }
  });

  await load();
  const timer = setInterval(load, 5000);
  return () => clearInterval(timer);
}
