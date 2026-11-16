// Application shell: loads the signed-in user, renders role-specific navigation and runs the hash router.
import { api } from './api.js';
import { html, mount, $ } from './ui/html.js';
import { icon } from './ui/icons.js';
import { toastError, confirmDialog } from './ui/feedback.js';
import { ROLE_LABELS, initials, setClinicTimeZone, fmtWeekday } from './ui/format.js';
import { NAV, HOME, matchRoute } from './routes.js';

const state = { user: null, cleanup: null, navToken: 0, badges: {} };
export const getUser = () => state.user;

/* ---------------- sidebar ---------------- */
function renderNav() {
  const sections = NAV[state.user.role] || [];
  const current = currentPath();
  mount(
    $('#nav'),
    sections.map(
      ([title, items]) => html`<div>
        <p class="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">${title}</p>
        <div class="space-y-0.5">
          ${items.map(
            ([path, label, ic]) => html`<a href="#${path}" class="nav-link ${current.startsWith(path) ? 'active' : ''}" data-path="${path}">
              ${icon(ic)}<span class="flex-1">${label}</span>
              <span class="badge badge-red" data-badge="${path}" ${state.badges[path] ? '' : 'hidden'}>${state.badges[path] || ''}</span>
            </a>`,
          )}
        </div>
      </div>`,
    ),
  );
}

/** Pages can show a count next to a nav item (e.g. unread messages). */
export function setNavBadge(path, count) {
  state.badges[path] = count;
  const el = document.querySelector(`[data-badge="${CSS.escape(path)}"]`);
  if (el) {
    el.textContent = count;
    el.hidden = !count;
  }
}

function renderUserCard() {
  const u = state.user;
  mount(
    $('#user-card'),
    html`<div class="flex items-center gap-3 rounded-lg p-2">
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">${initials(u)}</span>
      <div class="min-w-0 flex-1 leading-tight">
        <p class="truncate text-sm font-semibold text-slate-800">${u.role === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}</p>
        <p class="truncate text-xs text-slate-500">${u.email}</p>
      </div>
    </div>
    <div class="mt-1 grid grid-cols-2 gap-1">
      <a href="#/account/password" class="btn btn-ghost btn-sm justify-start">${icon('key', 'h-4 w-4')}Password</a>
      <button id="logout-btn" class="btn btn-ghost btn-sm justify-start">${icon('logout', 'h-4 w-4')}Sign out</button>
    </div>`,
  );
  $('#logout-btn').onclick = async () => {
    if (!(await confirmDialog({ title: 'Sign out?', message: 'You will need to sign in again to continue.', confirmText: 'Sign out' }))) return;
    await api.post('/auth/logout').catch(() => {});
    location.replace('/');
  };
  $('#role-label').textContent = ROLE_LABELS[u.role];
}

function renderTopbar() {
  mount(
    $('#topbar-right'),
    html`<span class="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 md:flex">
      ${icon('calendar', 'h-4 w-4')}<span id="today-label">${fmtWeekday(new Date())}</span>
    </span>`,
  );
}

/* ---------------- mobile menu ---------------- */
function setupMobileMenu() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  const open = () => {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  };
  const close = () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };
  $('#menu-btn').onclick = open;
  overlay.onclick = close;
  $('#nav').addEventListener('click', (e) => e.target.closest('a') && close());
}

/* ---------------- router ---------------- */
const home = () => HOME[state.user?.role] || '/account/password';
const currentPath = () => location.hash.replace(/^#/, '').split('?')[0] || home();
const currentQuery = () => new URLSearchParams(location.hash.split('?')[1] || '');

export const goHome = () => navigate(home());

export function navigate(path) {
  location.hash = `#${path}`;
}

function renderError(view, title, message) {
  mount(
    view,
    html`<div class="card mx-auto mt-10 max-w-lg p-10 text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">${icon('alert', 'h-6 w-6')}</span>
      <h2 class="mt-4 text-lg font-semibold text-slate-900">${title}</h2>
      <p class="mt-1 text-sm text-slate-500">${message}</p>
      <a href="#${home()}" class="btn btn-primary mt-6">Back to my home page</a>
    </div>`,
  );
}

async function route() {
  const token = ++state.navToken;
  if (typeof state.cleanup === 'function') state.cleanup();
  state.cleanup = null;

  const path = currentPath();
  if (state.user.mustChangePassword && path !== '/account/password') return navigate('/account/password');

  const view = $('#view');
  const match = matchRoute(path);
  renderNav();
  if (!match) {
    document.title = 'Not found · CareQueue Clinic';
    $('#page-title').textContent = 'Page not found';
    return renderError(view, 'Page not found', 'The page you are looking for does not exist.');
  }
  const { route: r, params } = match;
  if (!r.roles.includes(state.user.role)) {
    $('#page-title').textContent = 'Access denied';
    return renderError(view, 'Access denied', `Your role (${ROLE_LABELS[state.user.role]}) cannot open this page.`);
  }

  $('#page-title').textContent = r.title;
  document.title = `${r.title} · CareQueue Clinic`;
  mount(view, html`<div class="space-y-4"><div class="skeleton h-8 w-1/3"></div><div class="skeleton h-40 w-full"></div></div>`);

  try {
    const mod = await r.load();
    if (token !== state.navToken) return; // user navigated away while loading
    const ctx = {
      user: state.user,
      params,
      query: currentQuery(),
      setTitle: (t) => {
        $('#page-title').textContent = t;
        document.title = `${t} · CareQueue Clinic`;
      },
      isCurrent: () => token === state.navToken,
    };
    view.innerHTML = '';
    state.cleanup = await mod.render(view, ctx);
    view.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    if (token === state.navToken) renderError(view, 'Could not load this page', err.message);
  }
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    const { user, clinic } = await api.get('/auth/me');
    state.user = user;
    setClinicTimeZone(clinic?.timeZone);
  } catch {
    location.replace('/');
    return;
  }
  renderUserCard();
  renderTopbar();
  setupMobileMenu();
  window.addEventListener('hashchange', route);
  if (!location.hash || location.hash === '#/') history.replaceState(null, '', `#${home()}`);
  await route();
}

/** Called by pages that change the signed-in user (e.g. after a password change). */
export function updateUser(user) {
  state.user = user;
  renderUserCard();
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status) toastError(e.reason);
});

boot();
