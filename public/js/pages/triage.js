// FR-NUR-01..05: nurse triage — call next, record vital signs & assessment, set priority, send to consultation.
import { api } from '../api.js';
import { html, mount, $, formData, showFieldErrors, clearFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, withBusy } from '../ui/feedback.js';
import { fmtTime } from '../ui/format.js';
import { stageWorkspace } from '../components/workspace.js';
import { vitalsPanel } from '../components/vitals.js';

const FIELDS = [
  ['temperature', 'Temperature', '°C', '0.1', '36.8'],
  ['systolic', 'Systolic BP', 'mmHg', '1', '120'],
  ['diastolic', 'Diastolic BP', 'mmHg', '1', '80'],
  ['pulse', 'Pulse', 'bpm', '1', '72'],
  ['respRate', 'Resp. rate', '/min', '1', '16'],
  ['spo2', 'SpO₂', '%', '1', '98'],
  ['weight', 'Weight', 'kg', '0.1', '70'],
  ['height', 'Height', 'cm', '0.1', '170'],
];

export async function render(root) {
  let consultStaff = [];
  try {
    consultStaff = (await api.get('/queue/consultation/staff')).staff;
  } catch {
    /* the "send to" list falls back to the general queue */
  }

  function renderForm(el, visit, reload) {
    const t = visit.triage;
    const v = t?.vitals || {};
    mount(
      el,
      html`<form class="card" novalidate>
        <div class="card-header"><h3 class="card-title">${icon('activity', 'mr-1 inline h-5 w-5 text-brand-600')}Vital signs & assessment</h3>
          <span class="text-xs text-slate-500">Impossible values are rejected; abnormal values are flagged.</span></div>
        <div class="card-body space-y-6">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            ${FIELDS.map(
              ([name, label, unit, step, ph]) => html`<div data-field>
                <label class="label" for="v-${name}">${label} <span class="label-hint">${unit}</span></label>
                <input id="v-${name}" name="${name}" type="number" inputmode="decimal" step="${step}" placeholder="${ph}" class="input" value="${v[name] ?? ''}" />
              </div>`,
            )}
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div data-field class="sm:col-span-2"><label class="label" for="v-complaint">Presenting complaint</label>
              <input id="v-complaint" name="complaint" class="input" maxlength="500" placeholder="e.g. Fever and headache for 3 days" value="${t?.complaint || ''}" /></div>
            <div data-field><label class="label" for="v-priority">Triage priority</label>
              <select id="v-priority" name="priority" class="input">
                ${['normal', 'urgent', 'emergency'].map((p) => html`<option value="${p}" ${visit.priority === p ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`)}
              </select></div>
          </div>
          <div data-field><label class="label" for="v-notes">Nursing notes <span class="label-hint">(optional)</span></label>
            <textarea id="v-notes" name="notes" rows="3" class="input" maxlength="2000" placeholder="Preliminary assessment, observations…">${t?.notes || ''}</textarea></div>
        </div>
        <div class="flex justify-end border-t border-slate-100 px-5 py-4">
          <button class="btn btn-primary" data-submit>${icon('check', 'h-4 w-4')}Save vitals</button>
        </div>
      </form>`,
    );
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const d = formData(form);
      const vitals = {};
      for (const [name] of FIELDS) if (d[name] !== '') vitals[name] = Number(d[name]);
      if (!Object.keys(vitals).length) return showFieldErrors(form, { temperature: 'Record at least one vital sign.' });
      await withBusy($('[data-submit]', form), async () => {
        try {
          const { visit: updated } = await api.post(`/visits/${visit._id}/triage`, {
            vitals,
            complaint: d.complaint || undefined,
            notes: d.notes || undefined,
            priority: d.priority,
          });
          const flagged = updated.triage.flags.length;
          toast(flagged ? 'Vitals saved: abnormal values were flagged.' : 'Vitals saved.', flagged ? 'warning' : 'success');
          await reload(); // re-render header (now "In service") and the send-to-consultation panel
        } catch (err) {
          if (err.details) showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };
  }

  function renderSend(el, visit, reload) {
    const t = visit.triage;
    mount(
      el,
      html`<div class="space-y-5">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Vitals recorded at ${fmtTime(t.recordedAt)}</h3>
            <button class="btn btn-ghost btn-sm" data-edit>${icon('edit', 'h-4 w-4')}Edit vitals</button></div>
          <div class="card-body">${vitalsPanel(t)}</div>
        </div>
        <form class="card" novalidate>
          <div class="card-header"><h3 class="card-title">Send to consultation</h3></div>
          <div class="card-body space-y-3">
            <label class="label" for="send-to">Doctor / clinician</label>
            <select id="send-to" name="assignedTo" class="input">
              <option value="">General queue: first available doctor or clinician</option>
              ${consultStaff.map((s) => {
                const booked = String(visit.doctorId) === String(s._id);
                return html`<option value="${s._id}" ${booked ? 'selected' : ''}>${s.role === 'doctor' ? 'Dr. ' : ''}${s.firstName} ${s.lastName} (${s.role === 'doctor' ? s.staffProfile?.specialization || 'Doctor' : 'Clinician'})${booked ? ' · booked' : ''}</option>`;
              })}
            </select>
            <p class="text-xs text-slate-500">Appointment patients default to their booked doctor. The patient keeps their place in line.</p>
          </div>
          <div class="flex justify-end border-t border-slate-100 px-5 py-4">
            <button class="btn btn-primary" data-submit>${icon('arrowRight', 'h-4 w-4')}Send to consultation</button>
          </div>
        </form>
      </div>`,
    );
    $('[data-edit]', el).onclick = () => renderForm(el, visit, reload);
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy($('[data-submit]', form), async () => {
        try {
          const { visit: v } = await api.post(`/visits/${visit._id}/send-to-consultation`, { assignedTo: form.assignedTo.value || undefined });
          toast(`${v.ticketNo} sent to consultation.`);
          reload();
        } catch (err) {
          toastError(err);
        }
      });
    };
  }

  return stageWorkspace(root, {
    stage: 'triage',
    emptyHint: 'Press “Call next” to call the next patient to the triage room. Emergencies are always called first.',
    renderCurrent: (el, visit, reload) => (visit.triage?.recordedAt ? renderSend(el, visit, reload) : renderForm(el, visit, reload)),
  });
}
