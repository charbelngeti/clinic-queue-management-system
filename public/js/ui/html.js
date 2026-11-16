// Safe HTML templating: every interpolated value is HTML-escaped unless it was produced by html``
// (or wrapped in raw()). This is the frontend's main defence against stored XSS — patient names,
// notes and messages are user-entered data.
class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Mark a trusted string (e.g. a static SVG icon) as safe. Never use on user data. */
export const raw = (s) => new SafeHtml(String(s));

export function mount(el, content) {
  el.innerHTML = render(content);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Read a form into a plain object. Empty strings are kept so partial updates can clear fields. */
export function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else data[el.name] = el.value.trim();
  }
  return data;
}

/** Show server-side validation errors next to the matching inputs. */
export function showFieldErrors(form, details = {}) {
  clearFieldErrors(form);
  let first;
  for (const [name, message] of Object.entries(details || {})) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) continue;
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = message;
    (input.closest('[data-field]') || input.parentElement).appendChild(p);
    first ??= input;
  }
  first?.focus();
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach((e) => e.remove());
  form.querySelectorAll('.is-invalid').forEach((e) => {
    e.classList.remove('is-invalid');
    e.removeAttribute('aria-invalid');
  });
}
