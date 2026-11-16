// Laboratory workspace (FR-LAB-01..04): call next, collect sample, enter and release results.
import { api } from '../api.js';
import { html, mount, $, $$ } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, withBusy, confirmDialog } from '../ui/feedback.js';
import { fmtTime, statusBadge } from '../ui/format.js';
import { stageWorkspace } from '../components/workspace.js';

export async function render(root) {
  let catalogue = [];
  try {
    catalogue = (await api.get('/lab-tests')).labTests;
  } catch {
    /* reference ranges are optional pre-fills */
  }
  const ref = (code) => catalogue.find((t) => t.code === code) || {};

  return stageWorkspace(root, {
    stage: 'lab',
    wide: true,
    emptyHint: 'Press “Call next” to call the next patient for sample collection.',
    renderCurrent: async (el, visit, reload) => {
      mount(el, html`<div class="skeleton h-72"></div>`);
      let data;
      try {
        data = await api.get(`/lab/visit/${visit._id}`);
      } catch (err) {
        return toastError(err);
      }
      const open = data.requests.filter((r) => r.status !== 'completed');
      mount(
        el,
        html`<div class="space-y-5">${open.length
          ? open.map(
              (r) => html`<form class="card" data-req="${r._id}" novalidate>
                <div class="card-header">
                  <div><h3 class="card-title">${r.requestNo}</h3>
                    <p class="text-xs text-slate-500">Requested by ${r.requestedByName} at ${fmtTime(r.createdAt)} ${r.priority === 'urgent' ? html`· <span class="badge badge-red">Urgent</span>` : ''}</p></div>
                  <div class="flex items-center gap-2">${statusBadge(r.status)}
                    ${r.status === 'requested' ? html`<button type="button" class="btn btn-secondary btn-sm" data-status="sample_collected">${icon('check', 'h-4 w-4')}Sample collected</button>` : ''}
                    ${r.status === 'sample_collected' ? html`<button type="button" class="btn btn-secondary btn-sm" data-status="in_progress">Start analysis</button>` : ''}
                  </div>
                </div>
                ${r.clinicalNotes ? html`<p class="border-b border-slate-100 px-5 py-2 text-sm text-slate-600"><span class="font-medium">Clinical notes:</span> ${r.clinicalNotes}</p>` : ''}
                <div class="overflow-x-auto"><table class="table">
                  <thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Flag</th><th>Comment</th></tr></thead>
                  <tbody>${r.tests.map((t) => {
                    const c = ref(t.code);
                    const dis = r.status === 'requested' ? 'disabled' : '';
                    return html`<tr data-line="${t._id}">
                      <td class="font-medium">${t.name}<p class="text-xs text-slate-500">${t.code}</p></td>
                      <td data-field><input class="input min-w-44 py-1.5" name="value" ${dis} placeholder="Result" /></td>
                      <td><input class="input w-24 py-1.5" name="unit" ${dis} value="${c.unit || ''}" /></td>
                      <td><input class="input w-32 py-1.5" name="refRange" ${dis} value="${c.refRange || ''}" /></td>
                      <td><select class="input w-28 py-1.5" name="flag" ${dis}><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></td>
                      <td><input class="input py-1.5" name="comment" ${dis} /></td>
                    </tr>`;
                  })}</tbody>
                </table></div>
                <div class="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
                  <p class="text-xs text-slate-500">${r.status === 'requested' ? 'Record sample collection to enable result entry.' : 'Releasing results sends the patient back to the requesting clinician.'}</p>
                  <button class="btn btn-primary" data-submit ${r.status === 'requested' ? 'disabled' : ''}>${icon('send', 'h-4 w-4')}Release results</button>
                </div>
              </form>`,
            )
          : html`<div class="card p-8 text-center text-sm text-slate-500">All requests for this patient are complete.</div>`}</div>`,
      );

      $$('[data-status]', el).forEach(
        (b) =>
          (b.onclick = () =>
            withBusy(b, async () => {
              try {
                await api.post(`/lab/requests/${b.closest('[data-req]').dataset.req}/status`, { status: b.dataset.status });
                toast(b.dataset.status === 'sample_collected' ? 'Sample collection recorded.' : 'Analysis started.');
                reload();
              } catch (err) {
                toastError(err);
              }
            })),
      );
      $$('form[data-req]', el).forEach(
        (form) =>
          (form.onsubmit = async (e) => {
            e.preventDefault();
            const results = $$('[data-line]', form).map((tr) => ({
              lineId: tr.dataset.line,
              value: tr.querySelector('[name=value]').value.trim(),
              unit: tr.querySelector('[name=unit]').value.trim() || undefined,
              refRange: tr.querySelector('[name=refRange]').value.trim() || undefined,
              flag: tr.querySelector('[name=flag]').value,
              comment: tr.querySelector('[name=comment]').value.trim() || undefined,
            }));
            const missing = results.filter((r) => !r.value);
            missing.forEach((m) => form.querySelector(`[data-line="${m.lineId}"] [name=value]`).classList.add('is-invalid'));
            if (missing.length) return toastError({ message: 'Enter a result for every test before releasing.' });
            if (!(await confirmDialog({ title: 'Release results?', message: 'Results become visible to the requesting clinician and can no longer be edited.', confirmText: 'Release results' }))) return;
            await withBusy($('[data-submit]', form), async () => {
              try {
                await api.post(`/lab/requests/${form.dataset.req}/results`, { results });
                toast(`Results released. ${visit.ticketNo} returns to consultation.`);
                reload();
              } catch (err) {
                toastError(err);
              }
            });
          }),
      );
    },
  });
}
