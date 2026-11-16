// Medication formulary & stock (FR-PHA-05). Pharmacist: receive stock. Admin: add/edit formulary entries.
import { api } from '../api.js';
import { html, mount, $, formData, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy } from '../ui/feedback.js';

export async function render(root, { user }) {
  const isAdmin = user.role === 'admin';
  const isPharm = user.role === 'pharmacist';
  let filter = 'all';
  let q = '';

  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
          <button class="tab active" data-filter="all">All</button><button class="tab" data-filter="low">Low stock</button><button class="tab" data-filter="out">Out of stock</button>
        </div>
        <div class="flex gap-2">
          <input id="q" class="input w-60" placeholder="Search medication…" aria-label="Search medications" />
          ${isAdmin ? html`<button id="add" class="btn btn-primary">${icon('plus', 'h-4 w-4')}Add medication</button>` : ''}
        </div>
      </div>
      <div id="summary" class="grid gap-4 sm:grid-cols-3"></div>
      <div class="card overflow-x-auto"><table class="table">
        <thead><tr><th>Medication</th><th>Form</th><th>In stock</th><th>Reorder level</th><th>Clinicians</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
    </div>`,
  );

  let meds = [];
  async function load() {
    try {
      ({ medications: meds } = await api.get('/medications'));
      draw();
    } catch (err) {
      toastError(err);
    }
  }
  function draw() {
    const active = meds.filter((m) => m.isActive);
    const low = active.filter((m) => m.stockQty > 0 && m.stockQty <= m.reorderLevel);
    const out = active.filter((m) => m.stockQty === 0);
    mount(
      $('#summary', root),
      html`<div class="stat"><div><p class="stat-label">Active items</p><p class="stat-value">${active.length}</p></div><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">${icon('package')}</span></div>
        <div class="stat"><div><p class="stat-label">Low stock</p><p class="stat-value">${low.length}</p></div><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">${icon('alert')}</span></div>
        <div class="stat"><div><p class="stat-label">Out of stock</p><p class="stat-value">${out.length}</p></div><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">${icon('ban')}</span></div>`,
    );
    let list = meds;
    if (filter === 'low') list = low;
    if (filter === 'out') list = out;
    if (q) list = list.filter((m) => `${m.name} ${m.strength}`.toLowerCase().includes(q));
    mount(
      $('#rows', root),
      list.length
        ? list.map(
            (m) => html`<tr class="${m.isActive ? '' : 'opacity-50'}">
              <td class="font-medium text-slate-900">${m.name} ${m.strength}</td>
              <td class="text-slate-600">${m.form}</td>
              <td>${m.stockQty === 0 ? html`<span class="badge badge-red">0</span>` : m.stockQty <= m.reorderLevel ? html`<span class="badge badge-amber">${m.stockQty} · low</span>` : html`<span class="font-semibold">${m.stockQty}</span>`} <span class="text-xs text-slate-500">${m.unit}</span></td>
              <td class="text-slate-600">${m.reorderLevel}</td>
              <td>${m.clinicianMayPrescribe ? html`<span class="badge badge-green">Allowed</span>` : html`<span class="badge badge-slate">Doctor only</span>`}</td>
              <td>${m.isActive ? html`<span class="badge badge-green">Active</span>` : html`<span class="badge badge-slate">Inactive</span>`}</td>
              <td class="text-right whitespace-nowrap">
                ${isPharm && m.isActive ? html`<button class="btn btn-secondary btn-sm" data-receive="${m._id}">${icon('plus', 'h-4 w-4')}Receive stock</button>` : ''}
                ${isAdmin ? html`<button class="btn btn-ghost btn-sm" data-edit="${m._id}">${icon('edit', 'h-4 w-4')}Edit</button>` : ''}
              </td>
            </tr>`,
          )
        : html`<tr><td colspan="7" class="py-10 text-center text-slate-500">No medications match.</td></tr>`,
    );
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-filter]');
    if (t) {
      filter = t.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === t));
      draw();
    }
    const r = e.target.closest('[data-receive]');
    if (r) receive(meds.find((m) => m._id === r.dataset.receive));
    const ed = e.target.closest('[data-edit]');
    if (ed) edit(meds.find((m) => m._id === ed.dataset.edit));
  });
  $('#q', root).oninput = (e) => ((q = e.target.value.trim().toLowerCase()), draw());
  if (isAdmin) $('#add', root).onclick = () => edit(null);

  function receive(m) {
    const { el, close } = openModal({
      title: 'Receive stock',
      subtitle: `${m.name} ${m.strength} · currently ${m.stockQty} ${m.unit}`,
      size: 'sm',
      content: html`<form class="space-y-4 p-5" novalidate><div data-field><label class="label" for="rq">Quantity received</label><input id="rq" name="quantity" type="number" min="1" class="input" /></div>
        <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Add to stock</button></div></form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(form.querySelector('.btn-primary'), async () => {
        try {
          await api.post(`/medications/${m._id}/receive`, { quantity: Number(form.quantity.value) });
          toast('Stock updated.');
          close();
          load();
        } catch (err) {
          showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };
  }

  function edit(m) {
    const { el, close } = openModal({
      title: m ? 'Edit medication' : 'Add medication',
      size: 'md',
      content: html`<form class="grid gap-4 p-5 sm:grid-cols-2" novalidate>
        <div data-field class="sm:col-span-2"><label class="label" for="m-name">Name</label><input id="m-name" name="name" class="input" value="${m?.name || ''}" /></div>
        <div data-field><label class="label" for="m-str">Strength</label><input id="m-str" name="strength" class="input" placeholder="500 mg" value="${m?.strength || ''}" /></div>
        <div data-field><label class="label" for="m-form">Form</label><input id="m-form" name="form" class="input" placeholder="Tablet" value="${m?.form || ''}" /></div>
        <div data-field><label class="label" for="m-unit">Unit</label><input id="m-unit" name="unit" class="input" value="${m?.unit || 'units'}" /></div>
        <div data-field><label class="label" for="m-re">Reorder level</label><input id="m-re" name="reorderLevel" type="number" min="0" class="input" value="${m?.reorderLevel ?? 20}" /></div>
        ${m ? '' : html`<div data-field><label class="label" for="m-stock">Opening stock</label><input id="m-stock" name="stockQty" type="number" min="0" class="input" value="0" /></div>`}
        <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="clinicianMayPrescribe" class="accent-brand-600" ${!m || m.clinicianMayPrescribe ? 'checked' : ''} />Clinicians may prescribe</label>
        ${m ? html`<label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isActive" class="accent-brand-600" ${m.isActive ? 'checked' : ''} />Active (available for prescribing)</label>` : ''}
        <div class="flex justify-end gap-2 sm:col-span-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">${m ? 'Save' : 'Add medication'}</button></div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      d.reorderLevel = Number(d.reorderLevel);
      if (!m) d.stockQty = Number(d.stockQty);
      await withBusy(form.querySelector('.btn-primary'), async () => {
        try {
          if (m) await api.patch(`/medications/${m._id}`, d);
          else await api.post('/medications', d);
          toast(m ? 'Medication updated.' : 'Medication added.');
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
