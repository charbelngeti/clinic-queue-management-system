// FR-PAT-01..04: patient register (search, register new patient). Admin sees it read-only.
import { api, qs } from '../api.js';
import { html, mount, $ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toastError } from '../ui/feedback.js';
import { fullName, fmtDate, age, sexShort } from '../ui/format.js';
import { openPatientForm } from '../components/patient-form.js';
import { navigate } from '../app.js';

export async function render(root, { user }) {
  const canWrite = user.role === 'receptionist';
  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500">${canWrite ? 'Search the patient register or register a new patient.' : 'Read-only view of the patient register.'}</p>
        ${canWrite ? html`<button id="new-patient" class="btn btn-primary">${icon('userPlus', 'h-4 w-4')}Register patient</button>` : ''}
      </div>
      <div class="card">
        <div class="border-b border-slate-100 p-4">
          <div class="relative max-w-xl">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">${icon('search', 'h-4 w-4')}</span>
            <input id="q" class="input pl-9" placeholder="Search by name, patient no., phone or national ID" aria-label="Search patients" />
          </div>
        </div>
        <div class="overflow-x-auto"><table class="table">
          <thead><tr><th>Patient</th><th>Patient no.</th><th>Sex / age</th><th>Phone</th><th>Allergies</th><th>Registered</th><th></th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>
    </div>`,
  );

  async function load(q = '') {
    try {
      const { patients } = await api.get(`/patients${qs({ q })}`);
      mount(
        $('#rows', root),
        patients.length
          ? patients.map(
              (p) => html`<tr class="cursor-pointer" data-id="${p._id}">
                <td class="font-medium text-slate-900">${fullName(p)}</td>
                <td class="font-mono text-xs text-slate-600">${p.patientNo}</td>
                <td class="text-slate-600">${sexShort(p.sex)} · ${age(p.dateOfBirth)} y</td>
                <td class="text-slate-600">${p.phone}</td>
                <td>${p.allergies?.length ? p.allergies.map((a) => html`<span class="badge badge-red mr-1">${a}</span>`) : html`<span class="text-slate-400">None known</span>`}</td>
                <td class="text-slate-600">${fmtDate(p.createdAt)}</td>
                <td class="text-right text-slate-400">${icon('chevronRight', 'h-4 w-4')}</td>
              </tr>`,
            )
          : html`<tr><td colspan="7" class="py-12 text-center text-slate-500">No patients found.${canWrite ? ' Register them as a new patient.' : ''}</td></tr>`,
      );
    } catch (err) {
      toastError(err);
    }
  }

  $('#rows', root).onclick = (e) => {
    const row = e.target.closest('[data-id]');
    if (row) navigate(`/patients/${row.dataset.id}`);
  };
  let t;
  $('#q', root).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => load(e.target.value.trim()), 250);
  };
  if (canWrite) $('#new-patient', root).onclick = () => openPatientForm({ onSaved: (p) => navigate(`/patients/${p._id}`) });
  await load();
}
