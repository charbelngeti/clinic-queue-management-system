// Admin operational report (FR-RPT-02): visits, waiting times per department, appointments, lab, pharmacy.
import { api, qs } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toastError } from '../ui/feedback.js';
import { clinicToday, fmtDate, stageLabel } from '../ui/format.js';

const shift = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const tile = (label, value, hint, ic, tone) => html`<div class="stat">
  <div><p class="stat-label">${label}</p><p class="stat-value">${value ?? '—'}</p>${hint ? html`<p class="mt-1 text-xs text-slate-500">${hint}</p>` : ''}</div>
  <span class="flex h-10 w-10 items-center justify-center rounded-xl ${tone}">${icon(ic)}</span></div>`;

export async function render(root) {
  const f = { from: shift(clinicToday(), -6), to: clinicToday() };
  mount(
    root,
    html`<div class="space-y-6">
      <div class="flex flex-wrap items-end gap-3">
        <div><label class="label" for="from">From</label><input id="from" type="date" class="input" value="${f.from}" /></div>
        <div><label class="label" for="to">To</label><input id="to" type="date" class="input" value="${f.to}" /></div>
        <div class="flex gap-1">${[['Today', 0], ['7 days', 6], ['30 days', 29]].map(([l, n]) => html`<button class="btn btn-secondary btn-sm" data-range="${n}">${l}</button>`)}</div>
      </div>
      <div id="report" class="space-y-6"></div>
    </div>`,
  );

  async function load() {
    const el = $('#report', root);
    mount(el, html`<div class="skeleton h-64"></div>`);
    try {
      const r = await api.get(`/reports/summary${qs(f)}`);
      const max = Math.max(1, ...r.daily.map((d) => d.visits));
      const appt = r.appointments.byStatus;
      mount(
        el,
        html`<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            ${tile('Clinic visits', r.visits.total, `${r.visits.byType.appointment || 0} booked · ${r.visits.byType.walk_in || 0} walk-in`, 'users', 'bg-brand-50 text-brand-600')}
            ${tile('Visits completed', r.visits.byStatus.completed || 0, `${r.visits.byStatus.cancelled || 0} cancelled (patient left)`, 'checkCircle', 'bg-emerald-50 text-emerald-600')}
            ${tile('No-show rate', r.appointments.noShowRate != null ? `${r.appointments.noShowRate}%` : '—', `${appt.no_show || 0} missed of ${(appt.no_show || 0) + (appt.checked_in || 0) + (appt.completed || 0)} that were due`, 'ban', 'bg-amber-50 text-amber-600')}
            ${tile('Lab turnaround', r.lab.avgTurnaround != null ? `${r.lab.avgTurnaround} min` : '—', `${r.lab.completed} of ${r.lab.total} requests completed`, 'flask', 'bg-violet-50 text-violet-600')}
          </div>
          <div class="grid gap-5 xl:grid-cols-3">
            <div class="card xl:col-span-2">
              <div class="card-header"><h3 class="card-title">Visits per day</h3><span class="text-xs text-slate-500">${fmtDate(`${r.from}T12:00:00Z`)} – ${fmtDate(`${r.to}T12:00:00Z`)}</span></div>
              <div class="card-body">
                <div class="flex h-48 items-end gap-1.5" role="img" aria-label="Bar chart of visits per day">
                  ${r.daily.map(
                    (d) => html`<div class="group flex flex-1 flex-col items-center justify-end gap-1">
                      <span class="text-xs font-semibold text-slate-700">${d.visits || ''}</span>
                      <div class="w-full rounded-t-md bg-brand-500 transition-colors group-hover:bg-brand-600" style="height:${Math.max(2, (d.visits / max) * 150)}px" title="${d.date}: ${d.visits} visits"></div>
                      <span class="text-[10px] text-slate-500">${d.date.slice(8)}/${d.date.slice(5, 7)}</span>
                    </div>`,
                  )}
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3 class="card-title">Appointments</h3></div>
              <ul class="card-body space-y-2 text-sm">
                ${[['scheduled', 'Scheduled'], ['checked_in', 'Checked in'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['no_show', 'No-show']].map(
                  ([k, l]) => html`<li class="flex justify-between"><span class="text-slate-600">${l}</span><span class="font-semibold">${appt[k] || 0}</span></li>`,
                )}
              </ul>
            </div>
          </div>
          <div class="grid gap-5 xl:grid-cols-2">
            <div class="card">
              <div class="card-header"><h3 class="card-title">Waiting & service time by department</h3></div>
              <table class="table"><thead><tr><th>Department</th><th>Patients served</th><th>Avg. wait</th><th>Avg. service</th></tr></thead>
                <tbody>${['triage', 'consultation', 'lab', 'pharmacy'].map((s) => {
                  const x = r.stages[s];
                  return html`<tr><td class="font-medium">${stageLabel(s)}</td><td>${x?.served ?? 0}</td><td>${x?.avgWait != null ? `${x.avgWait} min` : '—'}</td><td>${x?.avgService != null ? `${x.avgService} min` : '—'}</td></tr>`;
                })}</tbody></table>
            </div>
            <div class="card">
              <div class="card-header"><h3 class="card-title">Pharmacy</h3></div>
              <div class="card-body space-y-4 text-sm">
                <p class="flex gap-4"><span>Pending <strong>${r.prescriptions.byStatus.pending || 0}</strong></span><span>Partially dispensed <strong>${r.prescriptions.byStatus.partially_dispensed || 0}</strong></span><span>Dispensed <strong>${r.prescriptions.byStatus.dispensed || 0}</strong></span></p>
                <div><p class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Most dispensed medications</p>
                  ${r.prescriptions.topMedications.length
                    ? r.prescriptions.topMedications.map((m) => html`<p class="flex justify-between border-b border-slate-100 py-1.5"><span>${m.name}</span><span class="font-semibold">${m.qty}</span></p>`)
                    : html`<p class="text-slate-400">No dispensing in this period.</p>`}</div>
              </div>
            </div>
          </div>`,
      );
    } catch (err) {
      toastError(err);
      mount(el, html`<div class="card p-8 text-center text-slate-500">Report could not be loaded.</div>`);
    }
  }

  $('#from', root).onchange = (e) => ((f.from = e.target.value), load());
  $('#to', root).onchange = (e) => ((f.to = e.target.value), load());
  root.querySelectorAll('[data-range]').forEach(
    (b) =>
      (b.onclick = () => {
        f.to = clinicToday();
        f.from = shift(f.to, -Number(b.dataset.range));
        $('#from', root).value = f.from;
        $('#to', root).value = f.to;
        load();
      }),
  );
  await load();
}
