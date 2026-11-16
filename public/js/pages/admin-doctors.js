// FR-DOC-01/03: admin maintains each doctor's weekly availability, slot length and days off.
import { api } from '../api.js';
import { html, mount, $, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy } from '../ui/feedback.js';
import { fmtDate, clinicToday } from '../ui/format.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export async function render(root) {
  async function load() {
    let doctors;
    try {
      ({ doctors } = await api.get('/doctors'));
    } catch (err) {
      return toastError(err);
    }
    mount(
      root,
      html`<div class="space-y-5">
        <p class="text-sm text-slate-500">Weekly working hours determine the appointment slots offered at reception and in the patient portal.</p>
        <div class="grid gap-5 lg:grid-cols-2">
          ${doctors.map((d) => {
            const sp = d.staffProfile || {};
            return html`<div class="card">
              <div class="card-header">
                <div><h3 class="card-title">Dr. ${d.firstName} ${d.lastName}</h3><p class="text-sm text-slate-500">${sp.specialization || 'General'} · ${sp.room || 'No room'} · ${sp.slotMinutes || '—'} min slots</p></div>
                <button class="btn btn-secondary btn-sm" data-edit="${d._id}">${icon('edit', 'h-4 w-4')}Edit schedule</button>
              </div>
              <ul class="divide-y divide-slate-100">
                ${ORDER.map((day) => {
                  const blocks = (sp.availability || []).filter((a) => a.dayOfWeek === day);
                  return html`<li class="flex items-center justify-between px-5 py-2 text-sm">
                    <span class="w-28 font-medium text-slate-700">${DAYS[day]}</span>
                    <span class="flex flex-wrap justify-end gap-1">${blocks.length ? blocks.map((b) => html`<span class="badge badge-brand">${b.start}–${b.end}</span>`) : html`<span class="text-slate-400">Off</span>`}</span>
                  </li>`;
                })}
              </ul>
              ${(sp.unavailableDates || []).filter((x) => x >= clinicToday()).length
                ? html`<div class="border-t border-slate-100 px-5 py-3 text-xs text-slate-600"><span class="font-semibold">Days off:</span> ${(sp.unavailableDates || []).filter((x) => x >= clinicToday()).map((x) => fmtDate(`${x}T12:00:00Z`)).join(', ')}</div>`
                : ''}
            </div>`;
          })}
        </div>
      </div>`,
    );
    root.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => edit(doctors.find((d) => d._id === b.dataset.edit))));
  }

  function edit(doctor) {
    const sp = doctor.staffProfile || {};
    const blocksFor = (day) => (sp.availability || []).filter((a) => a.dayOfWeek === day);
    const row = (day) => {
      const [b1, b2] = blocksFor(day);
      return html`<tr>
        <td class="font-medium">${DAYS[day]}</td>
        <td><div class="flex items-center gap-1"><input type="time" class="input py-1" name="s1-${day}" value="${b1?.start || ''}" aria-label="${DAYS[day]} start" /><span>–</span><input type="time" class="input py-1" name="e1-${day}" value="${b1?.end || ''}" aria-label="${DAYS[day]} end" /></div></td>
        <td><div class="flex items-center gap-1"><input type="time" class="input py-1" name="s2-${day}" value="${b2?.start || ''}" aria-label="${DAYS[day]} second start" /><span>–</span><input type="time" class="input py-1" name="e2-${day}" value="${b2?.end || ''}" aria-label="${DAYS[day]} second end" /></div></td>
      </tr>`;
    };
    const { el, close } = openModal({
      title: `Schedule: Dr. ${doctor.firstName} ${doctor.lastName}`,
      subtitle: 'Leave a day empty if the doctor does not work. The second block is optional (e.g. after lunch).',
      size: 'xl',
      content: html`<form class="space-y-5 p-5" novalidate>
        <div class="overflow-x-auto"><table class="table"><thead><tr><th>Day</th><th>Morning / main block</th><th>Second block</th></tr></thead><tbody>${ORDER.map(row)}</tbody></table></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div data-field><label class="label" for="slot">Appointment length</label>
            <select id="slot" name="slotMinutes" class="input">${[10, 15, 20, 30, 45, 60].map((m) => html`<option value="${m}" ${sp.slotMinutes === m ? 'selected' : ''}>${m} minutes</option>`)}</select></div>
          <div data-field><label class="label" for="off">Days off <span class="label-hint">(YYYY-MM-DD, comma-separated)</span></label>
            <input id="off" name="unavailableDates" class="input" placeholder="2026-12-24, 2026-12-26" value="${(sp.unavailableDates || []).filter((x) => x >= clinicToday()).join(', ')}" /></div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-submit>Save schedule</button>
        </div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const availability = [];
      for (const day of ORDER) {
        for (const n of [1, 2]) {
          const s = form[`s${n}-${day}`].value;
          const en = form[`e${n}-${day}`].value;
          if (s || en) {
            if (!s || !en) return toastError({ message: `${DAYS[day]}: enter both a start and an end time.` });
            availability.push({ dayOfWeek: day, start: s, end: en });
          }
        }
      }
      const unavailableDates = form.unavailableDates.value.split(',').map((x) => x.trim()).filter(Boolean);
      await withBusy($('[data-submit]', form), async () => {
        try {
          await api.put(`/doctors/${doctor._id}/availability`, { availability, slotMinutes: Number(form.slotMinutes.value), unavailableDates });
          toast('Schedule saved.');
          close();
          load();
        } catch (err) {
          showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };
  }
  await load();
}
