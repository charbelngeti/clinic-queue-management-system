// Patient record (front-desk view): demographics, portal access, appointments, quick actions.
import { api, qs } from '../api.js';
import { html, mount, $, formData, showFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy, promptDialog } from '../ui/feedback.js';
import { fullName, fmtDate, fmtTime, age, statusBadge, initials } from '../ui/format.js';
import { openPatientForm } from '../components/patient-form.js';
import { openBookingDialog, openCheckInDialog } from '../components/booking.js';

export async function render(root, { user, params, setTitle }) {
  const canWrite = user.role === 'receptionist';

  async function load() {
    let patient, appointments;
    try {
      [{ patient }, { appointments }] = await Promise.all([
        api.get(`/patients/${params.id}`),
        api.get(`/appointments${qs({ patientId: params.id })}`).catch(() => ({ appointments: [] })),
      ]);
    } catch (err) {
      toastError(err);
      return mount(root, html`<div class="card p-10 text-center text-slate-500">Patient record could not be loaded.</div>`);
    }
    setTitle(fullName(patient));
    const ec = patient.emergencyContact || {};
    const field = (label, value) => html`<div><dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">${label}</dt><dd class="mt-0.5 text-sm text-slate-900">${value || '—'}</dd></div>`;

    mount(
      root,
      html`<div class="space-y-5">
        <a href="#/patients" class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">${icon('chevronLeft', 'h-4 w-4')}All patients</a>
        <div class="card p-5">
          <div class="flex flex-wrap items-start gap-4">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700">${initials(patient)}</span>
            <div class="min-w-0 flex-1">
              <h2 class="text-xl font-bold tracking-tight text-slate-900">${fullName(patient)}</h2>
              <p class="mt-0.5 text-sm text-slate-500"><span class="font-mono">${patient.patientNo}</span> · ${patient.sex}, ${age(patient.dateOfBirth)} years (born ${fmtDate(patient.dateOfBirth)})</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                ${patient.allergies?.length
                  ? patient.allergies.map((a) => html`<span class="badge badge-red">${icon('alert', 'h-3 w-3')}Allergy: ${a}</span>`)
                  : html`<span class="badge badge-slate">No known allergies</span>`}
                ${(patient.chronicConditions || []).map((c) => html`<span class="badge badge-violet">${c}</span>`)}
              </div>
            </div>
            ${canWrite
              ? html`<div class="flex flex-wrap gap-2">
                  <button class="btn btn-secondary" data-edit>${icon('edit', 'h-4 w-4')}Edit</button>
                  <button class="btn btn-secondary" data-book>${icon('calendarPlus', 'h-4 w-4')}Book appointment</button>
                  <button class="btn btn-primary" data-walkin>${icon('queue', 'h-4 w-4')}Walk-in check-in</button>
                </div>`
              : ''}
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-3">
          <div class="card lg:col-span-2">
            <div class="card-header"><h3 class="card-title">Details</h3></div>
            <dl class="card-body grid gap-5 sm:grid-cols-3">
              ${field('Phone', patient.phone)}${field('Email', patient.email)}${field('National ID', patient.nationalId)}
              ${field('Address', patient.address)}${field('Blood group', patient.bloodGroup)}${field('Registered', fmtDate(patient.createdAt))}
              ${field('Emergency contact', ec.name ? `${ec.name}${ec.relationship ? ` (${ec.relationship})` : ''}` : '')}${field('Emergency phone', ec.phone)}
            </dl>
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Patient portal</h3></div>
            <div class="card-body text-sm">
              ${patient.userId
                ? html`<p class="flex items-center gap-2 text-emerald-700">${icon('checkCircle', 'h-5 w-5')}Portal account active</p>
                    <p class="mt-2 text-slate-500">The patient can sign in to book, cancel and track their queue position.</p>`
                : html`<p class="text-slate-500">No portal account yet. Patients can only receive an account from reception.</p>
                    ${canWrite ? html`<button class="btn btn-primary btn-sm mt-4" data-portal>${icon('key', 'h-4 w-4')}Create portal access</button>` : ''}`}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Appointments</h3></div>
          <div class="overflow-x-auto"><table class="table">
            <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Reason</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
            <tbody>${appointments.length
              ? appointments.map(
                  (a) => html`<tr>
                    <td>${fmtDate(a.startAt)}</td><td>${fmtTime(a.startAt)}</td>
                    <td>Dr. ${a.doctorId?.firstName} ${a.doctorId?.lastName}</td>
                    <td class="text-slate-600">${a.reason || '—'}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td class="text-right">${canWrite && a.status === 'scheduled'
                      ? html`<button class="btn btn-ghost btn-sm text-rose-600" data-cancel="${a._id}">Cancel</button>`
                      : ''}</td>
                  </tr>`,
                )
              : html`<tr><td colspan="6" class="py-8 text-center text-slate-500">No appointments yet.</td></tr>`}</tbody>
          </table></div>
        </div>
      </div>`,
    );

    if (!canWrite) return;
    $('[data-edit]', root).onclick = () => openPatientForm({ patient, onSaved: load });
    $('[data-book]', root).onclick = () => openBookingDialog({ patient, onBooked: load });
    $('[data-walkin]', root).onclick = () => openCheckInDialog({ patient });
    $('[data-portal]', root) && ($('[data-portal]', root).onclick = () => openPortalDialog(patient, load));
    root.querySelectorAll('[data-cancel]').forEach(
      (b) =>
        (b.onclick = async () => {
          const reason = await promptDialog({ title: 'Cancel appointment', label: 'Reason for cancellation', confirmText: 'Cancel appointment', danger: true });
          if (!reason) return;
          try {
            await api.post(`/appointments/${b.dataset.cancel}/cancel`, { reason });
            toast('Appointment cancelled.');
            load();
          } catch (err) {
            toastError(err);
          }
        }),
    );
  }
  await load();
}

function openPortalDialog(patient, onDone) {
  const { el, close } = openModal({
    title: 'Create portal access',
    subtitle: `For ${fullName(patient)}. The patient must change the temporary password at first sign-in.`,
    size: 'sm',
    content: html`<form class="space-y-4 p-5" novalidate>
      <div data-field><label class="label" for="pa-email">Email (sign-in name)</label><input id="pa-email" name="email" type="email" class="input" value="${patient.email || ''}" /></div>
      <div data-field><label class="label" for="pa-pass">Temporary password</label><input id="pa-pass" name="password" type="text" autocomplete="off" class="input" placeholder="At least 8 characters, letters and numbers" /></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Create account</button></div>
    </form>`,
  });
  const form = $('form', el);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await withBusy(form.querySelector('.btn-primary'), async () => {
      try {
        await api.post(`/patients/${patient._id}/portal-account`, formData(form));
        toast('Portal account created. Give the patient their temporary password.');
        close();
        onDone();
      } catch (err) {
        showFieldErrors(form, err.details);
        toastError(err);
      }
    });
  };
}
