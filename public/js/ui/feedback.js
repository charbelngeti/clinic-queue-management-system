// Toasts, modals and confirmation dialogs (NFR-USE-02: visual feedback for every action).
import { html, mount, $ } from './html.js';
import { icon } from './icons.js';

function toastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

const TOAST_STYLES = {
  success: ['checkCircle', 'text-emerald-600'],
  error: ['alert', 'text-rose-600'],
  info: ['info', 'text-sky-600'],
  warning: ['alert', 'text-amber-500'],
};

export function toast(message, type = 'success', timeout = 4000) {
  const [ic, color] = TOAST_STYLES[type] || TOAST_STYLES.info;
  const el = document.createElement('div');
  el.className =
    'pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-pop transition-all duration-300 translate-y-2 opacity-0';
  mount(el, html`<span class="${color}">${icon(ic)}</span>
    <p class="flex-1 text-sm font-medium text-slate-800">${message}</p>
    <button class="text-slate-400 hover:text-slate-600" aria-label="Dismiss">${icon('x', 'h-4 w-4')}</button>`);
  el.querySelector('button').onclick = () => el.remove();
  toastRoot().appendChild(el);
  requestAnimationFrame(() => el.classList.remove('translate-y-2', 'opacity-0'));
  setTimeout(() => {
    el.classList.add('opacity-0');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

export const toastError = (err) => toast(err?.message || 'Something went wrong.', 'error', 6000);

/**
 * Open a modal dialog. `content` is html``; returns { el, close }.
 * size: 'sm' | 'md' | 'lg' | 'xl'
 */
export function openModal({ title, subtitle, content, size = 'md', onClose }) {
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  mount(wrap, html`<div class="card my-8 w-full ${widths[size]} shadow-pop">
    <div class="card-header">
      <div>
        <h2 class="card-title">${title}</h2>
        ${subtitle ? html`<p class="mt-0.5 text-sm text-slate-500">${subtitle}</p>` : ''}
      </div>
      <button class="btn-icon" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="modal-body">${content}</div>
  </div>`);
  const previouslyFocused = document.activeElement;
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    previouslyFocused?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => e.target === wrap && close());
  wrap.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  document.body.appendChild(wrap);
  ($('input:not([type=hidden]),select,textarea', wrap) || $('[data-close]', wrap))?.focus();
  return { el: wrap, close };
}

/** Confirmation dialog for destructive or important actions. Resolves true/false. */
export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { el, close } = openModal({
      title,
      size: 'sm',
      content: html`<div class="card-body text-sm text-slate-600">${message}</div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button class="btn btn-secondary" data-close>Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${confirmText}</button>
        </div>`,
      onClose: () => !answered && resolve(false),
    });
    el.querySelector('[data-ok]').onclick = () => {
      answered = true;
      close();
      resolve(true);
    };
    el.querySelector('[data-ok]').focus();
  });
}

/** Ask for a short text (e.g. cancellation reason). Resolves the string or null. */
export function promptDialog({ title, label, placeholder = '', confirmText = 'Submit', danger = false, required = true }) {
  return new Promise((resolve) => {
    let answered = false;
    const { el, close } = openModal({
      title,
      size: 'sm',
      content: html`<form class="space-y-4 p-5" novalidate>
          <div data-field>
            <label class="label" for="prompt-input">${label}</label>
            <textarea id="prompt-input" name="value" rows="3" class="input" placeholder="${placeholder}" maxlength="300"></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${confirmText}</button>
          </div>
        </form>`,
      onClose: () => !answered && resolve(null),
    });
    const form = el.querySelector('form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const value = form.value.value.trim();
      if (required && !value) {
        form.value.classList.add('is-invalid');
        form.value.focus();
        return;
      }
      answered = true;
      close();
      resolve(value);
    };
  });
}

/** Disable a button and show a spinner while an async action runs. */
export async function withBusy(button, fn) {
  if (!button) return fn();
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span>Working…</span>`;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}
