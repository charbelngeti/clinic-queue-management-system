// Daily records: lab requests (lab tech, FR-LAB-05) and prescriptions (pharmacist, FR-PHA-06).
import { api, qs } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toastError } from '../ui/feedback.js';
import { fullName, fmtTime, statusBadge, clinicToday } from '../ui/format.js';

const mins = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null);

export async function render(root, { user }) {
  const isLab = user.role === 'lab_tech';
  const f = { date: clinicToday(), status: '' };
  const statuses = isLab ? ['requested', 'sample_collected', 'in_progress', 'completed'] : ['pending', 'partially_dispensed', 'dispensed'];
  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <input type="date" id="date" class="input w-auto" value="${f.date}" aria-label="Date" />
        <select id="status" class="input w-auto" aria-label="Status"><option value="">All statuses</option>${statuses.map((s) => html`<option value="${s}">${s.replace(/_/g, ' ')}</option>`)}</select>
        <span id="count" class="ml-auto text-sm text-slate-500"></span>
      </div>
      <div class="card overflow-x-auto"><table class="table"><thead id="head"></thead><tbody id="rows"></tbody></table></div>
    </div>`,
  );
  mount(
    $('#head', root),
    isLab
      ? html`<tr><th>Request</th><th>Patient</th><th>Tests</th><th>Requested by</th><th>Requested</th><th>Turnaround</th><th>Status</th></tr>`
      : html`<tr><th>Prescription</th><th>Patient</th><th>Items</th><th>Prescriber</th><th>Created</th><th>Dispensed by</th><th>Status</th></tr>`,
  );

  async function load() {
    try {
      const rows = isLab ? (await api.get(`/lab/requests${qs(f)}`)).labRequests : (await api.get(`/pharmacy/prescriptions${qs(f)}`)).prescriptions;
      $('#count', root).textContent = `${rows.length} record(s)`;
      mount(
        $('#rows', root),
        rows.length
          ? rows.map((r) =>
              isLab
                ? html`<tr><td class="font-mono text-xs">${r.requestNo}</td><td>${fullName(r.patientId)}<p class="text-xs text-slate-500">${r.patientId?.patientNo}</p></td>
                    <td class="text-sm">${r.tests.map((t) => t.code).join(', ')}</td><td class="text-slate-600">${r.requestedByName}</td><td>${fmtTime(r.createdAt)}</td>
                    <td>${mins(r.createdAt, r.completedAt) !== null ? `${mins(r.createdAt, r.completedAt)} min` : '—'}</td><td>${statusBadge(r.status)}</td></tr>`
                : html`<tr><td class="font-mono text-xs">${r.rxNo}</td><td>${fullName(r.patientId)}<p class="text-xs text-slate-500">${r.patientId?.patientNo}</p></td>
                    <td class="text-sm">${r.items.map((i) => `${i.name} ${i.strength} (${i.dispensedQty}/${i.quantity})`).join(', ')}</td>
                    <td class="text-slate-600">${r.prescriber?.name}</td><td>${fmtTime(r.createdAt)}</td><td class="text-slate-600">${r.dispensedByName || '—'}</td><td>${statusBadge(r.status)}</td></tr>`,
            )
          : html`<tr><td colspan="7" class="py-10 text-center text-slate-500">${icon('inbox', 'mx-auto mb-2 h-6 w-6 text-slate-300')}No records for this day.</td></tr>`,
      );
    } catch (err) {
      toastError(err);
    }
  }
  $('#date', root).onchange = (e) => ((f.date = e.target.value || clinicToday()), load());
  $('#status', root).onchange = (e) => ((f.status = e.target.value), load());
  await load();
}
