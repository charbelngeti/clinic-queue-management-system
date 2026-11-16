// Register / edit patient form (FR-PAT-01, 02, 04) with duplicate warning.
import { api } from '../api.js';
import { html, mount, $, formData, showFieldErrors, clearFieldErrors } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, openModal, withBusy } from '../ui/feedback.js';
import { fullName, fmtDate, clinicToday } from '../ui/format.js';

const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

export function openPatientForm({ patient = null, onSaved } = {}) {
  const p = patient || {};
  const ec = p.emergencyContact || {};
  const dob = p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().slice(0, 10) : '';
  const { el, close } = openModal({
    title: patient ? 'Edit patient details' : 'Register new patient',
    subtitle: patient ? `${p.patientNo}` : 'A unique patient number is generated automatically.',
    size: 'xl',
    content: html`<form class="p-5" novalidate>
      <div data-dupes></div>
      <h3 class="mb-3 text-sm font-semibold text-slate-900">Personal details</h3>
      <div class="grid gap-4 sm:grid-cols-3">
        <div data-field><label class="label" for="pf-first">First name</label><input id="pf-first" name="firstName" class="input" value="${p.firstName || ''}" /></div>
        <div data-field><label class="label" for="pf-last">Last name</label><input id="pf-last" name="lastName" class="input" value="${p.lastName || ''}" /></div>
        <div data-field><label class="label" for="pf-dob">Date of birth</label><input id="pf-dob" name="dateOfBirth" type="date" max="${clinicToday()}" class="input" value="${dob}" /></div>
        <div data-field><label class="label" for="pf-sex">Sex</label>
          <select id="pf-sex" name="sex" class="input"><option value="">Select…</option>
            ${['female', 'male', 'other'].map((s) => html`<option value="${s}" ${p.sex === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`)}
          </select></div>
        <div data-field><label class="label" for="pf-nid">National ID <span class="label-hint">(if any)</span></label><input id="pf-nid" name="nationalId" class="input" value="${p.nationalId || ''}" /></div>
        <div data-field><label class="label" for="pf-blood">Blood group <span class="label-hint">(optional)</span></label>
          <select id="pf-blood" name="bloodGroup" class="input"><option value="">Unknown</option>
            ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => html`<option ${p.bloodGroup === b ? 'selected' : ''}>${b}</option>`)}
          </select></div>
      </div>
      <h3 class="mt-6 mb-3 text-sm font-semibold text-slate-900">Contact</h3>
      <div class="grid gap-4 sm:grid-cols-3">
        <div data-field><label class="label" for="pf-phone">Phone</label><input id="pf-phone" name="phone" class="input" placeholder="+2547…" value="${p.phone || ''}" /></div>
        <div data-field><label class="label" for="pf-email">Email <span class="label-hint">(optional)</span></label><input id="pf-email" name="email" type="email" class="input" value="${p.email || ''}" /></div>
        <div data-field><label class="label" for="pf-addr">Address <span class="label-hint">(optional)</span></label><input id="pf-addr" name="address" class="input" value="${p.address || ''}" /></div>
        <div data-field><label class="label" for="pf-ecn">Emergency contact name</label><input id="pf-ecn" name="ecName" class="input" value="${ec.name || ''}" /></div>
        <div data-field><label class="label" for="pf-ecr">Relationship</label><input id="pf-ecr" name="ecRelationship" class="input" value="${ec.relationship || ''}" /></div>
        <div data-field><label class="label" for="pf-ecp">Emergency contact phone</label><input id="pf-ecp" name="ecPhone" class="input" value="${ec.phone || ''}" /></div>
      </div>
      <h3 class="mt-6 mb-3 text-sm font-semibold text-slate-900">Medical alerts</h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <div data-field><label class="label" for="pf-all">Known allergies <span class="label-hint">(comma-separated)</span></label><input id="pf-all" name="allergies" class="input" placeholder="e.g. Penicillin, Peanuts" value="${(p.allergies || []).join(', ')}" /></div>
        <div data-field><label class="label" for="pf-chr">Chronic conditions <span class="label-hint">(comma-separated)</span></label><input id="pf-chr" name="chronicConditions" class="input" placeholder="e.g. Hypertension" value="${(p.chronicConditions || []).join(', ')}" /></div>
      </div>
      <div class="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button class="btn btn-primary" data-submit>${patient ? 'Save changes' : 'Register patient'}</button>
      </div>
    </form>`,
  });
  const form = $('form', el);
  let confirmNotDuplicate = false;

  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const d = formData(form);
    const body = {
      firstName: d.firstName, lastName: d.lastName, dateOfBirth: d.dateOfBirth, sex: d.sex, phone: d.phone,
      nationalId: d.nationalId, email: d.email, address: d.address, bloodGroup: d.bloodGroup,
      allergies: list(d.allergies), chronicConditions: list(d.chronicConditions),
      emergencyContact: { name: d.ecName, relationship: d.ecRelationship, phone: d.ecPhone },
    };
    if (!patient) {
      // Leave out empty optional fields when creating.
      for (const k of ['nationalId', 'email', 'address', 'bloodGroup']) if (!body[k]) delete body[k];
      for (const k of Object.keys(body.emergencyContact)) if (!body.emergencyContact[k]) delete body.emergencyContact[k];
      if (confirmNotDuplicate) body.confirmNotDuplicate = true;
    } else {
      for (const k of Object.keys(body.emergencyContact)) if (!body.emergencyContact[k]) delete body.emergencyContact[k];
    }
    await withBusy($('[data-submit]', form), async () => {
      try {
        const res = patient ? await api.patch(`/patients/${patient._id}`, body) : await api.post('/patients', body);
        toast(patient ? 'Patient details updated.' : `Patient registered as ${res.patient.patientNo}.`);
        close();
        onSaved?.(res.patient);
      } catch (err) {
        if (err.details?.code === 'POSSIBLE_DUPLICATE') return showDupes(err.details.matches);
        if (err.details) {
          const det = { ...err.details };
          if (det.emergencyContact) det.ecPhone = det.emergencyContact;
          showFieldErrors(form, det);
        }
        toastError(err);
      }
    });
  };

  function showDupes(matches) {
    mount(
      $('[data-dupes]', form),
      html`<div class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div class="flex gap-3 text-amber-800">${icon('alert')}<div class="flex-1">
          <p class="font-semibold">This patient may already be registered</p>
          <p class="mt-0.5 text-sm">Open the existing record instead of creating a duplicate, or confirm this is a different person.</p>
          <ul class="mt-3 space-y-2">${matches.map(
            (m) => html`<li class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-amber-200">
              <span><strong>${fullName(m)}</strong> · ${m.patientNo} · born ${fmtDate(m.dateOfBirth)} · ${m.phone}</span>
              <a class="btn btn-secondary btn-sm" href="#/patients/${m._id}" data-close>Open record</a></li>`,
          )}</ul>
          <button type="button" class="btn btn-warning btn-sm mt-3" data-confirm>It's a different person, register anyway</button>
        </div></div>
      </div>`,
    );
    $('[data-dupes] [data-close]', form) && form.querySelectorAll('[data-dupes] [data-close]').forEach((a) => (a.onclick = () => close()));
    $('[data-confirm]', form).onclick = () => {
      confirmNotDuplicate = true;
      $('[data-dupes]', form).innerHTML = '';
      form.requestSubmit();
    };
    el.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
  }
}
