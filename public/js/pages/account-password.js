import { api } from '../api.js';
import { html, mount, formData, showFieldErrors, clearFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, withBusy } from '../ui/feedback.js';
import { updateUser, goHome } from '../app.js';

export async function render(root, { user }) {
  mount(
    root,
    html`<div class="mx-auto max-w-lg">
      ${user.mustChangePassword
        ? html`<div class="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ${icon('key')}<p><strong>Set a new password to continue.</strong> Your account was created with a temporary password.</p>
          </div>`
        : ''}
      <form class="card" novalidate>
        <div class="card-header"><h2 class="card-title">Change password</h2></div>
        <div class="card-body space-y-5">
          <div data-field>
            <label class="label" for="currentPassword">Current password</label>
            <input class="input" type="password" id="currentPassword" name="currentPassword" autocomplete="current-password" />
          </div>
          <div data-field>
            <label class="label" for="newPassword">New password <span class="label-hint">(8+ characters, letters and numbers)</span></label>
            <input class="input" type="password" id="newPassword" name="newPassword" autocomplete="new-password" />
          </div>
          <div data-field>
            <label class="label" for="confirmPassword">Confirm new password</label>
            <input class="input" type="password" id="confirmPassword" name="confirmPassword" autocomplete="new-password" />
          </div>
        </div>
        <div class="flex justify-end border-t border-slate-100 px-5 py-4">
          <button class="btn btn-primary" type="submit">Update password</button>
        </div>
      </form>
    </div>`,
  );

  const form = root.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const data = formData(form);
    if (data.newPassword !== data.confirmPassword) return showFieldErrors(form, { confirmPassword: 'Passwords do not match.' });
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { user: updated } = await api.patch('/auth/password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
        updateUser(updated);
        toast('Password updated.');
        goHome();
      } catch (err) {
        if (err.details) showFieldErrors(form, err.details);
        toast(err.message, 'error');
      }
    });
  };
}
