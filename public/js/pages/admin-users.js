// FR-USR-01..03: administrator manages staff accounts.
import { api, qs } from '../api.js';
import { html, mount, $, formData, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, confirmDialog, withBusy } from '../ui/feedback.js';
import { ROLE_LABELS, statusBadge, fmtDateTime, initials } from '../ui/format.js';

const STAFF_ROLES = ['admin', 'receptionist', 'doctor', 'clinician', 'nurse', 'lab_tech', 'pharmacist'];

export async function render(root, { user: me }) {
  const filters = { q: '', role: '', status: 'active' };

  mount(
    root,
    html`<div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-sm text-slate-500">Create accounts for clinic staff, assign roles and deactivate accounts that are no longer needed.</p>
        </div>
        <button id="new-user" class="btn btn-primary">${icon('userPlus', 'h-4 w-4')}New staff account</button>
      </div>
      <div class="card">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div class="relative min-w-56 flex-1">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">${icon('search', 'h-4 w-4')}</span>
            <input id="q" class="input pl-9" placeholder="Search name, email or staff no." aria-label="Search staff" />
          </div>
          <select id="role" class="input w-auto" aria-label="Filter by role">
            <option value="">All roles</option>
            ${STAFF_ROLES.map((r) => html`<option value="${r}">${ROLE_LABELS[r]}</option>`)}
          </select>
          <select id="status" class="input w-auto" aria-label="Filter by status">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
          </select>
        </div>
        <div class="overflow-x-auto"><table class="table">
          <thead><tr><th>Name</th><th>Role</th><th>Staff no.</th><th>Department</th><th>Last sign-in</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>
    </div>`,
  );

  async function load() {
    try {
      const { users } = await api.get(`/users${qs(filters)}`);
      mount(
        $('#rows', root),
        users.length
          ? users.map(
              (u) => html`<tr>
                <td><div class="flex items-center gap-3">
                  <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">${initials(u)}</span>
                  <div><p class="font-medium text-slate-900">${u.firstName} ${u.lastName}</p><p class="text-xs text-slate-500">${u.email}</p></div>
                </div></td>
                <td><span class="badge badge-brand">${ROLE_LABELS[u.role]}</span></td>
                <td class="text-slate-600">${u.staffProfile?.staffNo || '—'}</td>
                <td class="text-slate-600">${u.staffProfile?.specialization || u.staffProfile?.department || '—'}</td>
                <td class="text-slate-600">${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never'}</td>
                <td>${statusBadge(u.isActive ? 'active' : 'inactive')}${u.mustChangePassword ? html` <span class="badge badge-amber">Temp. password</span>` : ''}</td>
                <td class="text-right whitespace-nowrap">
                  <button class="btn btn-ghost btn-sm" data-edit="${u._id}">${icon('edit', 'h-4 w-4')}Edit</button>
                  <button class="btn btn-ghost btn-sm" data-reset="${u._id}">${icon('key', 'h-4 w-4')}Reset</button>
                  ${String(u._id) !== String(me._id)
                    ? html`<button class="btn btn-ghost btn-sm ${u.isActive ? 'text-rose-600' : 'text-emerald-700'}" data-toggle="${u._id}">
                        ${icon(u.isActive ? 'ban' : 'check', 'h-4 w-4')}${u.isActive ? 'Deactivate' : 'Reactivate'}</button>`
                    : ''}
                </td>
              </tr>`,
            )
          : html`<tr><td colspan="7" class="py-12 text-center text-slate-500">No staff accounts match your filters.</td></tr>`,
      );
      root.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => openForm(users.find((u) => u._id === b.dataset.edit))));
      root.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => openReset(users.find((u) => u._id === b.dataset.reset))));
      root.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => toggle(users.find((u) => u._id === b.dataset.toggle), b)));
    } catch (err) {
      toastError(err);
    }
  }

  async function toggle(u, btn) {
    const deactivate = u.isActive;
    const ok = await confirmDialog({
      title: deactivate ? 'Deactivate account?' : 'Reactivate account?',
      message: deactivate
        ? `${u.firstName} ${u.lastName} will no longer be able to sign in. Their records are kept.`
        : `${u.firstName} ${u.lastName} will be able to sign in again.`,
      confirmText: deactivate ? 'Deactivate' : 'Reactivate',
      danger: deactivate,
    });
    if (!ok) return;
    await withBusy(btn, async () => {
      try {
        await api.patch(`/users/${u._id}`, { isActive: !deactivate });
        toast(deactivate ? 'Account deactivated.' : 'Account reactivated.');
        load();
      } catch (err) {
        toastError(err);
      }
    });
  }

  function openReset(u) {
    const { el, close } = openModal({
      title: 'Reset password',
      subtitle: `${u.firstName} ${u.lastName} will be asked to choose a new password at next sign-in.`,
      size: 'sm',
      content: html`<form class="space-y-4 p-5" novalidate>
        <div data-field><label class="label" for="rp">Temporary password</label>
          <input id="rp" name="password" type="text" class="input" autocomplete="off" placeholder="e.g. Welcome2026" /></div>
        <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button class="btn btn-primary">Reset password</button></div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await withBusy(form.querySelector('.btn-primary'), async () => {
        try {
          await api.post(`/users/${u._id}/reset-password`, formData(form));
          toast('Temporary password set. Share it with the staff member securely.');
          close();
          load();
        } catch (err) {
          showFieldErrors(form, err.details);
          if (!err.details) toastError(err);
        }
      });
    };
  }

  function openForm(u) {
    const editing = Boolean(u);
    const sp = u?.staffProfile || {};
    const { el, close } = openModal({
      title: editing ? 'Edit staff account' : 'New staff account',
      size: 'lg',
      content: html`<form class="p-5" novalidate>
        <div class="grid gap-4 sm:grid-cols-2">
          <div data-field><label class="label" for="f-first">First name</label><input id="f-first" name="firstName" class="input" value="${u?.firstName || ''}" /></div>
          <div data-field><label class="label" for="f-last">Last name</label><input id="f-last" name="lastName" class="input" value="${u?.lastName || ''}" /></div>
          <div data-field><label class="label" for="f-email">Email</label><input id="f-email" name="email" type="email" class="input" value="${u?.email || ''}" /></div>
          <div data-field><label class="label" for="f-phone">Phone <span class="label-hint">(optional)</span></label><input id="f-phone" name="phone" class="input" value="${u?.phone || ''}" placeholder="+2547…" /></div>
          <div data-field><label class="label" for="f-role">Role</label>
            <select id="f-role" name="role" class="input" ${editing && String(u._id) === String(me._id) ? 'disabled' : ''}>
              <option value="">Select a role…</option>
              ${STAFF_ROLES.map((r) => html`<option value="${r}" ${u?.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`)}
            </select></div>
          ${editing
            ? html`<div></div>`
            : html`<div data-field><label class="label" for="f-pass">Temporary password</label><input id="f-pass" name="password" type="text" autocomplete="off" class="input" placeholder="Changed at first sign-in" /></div>`}
        </div>
        <h3 class="mt-6 mb-3 text-sm font-semibold text-slate-900">Staff profile</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          <div data-field><label class="label" for="f-staffNo">Staff no.</label><input id="f-staffNo" name="staffNo" class="input" value="${sp.staffNo || ''}" /></div>
          <div data-field><label class="label" for="f-dept">Department</label><input id="f-dept" name="department" class="input" value="${sp.department || ''}" /></div>
          <div data-field><label class="label" for="f-room">Room</label><input id="f-room" name="room" class="input" value="${sp.room || ''}" /></div>
          <div data-field class="sm:col-span-2"><label class="label" for="f-spec">Specialisation / title</label><input id="f-spec" name="specialization" class="input" value="${sp.specialization || ''}" /></div>
          <div data-field><label class="label" for="f-lic">Licence no.</label><input id="f-lic" name="licenseNo" class="input" value="${sp.licenseNo || ''}" /></div>
        </div>
        <div class="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button class="btn btn-primary">${editing ? 'Save changes' : 'Create account'}</button>
        </div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      const body = {
        firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone,
        staffProfile: { staffNo: d.staffNo, department: d.department, room: d.room, specialization: d.specialization, licenseNo: d.licenseNo },
      };
      if (d.role !== undefined) body.role = d.role;
      if (!editing) body.password = d.password;
      // Drop empty optional profile fields (the API treats "" as invalid text for new records)
      for (const k of Object.keys(body.staffProfile)) if (!body.staffProfile[k]) delete body.staffProfile[k];
      if (!editing && !body.phone) delete body.phone;
      await withBusy(form.querySelector('.btn-primary'), async () => {
        try {
          if (editing) await api.patch(`/users/${u._id}`, body);
          else await api.post('/users', body);
          toast(editing ? 'Account updated.' : 'Account created. The user must change the temporary password at first sign-in.');
          close();
          load();
        } catch (err) {
          if (err.details) {
            // map nested staffProfile errors back to inputs
            const det = { ...err.details };
            if (det.staffProfile) det.staffNo = det.staffProfile;
            showFieldErrors(form, det);
          }
          toastError(err);
        }
      });
    };
  }

  let t;
  $('#q', root).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      filters.q = e.target.value.trim();
      load();
    }, 250);
  };
  $('#role', root).onchange = (e) => ((filters.role = e.target.value), load());
  $('#status', root).onchange = (e) => ((filters.status = e.target.value), load());
  $('#new-user', root).onclick = () => openForm(null);
  await load();
}
