import { api } from './api.js';
import { formData, showFieldErrors, clearFieldErrors } from './ui/html.js';
import { withBusy } from './ui/feedback.js';

const form = document.getElementById('login-form');
const alertBox = document.getElementById('login-alert');

function showAlert(message, tone = 'error') {
  alertBox.textContent = message;
  alertBox.className = `mt-6 rounded-lg border px-4 py-3 text-sm ${
    tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-700'
  }`;
}

// Already signed in? Go straight to the app.
api.get('/auth/me').then(() => location.replace('/app')).catch(() => {});

if (new URLSearchParams(location.search).has('expired')) showAlert('Your session has ended. Please sign in again.', 'info');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  alertBox.classList.add('hidden');
  const data = formData(form);
  const errors = {};
  if (!data.email) errors.email = 'Enter your email address.';
  if (!data.password) errors.password = 'Enter your password.';
  if (Object.keys(errors).length) return showFieldErrors(form, errors);

  await withBusy(document.getElementById('login-btn'), async () => {
    try {
      await api.post('/auth/login', data);
      location.replace('/app');
    } catch (err) {
      showAlert(err.message);
      form.password.value = '';
      form.password.focus();
    }
  });
});
