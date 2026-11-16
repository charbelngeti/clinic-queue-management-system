// Public "Who's Next in Line" display (FR-QUE-09). No login; shows ticket numbers only.
import { html, mount } from './ui/html.js';

const TZ = 'Africa/Nairobi';
const STAGES = [
  ['triage', 'Triage', 'Nurse station'],
  ['consultation', 'Consultation', 'Doctors & clinicians'],
  ['lab', 'Laboratory', 'Sample collection'],
  ['pharmacy', 'Pharmacy', 'Medication pick-up'],
];
const seenCalls = new Map(); // ticket → calledAt already announced

function tick() {
  const now = new Date();
  document.getElementById('clock').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(now);
  document.getElementById('date').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
}

function announce(text) {
  const el = document.getElementById('announce');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(announce.t);
  announce.t = setTimeout(() => el.classList.add('hidden'), 8000);
}

async function load() {
  try {
    const res = await fetch('/api/public/queue', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const { stages } = await res.json();
    const fresh = [];
    mount(
      document.getElementById('board'),
      STAGES.map(([key, label, sub]) => {
        const s = stages[key];
        for (const c of s.nowServing) {
          const recent = Date.now() - new Date(c.calledAt).getTime() < 60000;
          if (c.status === 'called' && recent && seenCalls.get(c.ticketNo) !== c.calledAt) {
            seenCalls.set(c.ticketNo, c.calledAt);
            fresh.push(`${c.ticketNo} → ${c.room || label}`);
          }
        }
        return html`<section class="flex flex-col rounded-3xl bg-white/5 ring-1 ring-white/10">
          <header class="border-b border-white/10 px-6 py-4">
            <h2 class="text-2xl font-bold">${label}</h2>
            <p class="text-sm text-slate-400">${sub} · ${s.waitingCount} waiting</p>
          </header>
          <div class="px-6 py-5">
            <p class="text-xs font-semibold tracking-widest text-brand-300 uppercase">Now serving</p>
            <ul class="mt-3 space-y-2">
              ${s.nowServing.length
                ? s.nowServing.slice(0, 4).map(
                    (c) => html`<li class="flex items-center justify-between rounded-2xl px-4 py-3 ${c.status === 'called' ? 'animate-pulse bg-brand-500 text-white' : 'bg-white/10'}">
                      <span class="font-mono text-4xl font-black tracking-tight">${c.ticketNo}</span>
                      <span class="text-right text-lg font-semibold">${c.room || '—'}<span class="block text-xs font-normal opacity-80">${c.status === 'called' ? 'Please proceed' : 'In progress'}</span></span>
                    </li>`,
                  )
                : html`<li class="rounded-2xl bg-white/5 px-4 py-6 text-center text-slate-500">—</li>`}
            </ul>
          </div>
          <div class="mt-auto border-t border-white/10 px-6 py-5">
            <p class="text-xs font-semibold tracking-widest text-slate-400 uppercase">Next in line</p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${s.next.length ? s.next.map((n) => html`<span class="rounded-xl bg-white/10 px-3 py-1.5 font-mono text-xl font-bold">${n.ticketNo}</span>`) : html`<span class="text-slate-500">No one waiting</span>`}
            </div>
          </div>
        </section>`;
      }),
    );
    if (fresh.length) announce(`Now calling: ${fresh.join('   ·   ')}`);
    document.getElementById('status').textContent = `Updated ${new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeStyle: 'medium' }).format(new Date())}`;
  } catch {
    document.getElementById('status').textContent = 'Connection lost — retrying…';
  }
}

tick();
setInterval(tick, 10000);
load();
setInterval(load, 4000);
