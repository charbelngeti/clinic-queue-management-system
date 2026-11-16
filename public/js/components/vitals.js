import { html } from '../ui/html.js';
import { icon } from '../ui/icons.js';

const FLAG_LABELS = {
  FEVER: 'Fever',
  RAISED_TEMP: 'Raised temperature',
  HYPOTHERMIA: 'Low temperature',
  HYPERTENSIVE_CRISIS: 'Hypertensive crisis',
  HIGH_BP: 'High blood pressure',
  LOW_BP: 'Low blood pressure',
  TACHYCARDIA: 'Fast pulse',
  BRADYCARDIA: 'Slow pulse',
  HIGH_RESP_RATE: 'High respiratory rate',
  LOW_SPO2: 'Low oxygen saturation',
  BORDERLINE_SPO2: 'Borderline oxygen saturation',
};
const FLAG_FIELDS = {
  FEVER: ['temperature'], RAISED_TEMP: ['temperature'], HYPOTHERMIA: ['temperature'],
  HYPERTENSIVE_CRISIS: ['bp'], HIGH_BP: ['bp'], LOW_BP: ['bp'],
  TACHYCARDIA: ['pulse'], BRADYCARDIA: ['pulse'], HIGH_RESP_RATE: ['respRate'],
  LOW_SPO2: ['spo2'], BORDERLINE_SPO2: ['spo2'],
};

/** Read-only vitals summary with abnormal values highlighted (FR-NUR-05). */
export function vitalsPanel(triage, { compact = false } = {}) {
  if (!triage?.recordedAt) return html`<p class="text-sm text-slate-500">No vital signs recorded for this visit.</p>`;
  const v = triage.vitals || {};
  const flagged = new Set((triage.flags || []).flatMap((f) => FLAG_FIELDS[f] || []));
  const tile = (key, label, value, unit) => html`<div class="rounded-lg border px-3 py-2 ${flagged.has(key) ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}">
    <p class="text-xs text-slate-500">${label}</p>
    <p class="text-lg font-semibold ${flagged.has(key) ? 'text-rose-700' : 'text-slate-900'}">${value ?? '—'}${value != null ? html` <span class="text-xs font-normal text-slate-500">${unit}</span>` : ''}</p>
  </div>`;
  return html`<div class="space-y-4">
    ${triage.flags?.length
      ? html`<div class="flex flex-wrap gap-1.5">${triage.flags.map((f) => html`<span class="badge badge-red">${icon('alert', 'h-3 w-3')}${FLAG_LABELS[f] || f}</span>`)}</div>`
      : html`<p class="flex items-center gap-1.5 text-sm text-emerald-700">${icon('checkCircle', 'h-4 w-4')}All recorded values within normal ranges</p>`}
    <div class="${compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}">
      ${tile('temperature', 'Temperature', v.temperature, '°C')}
      ${tile('bp', 'Blood pressure', v.systolic ? `${v.systolic}/${v.diastolic ?? '–'}` : null, 'mmHg')}
      ${tile('pulse', 'Pulse', v.pulse, 'bpm')}
      ${tile('respRate', 'Resp. rate', v.respRate, '/min')}
      ${tile('spo2', 'SpO₂', v.spo2, '%')}
      ${tile('weight', 'Weight', v.weight, 'kg')}
      ${tile('height', 'Height', v.height, 'cm')}
      ${tile('bmi', 'BMI', v.bmi, 'kg/m²')}
    </div>
    ${triage.complaint ? html`<p class="text-sm"><span class="font-medium text-slate-700">Complaint:</span> ${triage.complaint}</p>` : ''}
    ${triage.notes ? html`<p class="text-sm whitespace-pre-line"><span class="font-medium text-slate-700">Nursing notes:</span> ${triage.notes}</p>` : ''}
  </div>`;
}
