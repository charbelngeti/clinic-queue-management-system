// Clinical consultation workspace — shared by doctors and clinicians (FR-CON-01..09).
import { api } from '../api.js';
import { html, mount, $, $$, formData, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy, confirmDialog } from '../ui/feedback.js';
import { fmtDate, fmtTime, fmtDateTime, statusBadge } from '../ui/format.js';
import { stageWorkspace } from '../components/workspace.js';
import { vitalsPanel } from '../components/vitals.js';

const FLAG_TONE = { normal: 'badge-green', low: 'badge-amber', high: 'badge-amber', critical: 'badge-red' };

export function labResultsTable(req) {
  return html`<div class="rounded-lg border border-slate-200">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
      <span class="font-semibold text-slate-700">${req.requestNo} · ${fmtDateTime(req.createdAt)}</span>
      <span>${statusBadge(req.status)}</span>
    </div>
    <table class="table text-xs">
      <thead><tr><th>Test</th><th>Result</th><th>Ref. range</th><th>Flag</th></tr></thead>
      <tbody>${req.tests.map(
        (t) => html`<tr><td class="font-medium">${t.name}</td>
          <td>${t.result ? html`${t.result.value} ${t.result.unit || ''}${t.result.comment ? html`<p class="text-slate-500">${t.result.comment}</p>` : ''}` : html`<span class="text-slate-400">Pending</span>`}</td>
          <td class="text-slate-500">${t.result?.refRange || '—'}</td>
          <td>${t.result ? html`<span class="badge ${FLAG_TONE[t.result.flag] || 'badge-slate'}">${t.result.flag}</span>` : ''}</td></tr>`,
      )}</tbody>
    </table>
    ${req.completedAt ? html`<p class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">Released by ${req.completedByName} at ${fmtDateTime(req.completedAt)}</p>` : ''}
  </div>`;
}

export async function render(root, { user }) {
  let catalogues = { medications: [], labTests: [] };
  let doctors = [];
  try {
    [catalogues, { doctors }] = await Promise.all([api.get('/catalogues'), api.get('/doctors')]);
  } catch (err) {
    toastError(err);
  }

  return stageWorkspace(root, {
    stage: 'consultation',
    emptyHint: 'Press “Call next” for the next patient assigned to you or waiting in the general queue. Patients returning from the lab are marked “Results ready”.',
    extraTag: (v) => (v.labResultsReady ? html`<span class="badge badge-violet">Results ready</span>` : ''),
    renderCurrent: (el, visit, reload) => renderConsultation(el, visit, reload),
  });

  async function renderConsultation(el, visit, reload) {
    mount(el, html`<div class="skeleton h-96"></div>`);
    let ctx;
    try {
      ctx = await api.get(`/consultations/visit/${visit._id}`);
    } catch (err) {
      toastError(err);
      return mount(el, html`<div class="card p-8 text-center text-slate-500">Could not load the consultation.</div>`);
    }
    const c = ctx.consultation || {};
    const p = ctx.patient;
    const pendingLab = ctx.labRequests.some((r) => r.status !== 'completed' && r.status !== 'cancelled');

    mount(
      el,
      html`<div class="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div class="space-y-5">
          ${ctx.visit.labResultsReady || ctx.labRequests.some((r) => r.status === 'completed')
            ? html`<div class="card border-violet-200">
                <div class="card-header"><h3 class="card-title">${icon('flask', 'mr-1 inline h-5 w-5 text-violet-600')}Lab results for this visit</h3></div>
                <div class="card-body space-y-3">${ctx.labRequests.map(labResultsTable)}</div>
              </div>`
            : ''}
          ${ctx.visitNotes.length
            ? html`<div class="card"><div class="card-header"><h3 class="card-title">Earlier notes in this visit</h3></div>
                <div class="card-body space-y-3 text-sm">${ctx.visitNotes.map(
                  (n) => html`<div class="rounded-lg bg-slate-50 p-3"><p class="text-xs font-semibold text-slate-500">${n.clinicianName} · ${fmtTime(n.createdAt)}</p>
                    <p><strong>Dx:</strong> ${n.diagnosis || '—'}</p>${n.referral?.reason ? html`<p><strong>Referred:</strong> ${n.referral.reason}</p>` : ''}</div>`,
                )}</div></div>`
            : ''}
          <form class="card" id="note-form" novalidate>
            <div class="card-header">
              <h3 class="card-title">${icon('clipboard', 'mr-1 inline h-5 w-5 text-brand-600')}Consultation note</h3>
              <span id="save-state" class="text-xs text-slate-500">${c._id ? `Draft saved ${fmtTime(c.updatedAt)}` : 'Not saved yet'}</span>
            </div>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              <div data-field class="sm:col-span-2"><label class="label" for="c-cc">Chief complaint</label>
                <input id="c-cc" name="chiefComplaint" class="input" value="${c.chiefComplaint || ctx.visit.triage?.complaint || ''}" /></div>
              <div data-field><label class="label" for="c-hx">History</label><textarea id="c-hx" name="history" rows="4" class="input">${c.history || ''}</textarea></div>
              <div data-field><label class="label" for="c-ex">Examination findings</label><textarea id="c-ex" name="examination" rows="4" class="input">${c.examination || ''}</textarea></div>
              <div data-field class="sm:col-span-2"><label class="label" for="c-dx">Diagnosis</label><input id="c-dx" name="diagnosis" class="input" value="${c.diagnosis || ''}" /></div>
              <div data-field><label class="label" for="c-plan">Plan</label><textarea id="c-plan" name="plan" rows="3" class="input">${c.plan || ''}</textarea></div>
              <div data-field><label class="label" for="c-notes">Other notes</label><textarea id="c-notes" name="notes" rows="3" class="input">${c.notes || ''}</textarea></div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <button type="submit" class="btn btn-secondary" data-save>${icon('check', 'h-4 w-4')}Save draft</button>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-secondary" data-act="lab" ${pendingLab ? 'disabled' : ''}>${icon('flask', 'h-4 w-4')}Request lab tests</button>
                <button type="button" class="btn btn-secondary" data-act="refer">${icon('arrowRight', 'h-4 w-4')}Refer to doctor</button>
                <button type="button" class="btn btn-secondary" data-act="complete">${icon('checkCircle', 'h-4 w-4')}Complete visit</button>
                <button type="button" class="btn btn-primary" data-act="rx">${icon('pill', 'h-4 w-4')}Prescribe</button>
              </div>
            </div>
          </form>
        </div>

        <aside class="space-y-5">
          ${p.allergies?.length
            ? html`<div class="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">${icon('alert')}<div><p class="font-semibold">Allergies</p><p>${p.allergies.join(', ')}</p></div></div>`
            : html`<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No known allergies</div>`}
          <div class="card"><div class="card-header"><h3 class="card-title">Today's vitals</h3></div><div class="card-body">${vitalsPanel(ctx.visit.triage)}</div></div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Patient history</h3></div>
            <div class="card-body space-y-4 text-sm">
              ${p.chronicConditions?.length ? html`<p><span class="font-medium">Chronic:</span> ${p.chronicConditions.join(', ')}</p>` : ''}
              <div><p class="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Past consultations</p>
                ${ctx.history.consultations.length
                  ? ctx.history.consultations.map((h) => html`<p class="border-b border-slate-100 py-1.5"><span class="text-slate-500">${fmtDate(h.createdAt)}</span> · ${h.diagnosis || h.chiefComplaint || '—'}<span class="block text-xs text-slate-400">${h.clinicianName}</span></p>`)
                  : html`<p class="text-slate-400">None recorded</p>`}</div>
              <div><p class="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Past lab results</p>
                ${ctx.history.labs.length
                  ? ctx.history.labs.map((l) => html`<p class="border-b border-slate-100 py-1.5"><span class="text-slate-500">${fmtDate(l.createdAt)}</span> · ${l.tests.map((t) => `${t.code}: ${t.result?.value ?? '—'}`).join('; ')}</p>`)
                  : html`<p class="text-slate-400">None recorded</p>`}</div>
              <div><p class="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Past prescriptions</p>
                ${ctx.history.prescriptions.length
                  ? ctx.history.prescriptions.map((r) => html`<p class="border-b border-slate-100 py-1.5"><span class="text-slate-500">${fmtDate(r.createdAt)}</span> · ${r.items.map((i) => `${i.name} ${i.strength}`).join(', ')}</p>`)
                  : html`<p class="text-slate-400">None recorded</p>`}</div>
            </div>
          </div>
        </aside>
      </div>`,
    );

    const form = $('#note-form', el);
    const saveNote = async () => {
      const d = formData(form);
      const { consultation } = await api.put(`/consultations/visit/${visit._id}`, d);
      $('#save-state', el).textContent = `Draft saved ${fmtTime(consultation.updatedAt)}`;
      return consultation;
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy($('[data-save]', form), async () => {
        try {
          await saveNote();
          toast('Draft saved.');
        } catch (err) {
          if (err.details) showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };

    const ensureSaved = async () => {
      try {
        await saveNote();
        return true;
      } catch (err) {
        toastError(err);
        return false;
      }
    };

    $$('[data-act]', form).forEach(
      (b) =>
        (b.onclick = async () => {
          if (!(await ensureSaved())) return;
          const act = b.dataset.act;
          if (act === 'lab') openLab(visit, reload);
          if (act === 'rx') openPrescribe(visit, p, reload);
          if (act === 'refer') openRefer(visit, reload);
          if (act === 'complete') {
            if (!(await confirmDialog({ title: 'Complete visit?', message: 'The consultation note will be finalised and the patient discharged without a prescription.', confirmText: 'Complete visit' }))) return;
            try {
              await api.post(`/consultations/visit/${visit._id}/complete`);
              toast(`${visit.ticketNo} discharged.`);
              reload();
            } catch (err) {
              toastError(err);
            }
          }
        }),
    );
  }

  function openLab(visit, reload) {
    const { el, close } = openModal({
      title: 'Request lab tests',
      subtitle: 'The patient will be sent to the laboratory and return to you when results are released.',
      size: 'lg',
      content: html`<form class="space-y-4 p-5" novalidate>
        <div class="grid gap-2 sm:grid-cols-2">${catalogues.labTests.map(
          (t) => html`<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="checkbox" name="test" value="${t._id}" class="mt-0.5 accent-brand-600" />
            <span><span class="block text-sm font-medium text-slate-900">${t.name}</span><span class="text-xs text-slate-500">${t.code} · ${t.sampleType}</span></span>
          </label>`,
        )}</div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div data-field><label class="label" for="l-pri">Priority</label><select id="l-pri" name="priority" class="input"><option value="routine">Routine</option><option value="urgent">Urgent</option></select></div>
          <div data-field class="sm:col-span-2"><label class="label" for="l-notes">Clinical notes for the lab</label><input id="l-notes" name="clinicalNotes" class="input" placeholder="e.g. rule out malaria" /></div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-submit>Send to laboratory</button></div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const testIds = $$('[name=test]:checked', form).map((c) => c.value);
      if (!testIds.length) return toastError({ message: 'Select at least one test.' });
      await withBusy($('[data-submit]', form), async () => {
        try {
          const { labRequest } = await api.post(`/consultations/visit/${visit._id}/lab-request`, {
            testIds, priority: form.priority.value, clinicalNotes: form.clinicalNotes.value.trim() || undefined,
          });
          toast(`${labRequest.requestNo} sent. ${visit.ticketNo} is now in the lab queue.`);
          close();
          reload();
        } catch (err) {
          toastError(err);
        }
      });
    };
  }

  function openPrescribe(visit, patient, reload) {
    const meds = catalogues.medications;
    const allowed = (m) => user.role === 'doctor' || m.clinicianMayPrescribe;
    const row = () => html`<tr data-row>
      <td><select name="medicationId" class="input py-1.5"><option value="">Select…</option>${meds.map(
        (m) => html`<option value="${m._id}" ${allowed(m) ? '' : 'disabled'}>${m.name} ${m.strength} ${m.form}${allowed(m) ? '' : ' (doctor only)'}${m.stockQty === 0 ? ' · out of stock' : ''}</option>`,
      )}</select></td>
      <td><input name="dose" class="input py-1.5" placeholder="500 mg" /></td>
      <td><select name="frequency" class="input py-1.5">${['OD (once daily)', 'BD (twice daily)', 'TDS (3× daily)', 'QID (4× daily)', 'Nocte (at night)', 'PRN (as needed)', 'Stat (once)'].map((f) => html`<option>${f}</option>`)}</select></td>
      <td><input name="durationDays" type="number" min="1" class="input w-20 py-1.5" value="5" /></td>
      <td><input name="quantity" type="number" min="1" class="input w-20 py-1.5" placeholder="15" /></td>
      <td><button type="button" class="btn-icon" data-remove aria-label="Remove">${icon('x', 'h-4 w-4')}</button></td>
    </tr>`;
    const { el, close } = openModal({
      title: 'Prescribe medication',
      subtitle: user.role === 'clinician' ? 'As a clinician you can prescribe from the approved list. Doctor-only drugs are disabled.' : 'Items are sent to the pharmacy for dispensing.',
      size: 'xl',
      content: html`<form class="space-y-4 p-5" novalidate>
        ${patient.allergies?.length ? html`<div class="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">${icon('alert', 'h-4 w-4')}Allergies: <strong>${patient.allergies.join(', ')}</strong></div>` : ''}
        <div class="overflow-x-auto"><table class="table"><thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Days</th><th>Qty</th><th></th></tr></thead><tbody data-rows>${row()}</tbody></table></div>
        <button type="button" class="btn btn-ghost btn-sm" data-add>${icon('plus', 'h-4 w-4')}Add medication</button>
        <div data-field><label class="label" for="rx-notes">Notes for the pharmacist <span class="label-hint">(optional)</span></label><input id="rx-notes" name="notes" class="input" /></div>
        <div data-allergy></div>
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-submit>${icon('send', 'h-4 w-4')}Send to pharmacy</button></div>
      </form>`,
    });
    const form = $('form', el);
    const tbody = $('[data-rows]', form);
    $('[data-add]', form).onclick = () => tbody.insertAdjacentHTML('beforeend', String(row()));
    tbody.onclick = (e) => e.target.closest('[data-remove]') && tbody.children.length > 1 && e.target.closest('tr').remove();
    let acknowledgeAllergy = false;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const items = $$('[data-row]', tbody).map((tr) => ({
        medicationId: tr.querySelector('[name=medicationId]').value,
        dose: tr.querySelector('[name=dose]').value.trim(),
        frequency: tr.querySelector('[name=frequency]').value,
        durationDays: Number(tr.querySelector('[name=durationDays]').value),
        quantity: Number(tr.querySelector('[name=quantity]').value),
      }));
      const bad = items.findIndex((i) => !i.medicationId || !i.dose || !i.quantity || !i.durationDays);
      if (bad >= 0) return toastError({ message: `Complete medication, dose, days and quantity on line ${bad + 1}.` });
      await withBusy($('[data-submit]', form), async () => {
        try {
          const { prescription } = await api.post(`/consultations/visit/${visit._id}/prescription`, { items, notes: form.notes.value.trim() || undefined, acknowledgeAllergy });
          toast(`${prescription.rxNo} sent. ${visit.ticketNo} is now in the pharmacy queue.`);
          close();
          reload();
        } catch (err) {
          if (err.code === 'ALLERGY_WARNING') {
            mount(
              $('[data-allergy]', form),
              html`<div class="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"><p class="font-semibold">${err.message}</p>
                <label class="mt-2 flex items-center gap-2"><input type="checkbox" data-ack class="accent-rose-600" />I have reviewed the allergy and want to prescribe anyway.</label></div>`,
            );
            $('[data-ack]', form).onchange = (ev) => (acknowledgeAllergy = ev.target.checked);
            return;
          }
          toastError(err);
        }
      });
    };
  }

  function openRefer(visit, reload) {
    const { el, close } = openModal({
      title: 'Refer to a doctor',
      subtitle: 'Your note is finalised and the patient joins the chosen doctor’s queue, keeping their place.',
      size: 'md',
      content: html`<form class="space-y-4 p-5" novalidate>
        <div data-field><label class="label" for="r-doc">Doctor</label><select id="r-doc" name="toDoctorId" class="input"><option value="">Select…</option>
          ${doctors.filter((d) => d._id !== user._id).map((d) => html`<option value="${d._id}">Dr. ${d.firstName} ${d.lastName} (${d.staffProfile?.specialization || 'General'})</option>`)}</select></div>
        <div data-field><label class="label" for="r-reason">Reason for referral</label><textarea id="r-reason" name="reason" rows="3" class="input"></textarea></div>
        <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-submit>Refer patient</button></div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy($('[data-submit]', form), async () => {
        try {
          await api.post(`/consultations/visit/${visit._id}/refer`, formData(form));
          toast(`${visit.ticketNo} referred.`);
          close();
          reload();
        } catch (err) {
          showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };
  }
}
