// Audit log viewer (FR-AUD-02): who did what, when.
import { api, qs } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { toastError } from '../ui/feedback.js';
import { fmtDateTime, ROLE_LABELS } from '../ui/format.js';

const ACTIONS = [
  ['', 'All actions'], ['patient', 'Patients'], ['appointment', 'Appointments'], ['visit', 'Visits'], ['queue', 'Queue calls'],
  ['triage', 'Triage'], ['lab', 'Laboratory'], ['prescription', 'Prescriptions'], ['medication', 'Medications'], ['user', 'User accounts'],
];

export async function render(root) {
  const f = { q: '', action: '' };
  mount(
    root,
    html`<div class="space-y-5">
      <p class="text-sm text-slate-500">Every change to patient, clinical and account records, plus every opening of a clinical record, is logged here (latest 200 entries).</p>
      <div class="card">
        <div class="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input id="q" class="input max-w-xs" placeholder="Search user or description…" aria-label="Search audit log" />
          <select id="action" class="input w-auto" aria-label="Action type">${ACTIONS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
        </div>
        <div class="overflow-x-auto"><table class="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Description</th><th>IP</th></tr></thead><tbody id="rows"></tbody></table></div>
      </div>
    </div>`,
  );
  async function load() {
    try {
      const { entries } = await api.get(`/audit${qs(f)}`);
      mount(
        $('#rows', root),
        entries.length
          ? entries.map(
              (e) => html`<tr><td class="whitespace-nowrap text-slate-600">${fmtDateTime(e.at)}</td>
                <td><p class="font-medium text-slate-900">${e.userName || '—'}</p><p class="text-xs text-slate-500">${ROLE_LABELS[e.role] || ''}</p></td>
                <td><span class="badge badge-slate font-mono">${e.action}</span></td><td class="text-slate-700">${e.summary || ''}</td><td class="font-mono text-xs text-slate-500">${e.ip || ''}</td></tr>`,
            )
          : html`<tr><td colspan="5" class="py-10 text-center text-slate-500">No matching entries.</td></tr>`,
      );
    } catch (err) {
      toastError(err);
    }
  }
  let t;
  $('#q', root).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => ((f.q = e.target.value.trim()), load()), 300);
  };
  $('#action', root).onchange = (e) => ((f.action = e.target.value), load());
  await load();
}
