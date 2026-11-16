// Pharmacy workspace (FR-PHA-01..04): review the prescription, check allergies and stock, dispense.
import { api } from '../api.js';
import { html, mount, $, $$ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, withBusy, confirmDialog } from '../ui/feedback.js';
import { fmtTime, statusBadge } from '../ui/format.js';
import { stageWorkspace } from '../components/workspace.js';

export async function render(root) {
  return stageWorkspace(root, {
    stage: 'pharmacy',
    wide: true,
    emptyHint: 'Press “Call next” to call the next patient to the pharmacy window.',
    renderCurrent: async (el, visit, reload) => {
      mount(el, html`<div class="skeleton h-72"></div>`);
      let data;
      try {
        data = await api.get(`/pharmacy/visit/${visit._id}`);
      } catch (err) {
        return toastError(err);
      }
      const rx = data.prescription;
      if (!rx) return mount(el, html`<div class="card p-8 text-center text-sm text-slate-500">No prescription found for this visit.</div>`);
      mount(
        el,
        html`<form class="card" novalidate>
          <div class="card-header">
            <div><h3 class="card-title">${rx.rxNo}</h3>
              <p class="text-xs text-slate-500">Prescribed by ${rx.prescriber.name}${rx.prescriber.licenseNo ? ` (${rx.prescriber.licenseNo})` : ''} at ${fmtTime(rx.createdAt)}</p></div>
            ${statusBadge(rx.status)}
          </div>
          ${data.allergyConflicts?.length
            ? html`<div class="flex gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">${icon('alert')}
                <p><strong>Allergy alert:</strong> patient allergic to ${data.patient.allergies.join(', ')}. Check ${data.allergyConflicts.join(', ')} with the prescriber before dispensing.</p></div>`
            : ''}
          ${rx.notes ? html`<p class="border-b border-slate-100 px-5 py-2 text-sm text-slate-600"><span class="font-medium">Prescriber notes:</span> ${rx.notes}</p>` : ''}
          <div class="overflow-x-auto"><table class="table">
            <thead><tr><th>Medication</th><th>Directions</th><th>Prescribed</th><th>In stock</th><th>Dispense now</th></tr></thead>
            <tbody>${rx.items.map((it) => {
              const remaining = it.quantity - it.dispensedQty;
              const stock = data.stock[it.medicationId]?.stockQty ?? 0;
              const def = Math.min(remaining, stock);
              return html`<tr data-item="${it._id}">
                <td class="font-medium">${it.name} ${it.strength}<p class="text-xs text-slate-500">${it.form}</p></td>
                <td class="text-sm text-slate-600">${it.dose}, ${it.frequency}, ${it.durationDays} days${it.instructions ? html`<p class="text-xs">${it.instructions}</p>` : ''}</td>
                <td>${it.quantity}${it.dispensedQty ? html`<p class="text-xs text-slate-500">${it.dispensedQty} already given</p>` : ''}</td>
                <td>${stock < remaining ? html`<span class="badge badge-red">${stock} (short)</span>` : html`<span class="badge badge-green">${stock}</span>`}</td>
                <td><input type="number" min="0" max="${remaining}" class="input w-24 py-1.5" name="qty" value="${def}" aria-label="Quantity to dispense" /></td>
              </tr>`;
            })}</tbody>
          </table></div>
          <div class="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
            <p class="text-xs text-slate-500">Stock is reduced and the visit completed in one transaction. Anything not given is recorded as partially dispensed.</p>
            <button class="btn btn-primary" data-submit>${icon('pill', 'h-4 w-4')}Dispense &amp; complete</button>
          </div>
        </form>`,
      );
      const form = $('form', el);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const lines = $$('[data-item]', form).map((tr) => ({ itemId: tr.dataset.item, quantity: Number(tr.querySelector('[name=qty]').value) || 0 }));
        const partial = rx.items.some((it) => (lines.find((l) => l.itemId === it._id)?.quantity || 0) < it.quantity - it.dispensedQty);
        if (partial && !(await confirmDialog({ title: 'Partial dispensing', message: 'Some items will not be fully dispensed (e.g. insufficient stock). The prescription will be marked “partially dispensed”. Continue?', confirmText: 'Dispense' }))) return;
        await withBusy($('[data-submit]', form), async () => {
          try {
            const { prescription } = await api.post(`/pharmacy/prescriptions/${rx._id}/dispense`, { lines });
            toast(`${prescription.rxNo} ${prescription.status === 'dispensed' ? 'dispensed' : 'partially dispensed'}. Visit complete.`);
            reload();
          } catch (err) {
            toastError(err);
          }
        });
      };
    },
  });
}
