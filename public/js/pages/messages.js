// Messaging (FR-MSG-01..05): reception is the hub; others talk to "Reception desk".
import { api } from '../api.js';
import { html, mount, $, formData, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy } from '../ui/feedback.js';
import { fmtDateTime, fmtTime, ROLE_LABELS } from '../ui/format.js';
import { refreshUnread } from '../app.js';

export async function render(root, { user, query }) {
  const desk = user.role === 'receptionist';
  let selected = query.get('c');
  let conversations = [];

  mount(
    root,
    html`<div class="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <aside class="card flex flex-col self-start">
        <div class="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 class="card-title">${desk ? 'Reception inbox' : 'Messages with reception'}</h3>
          <button id="new" class="btn btn-primary btn-sm">${icon('plus', 'h-4 w-4')}New</button>
        </div>
        <ul id="list" class="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto"></ul>
      </aside>
      <section id="thread"></section>
    </div>`,
  );

  const other = (c) => (desk ? `${c.counterpartId?.role === 'doctor' ? 'Dr. ' : ''}${c.counterpartId?.firstName} ${c.counterpartId?.lastName}` : 'Reception desk');
  const unreadFor = (c) => (desk ? c.unreadForReception : c.unreadForCounterpart);

  async function loadList() {
    try {
      ({ conversations } = await api.get('/messages'));
      mount(
        $('#list', root),
        conversations.length
          ? conversations.map(
              (c) => html`<li><button class="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${c._id === selected ? 'bg-brand-50/60' : ''}" data-id="${c._id}">
                <div class="min-w-0 flex-1">
                  <p class="flex items-center justify-between gap-2"><span class="truncate text-sm font-semibold text-slate-900">${other(c)}</span><span class="shrink-0 text-xs text-slate-400">${fmtTime(c.lastMessageAt)}</span></p>
                  <p class="truncate text-sm ${unreadFor(c) ? 'font-semibold text-slate-800' : 'text-slate-600'}">${c.subject}</p>
                  <p class="truncate text-xs text-slate-500">${c.lastMessagePreview}</p>
                </div>
                ${unreadFor(c) ? html`<span class="badge badge-red self-center">${unreadFor(c)}</span>` : ''}
              </button></li>`,
            )
          : html`<li class="px-4 py-10 text-center text-sm text-slate-500">${icon('inbox', 'mx-auto mb-2 h-6 w-6 text-slate-300')}No conversations yet.</li>`,
      );
    } catch (err) {
      if (err.status !== 401) toastError(err);
    }
  }

  async function openThread(id, { quiet = false } = {}) {
    selected = id;
    const el = $('#thread', root);
    if (!id) {
      return mount(el, html`<div class="card flex flex-col items-center px-6 py-20 text-center text-slate-500">${icon('message', 'h-8 w-8 text-slate-300')}<p class="mt-3 text-sm">Select a conversation or start a new one.</p></div>`);
    }
    try {
      const { conversation: c, messages } = await api.get(`/messages/${id}`);
      const scroller = el.querySelector('[data-scroll]');
      const draft = el.querySelector('textarea')?.value || '';
      mount(
        el,
        html`<div class="card flex h-[70vh] flex-col">
          <div class="card-header">
            <div><h3 class="card-title">${c.subject}</h3>
              <p class="text-xs text-slate-500">${desk ? `${other(c)} · ${ROLE_LABELS[c.counterpartId?.role] || ''}` : 'Reception desk'}${c.patientId ? ` · re: ${c.patientId.firstName} ${c.patientId.lastName} (${c.patientId.patientNo})` : ''}</p></div>
          </div>
          <div data-scroll class="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5">
            ${messages.map((m) => {
              const mine = String(m.senderId) === String(user._id) || (desk && m.senderRole === 'receptionist');
              return html`<div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200'}">
                  <p class="whitespace-pre-line">${m.body}</p>
                  <p class="mt-1 text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}">${m.senderName} · ${fmtDateTime(m.createdAt)}</p>
                </div></div>`;
            })}
          </div>
          <form class="flex items-end gap-2 border-t border-slate-100 p-4" novalidate>
            <textarea name="body" rows="2" class="input flex-1 resize-none" placeholder="Write a reply…" maxlength="2000" aria-label="Reply"></textarea>
            <button class="btn btn-primary" data-send>${icon('send', 'h-4 w-4')}Send</button>
          </form>
        </div>`,
      );
      const box = el.querySelector('[data-scroll]');
      box.scrollTop = box.scrollHeight;
      el.querySelector('textarea').value = draft;
      if (!quiet) el.querySelector('textarea').focus();
      const form = $('form', el);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const body = form.body.value.trim();
        if (!body) return;
        await withBusy($('[data-send]', form), async () => {
          try {
            await api.post(`/messages/${id}/reply`, { body });
            form.body.value = '';
            await openThread(id);
            loadList();
          } catch (err) {
            toastError(err);
          }
        });
      };
      form.body.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
      };
      void scroller;
      refreshUnread();
      loadList();
    } catch (err) {
      toastError(err);
    }
  }

  $('#list', root).onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (b) openThread(b.dataset.id);
  };

  $('#new', root).onclick = async () => {
    let recipients = [];
    if (desk) {
      try {
        ({ recipients } = await api.get('/messages/recipients'));
      } catch (err) {
        return toastError(err);
      }
    }
    const { el, close } = openModal({
      title: 'New message',
      subtitle: desk ? 'Send a message to a staff member or a patient with a portal account.' : 'Your message goes to the reception desk.',
      size: 'md',
      content: html`<form class="space-y-4 p-5" novalidate>
        ${desk
          ? html`<div data-field><label class="label" for="m-to">To</label><select id="m-to" name="toUserId" class="input"><option value="">Select a recipient…</option>
              ${['doctor', 'clinician', 'nurse', 'lab_tech', 'pharmacist', 'patient'].map(
                (r) => html`<optgroup label="${ROLE_LABELS[r]}s">${recipients.filter((u) => u.role === r).map((u) => html`<option value="${u._id}">${r === 'doctor' ? 'Dr. ' : ''}${u.firstName} ${u.lastName}</option>`)}</optgroup>`,
              )}</select></div>`
          : ''}
        <div data-field><label class="label" for="m-subj">Subject</label><input id="m-subj" name="subject" class="input" maxlength="120" /></div>
        <div data-field><label class="label" for="m-body">Message</label><textarea id="m-body" name="body" rows="4" class="input" maxlength="2000"></textarea></div>
        <p class="flex items-center gap-1.5 text-xs text-amber-700">${icon('info', 'h-4 w-4')}Messages are for coordination. Do not include clinical details.</p>
        <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-submit>${icon('send', 'h-4 w-4')}Send</button></div>
      </form>`,
    });
    const form = $('form', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      if (!d.toUserId) delete d.toUserId;
      await withBusy($('[data-submit]', form), async () => {
        try {
          const { conversation } = await api.post('/messages', d);
          toast('Message sent.');
          close();
          await loadList();
          openThread(conversation._id);
        } catch (err) {
          showFieldErrors(form, err.details);
          toastError(err);
        }
      });
    };
  };

  await loadList();
  await openThread(selected);
  const timer = setInterval(() => {
    loadList();
    if (selected && !document.querySelector('#thread textarea:focus')) openThread(selected, { quiet: true });
  }, 15000);
  return () => clearInterval(timer);
}
