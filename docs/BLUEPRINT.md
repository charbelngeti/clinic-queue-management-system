# Project Blueprint — Clinic Queue & Appointment Management System

**Status:** DRAFT v0.2. The group's answers to Q1–Q12 are incorporated (see §14). Still awaiting final go-ahead to start coding.
**Date:** 16 Nov 2026 (Monday) **Submission deadline:** 20 Nov 2026 (Friday). That leaves **4 working days**.

### How to read this document

Every item is tagged with where it comes from:

| Tag | Meaning |
|---|---|
| **[C] Confirmed** | Stated in the project brief. |
| **[R] Recommended** | My proposal. Needs your approval. |
| **[A] Assumption** | Filled in where the brief is silent. Confirm or correct it. |

Priorities use MoSCoW: **M** = Must (essential, needed for submission), **S** = Should (build if time allows, planned for Day 3), **C** = Could (optional, likely deferred).

> ⚠️ **Deadline risk.** The brief assumes a full development cycle, but only four days remain. This blueprint is scoped to fit that time: every **M** item can be built and tested by Day 3, and Day 4 is reserved for documentation, screenshots and presentation. Anything marked **S** or **C** gets dropped first if we fall behind.

---

## 1. Software Development Methodology [R]

### Recommendation: Incremental Model, using time-boxed increments and MoSCoW prioritisation

**What it is.** The system is split into a series of small increments. Each increment is fully specified, designed, built, integrated and tested, then added to the working product. Each new increment builds on the ones already delivered. Requirements are frozen at a high level at the start; detailed design happens per increment.

**Main stages.**
1. **Requirements & architecture** (done once, at the start): this blueprint.
2. **Increment planning**: decide which modules go into which increment, based on dependencies and MoSCoW priority.
3. **For each increment**: detailed design → implementation → integration with earlier increments → testing → review.
4. **System testing & acceptance**: end-to-end, multi-role workflow testing.
5. **Delivery**: documentation, presentation, submission.

**Planned increments for this project.**

| # | Increment | Modules | Day |
|---|---|---|---|
| 1 | Foundation | Project scaffold, auth, RBAC, data models, seed data, UI shell | Day 1 |
| 2 | Front desk | Patients, doctor availability, appointments, check-in, queue, "Who's Next" page | Day 1–2 |
| 3 | Clinical flow | Nurse triage/vitals, consultation, lab, prescriptions/pharmacy | Day 2 |
| 4 | Portal & insight | Patient portal, dashboards/reports, audit log | Day 3 |
| 5 | Hardening & delivery | System testing, bug fixes, diagrams checked against the code, docs, slides | Day 3–4 |

**Why it fits *this* project.**
- **Deadline.** At any point we have a working, demonstrable system. If time runs out after Increment 3, we still have a complete clinic workflow to present. Waterfall gives us nothing usable until the end.
- **Natural dependency chain.** A clinic workflow is linear: registration → appointment → check-in → triage → consultation → lab → pharmacy. Each step needs the one before it, so the modules map directly onto increments.
- **Stable requirements.** The brief already fixes the roles and modules, so the requirements are mostly known. Agile/Scrum is designed for changing requirements, and its ceremonies (sprint planning, retrospectives, sprints of 1–4 weeks) don't fit a 4-day window.
- **Group work.** Once Increment 1 defines the data model, increments split cleanly between people: documentation and diagrams can proceed in parallel with coding.

**Advantages.** Working software early. Risk is front-loaded, because the hardest piece (the queue state machine) is built in Increment 2. Each increment is tested on its own, so defects are found close to where they were introduced. Progress is easy to measure (increments delivered vs planned).

**Limitations.** It needs a sound overall architecture up front, because a bad data model hurts every later increment (this is why the data model is designed now). Integration between increments can surface late conflicts. Total scope must be known early. It provides less customer feedback than Agile.

**How we apply it.** This blueprint is the requirements & architecture stage. `PROJECT_STATUS.md` tracks each increment's status. Each increment ends with a test pass and a git tag (`inc-1`, `inc-2`, …). That gives us evidence for the methodology chapter and lets us roll back to a working state.

**Alternatives considered** (to show in the report):
- **Waterfall**: rejected. Testing comes too late, and there is no working product if time runs out.
- **Scrum**: rejected. Its overhead and sprint length don't suit a 4-day timebox, and requirements are not volatile.
- **RAD / Prototyping**: close second. RAD relies on repeated user-feedback cycles with real users, which we can't run.

---

## 2. Requirements Specification

### 2.1 Roles [C], with role-design decisions [R]

The brief lists seven user categories. My proposal for mapping them to system roles:

| Category (brief) | System role(s) | Decision |
|---|---|---|
| A. Administrator / Receptionist | `admin`, `receptionist` | **[C] (confirmed by the group)** Two separate roles. **Receptionist** handles front-desk work: register patients, create patient portal accounts, book and cancel appointments, check-in, walk-ins, queues. The receptionist is also the **communication hub**, sending and receiving in-app messages with doctors, clinicians, nurses, lab techs and patients. **Admin** manages the *system*: user accounts and roles, doctor availability, the medication formulary and lab test catalogue, reports and the audit log. Admin can *view* operational records (patients, appointments, queues) but **cannot create or alter them**, and has no access to clinical records. So Admin is **not** a superset of Receptionist. |
| B. Doctor | `doctor` | Has a bookable availability schedule and receives booked appointments. Full prescribing authority. |
| C. Patient | `patient` | Self-service portal. |
| D. Clinician | `clinician` | **[R]** See below. |
| E. Nurse | `nurse` | Triage and vital signs. |
| F. Lab Technician | `lab_tech` | Lab worklist and results. |
| G. Pharmacist | `pharmacist` | Prescriptions, dispensing, stock. |

**Doctor vs Clinician [R].** The brief asks us to avoid duplicating functionality. My proposal:

- There is **one shared Clinical Consultation module**, used by both roles through the same screens and API. The difference between the roles is purely in permissions:

| Capability | Doctor | Clinician |
|---|---|---|
| Has availability schedule and receives booked appointments | ✅ | ❌ |
| Takes walk-in patients from the general consultation queue | ✅ | ✅ |
| Records findings and consultation notes, requests lab tests | ✅ | ✅ |
| Refers patient to a doctor (re-queues the patient to that doctor) | ✅ | ✅ |
| Issues prescriptions that go to the pharmacy | ✅ | ✅ only for medications flagged `clinicianMayPrescribe` |

  This models a real clinical officer / nurse-practitioner scope of practice without building a second module. The alternative, where clinician prescriptions need doctor approval, adds an approval workflow, a new status and more screens. I'm not recommending it given the deadline.

### 2.2 Functional Requirements

The **"How the system satisfies it"** column describes the planned implementation. It will be updated to the actual implementation after build.

#### Authentication & Authorisation (AUTH)
| ID | Pri | Requirement | How the system satisfies it |
|---|---|---|---|
| FR-AUTH-01 | M | Users log in with email and password. | Login form → `POST /api/auth/login`. The password is checked against a bcrypt hash. On success, a signed JWT is set in an httpOnly cookie. |
| FR-AUTH-02 | M | Users log out. | `POST /api/auth/logout` clears the cookie. |
| FR-AUTH-03 | M | Each user has exactly one role, which determines what they can access. | `users.role` enum. The `authorize(permission)` middleware checks the role against the permission matrix (§3.2) on every API route. |
| FR-AUTH-04 | M | After login, each role lands on its own dashboard and sees only its own navigation. | The frontend reads `/api/auth/me` and renders the role's nav. Pages also re-check the role server-side via the API, so hiding a menu item is never the only protection. |
| FR-AUTH-05 | M | Deactivated accounts cannot log in. | `users.isActive` is checked at login and on every authenticated request. |
| FR-AUTH-06 | S | Users can change their own password. | `PATCH /api/auth/password` requires the current password. |

#### User & Staff Management (USR)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-USR-01 | M | Admin creates staff accounts (any staff role), with name, email, phone and role-specific profile (e.g. staff no., specialisation, licence no.). | Admin → Staff page → form → `POST /api/users`. Email has a unique index. |
| FR-USR-02 | M | Admin edits, deactivates and reactivates staff accounts and changes roles. | `PATCH /api/users/:id`. Deactivation is preferred to deletion (audit trail). An admin cannot deactivate themselves. |
| FR-USR-03 | M | Admin lists and searches staff, filtered by role and status. | Table with search and filters. |

#### Patient Management (PAT)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-PAT-01 | M | Reception registers a patient (demographics, contacts, emergency contact, allergies). | Form → `POST /api/patients`. A unique patient number `P-2026-00042` is generated atomically via a counter. |
| FR-PAT-02 | M | The system prevents duplicate patient records. | Unique index on `nationalId` (sparse, since children may have none). Before creating a patient, the system warns about likely duplicates: matching name and date of birth, or matching phone number. |
| FR-PAT-03 | M | Reception searches patients by name, patient no., phone or national ID. | `GET /api/patients?q=` uses an indexed prefix search. |
| FR-PAT-04 | M | Reception updates patient demographic details. | `PATCH /api/patients/:id`. Changes are recorded in the audit log. |
| ~~FR-PAT-05~~ | — | ~~Patient self-registration~~. **Removed:** the group confirmed patients are registered only at reception. | No public registration endpoint exists. |
| FR-PAT-06 | M | Reception creates a portal login for a patient (optional, during or after registration) with a temporary password. The patient must change it at first login. | "Create portal access" on the patient profile. Creates a `users` doc (role `patient`, `mustChangePassword: true`) linked to the patient. |
| FR-PAT-07 | M | Authorised clinical staff can view a patient's clinical summary (allergies, past visits, vitals, diagnoses, lab results, prescriptions). | Patient summary panel in consultation. Its visibility follows the permission matrix. |

#### Doctor Availability (DOC)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-DOC-01 | M | Admin/reception maintain each doctor's weekly availability (day, start, end) and slot length. | Embedded `availability[]` on the doctor's user profile. Edited on the Doctors page. |
| FR-DOC-02 | M | The system computes a doctor's free slots for a date. | `GET /api/doctors/:id/slots?date=` takes the weekly template and subtracts booked active appointments. |
| FR-DOC-03 | S | Doctors can be marked unavailable for a specific date (leave). | Embedded `unavailableDates[]`. |
| FR-DOC-04 | M | Anyone booking can list doctors with their specialisation. | `GET /api/doctors`. |

#### Appointment Management (APT)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-APT-01 | M | Reception books an appointment for a patient with a doctor in a free slot. | Booking form → slot picker → `POST /api/appointments`. |
| FR-APT-02 | M | Patients book their own appointments through the portal. | Same endpoint. `patientId` is forced to the logged-in patient. |
| FR-APT-03 | M | The system prevents double-booking a doctor's slot, and a patient holding two active appointments at the same time. | The slot must fall inside the doctor's availability. A **unique partial index** on `{doctorId, startAt}` and on `{patientId, startAt}` where `isActive: true` guarantees this even when two people book at the same moment. |
| FR-APT-04 | M | Appointments can't be booked in the past or outside the doctor's availability. | Validation in the appointment service. |
| FR-APT-05 | M | Reception and patients cancel eligible appointments. Patients may cancel only their own appointments, and only until **2 hours before start [A]**. | `POST /api/appointments/:id/cancel` with a reason. The status-transition guard applies. |
| FR-APT-06 | M | Appointment status follows a defined lifecycle: `scheduled → checked_in → completed`, `scheduled → cancelled`, `scheduled → no_show`. Invalid transitions are rejected. | Transition map in `appointment.service`. Updates are conditional on the current status. |
| FR-APT-07 | M | Reception lists and filters appointments by date, doctor and status. Doctors see their own appointments. | `GET /api/appointments` with filters. Doctors are automatically scoped to `doctorId = me`. |
| FR-APT-08 | S | Reception marks no-shows (bulk option at end of day). | Action on today's appointments list. |
| FR-APT-09 | C | Reschedule an appointment (cancel + rebook in one step). | Deferred. |

#### Check-in & Queue Management (QUE)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-QUE-01 | M | Reception checks in a patient who has an appointment today. This creates a **visit** with a daily ticket number (e.g. `A-014`). Reception chooses the first stage: **nurse triage** or **straight to consultation** (confirmed by the group). | `POST /api/visits/check-in` with `firstStage: triage|consultation` (transaction: appointment → `checked_in`, and visit created). |
| FR-QUE-02 | M | Reception registers a walk-in patient. This creates a visit with a ticket, and reception chooses triage or straight to consultation. | Same endpoint with `type: walk_in`. |
| FR-QUE-03 | M | A patient can't have more than one active visit at a time (no duplicate queue entries). | Unique partial index `{patientId}` where `isActive: true` on `visits`. |
| FR-QUE-04 | M | Each department (triage, consultation, lab, pharmacy) has its own queue. A patient is in exactly one queue at a time. | `visits.stage` + `visits.queueStatus` (single document, so changes are atomic). |
| FR-QUE-05 | M | Queue order is by priority (emergency > urgent > normal), then queue time. **[A]** For appointment patients, queue time = their scheduled time if they arrived on time, otherwise their arrival time. | Index on `{stage, queueStatus, priorityRank, queueTime}`. |
| FR-QUE-06 | M | Staff at a stage **call the next patient**. The system gives each patient to exactly one staff member, even if two people call at the same moment. | An atomic `findOneAndUpdate` with a sort and a status guard (this is the code-snippet topic, §8). |
| FR-QUE-07 | M | Queue status follows a lifecycle: `waiting → called → in_service → (moved to next stage → waiting)`, `called → skipped → waiting (re-queued)`, final `completed`. Invalid transitions are rejected. | Transition map in `queue.service`. |
| FR-QUE-08 | M | Reception monitors all queues live (counts, waiting times, who is where). | Queue board page that polls every 5 s. |
| FR-QUE-09 | M | **"Who's Next in Line"** public display shows tickets being called and the next few waiting per department. No patient names or clinical information. | Public page `/display`, polling `GET /api/public/queue`. That endpoint returns only ticket numbers, stage and room. |
| FR-QUE-10 | M | Patients see their live queue status (ticket, current department, position). | Portal card, polling `GET /api/me/visit`. |
| FR-QUE-11 | S | Reception cancels a visit (patient left), which removes the patient from the queue. | `POST /api/visits/:id/cancel`. |
| FR-QUE-12 | S | Each stage's entry and exit time is recorded so waiting and service times can be measured. | Embedded `stageHistory[]` on the visit. |

#### Nursing & Assessment (NUR)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-NUR-01 | M | Nurses see the triage queue and call the next patient. | Nurse dashboard. |
| FR-NUR-02 | M | Nurses record vital signs: temperature, blood pressure (systolic and diastolic), pulse, respiratory rate, SpO₂, weight, height. BMI is computed automatically. | Vitals form → embedded `triage.vitals` on the visit. Server-side range validation (§2.4). |
| FR-NUR-03 | M | Nurses record a preliminary assessment (presenting complaint, nursing notes) and set the triage priority. | Same form. Priority updates `priorityRank`. |
| FR-NUR-04 | M | Nurses send the patient to consultation, either to the general pool or to a specific doctor (an appointment patient goes to their booked doctor automatically). | "Send to consultation" moves stage → `consultation`, status → `waiting`. |
| FR-NUR-05 | M | Abnormal vitals are visually flagged to the nurse and to the clinician. | Range-based flags shown as red badges. |
| FR-NUR-06 | S | Nurses can move a patient between departments when instructed (e.g. return from lab). | Generic "move patient" action, restricted to valid transitions. |

#### Clinical Consultation (CON), shared by doctor and clinician
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-CON-01 | M | Doctors and clinicians see their consultation queue (patients assigned to them plus the general pool) and call the next patient. | Consultation dashboard. |
| FR-CON-02 | M | They view the patient's summary: demographics, allergies, today's vitals and nursing notes, past consultations, lab results, prescriptions. | Patient summary panel. |
| FR-CON-03 | M | They record a consultation: chief complaint, history, examination findings, diagnosis, plan and notes. | `consultations` collection. Draft saves are allowed. |
| FR-CON-04 | M | They request lab investigations from the test catalogue. This sends the patient to the lab queue. | Transaction: create `labRequests` + visit stage → `lab`. |
| FR-CON-05 | M | When results are ready, the patient comes back to the **same** clinician's queue, marked "Results ready". | The lab-complete action sets the visit back to `consultation`, assigned to the requester, with `labResultsReady: true`. |
| FR-CON-06 | M | They prescribe medications (dose, frequency, duration, quantity). Allergy conflicts produce a warning. Clinicians are limited to `clinicianMayPrescribe` drugs. | Transaction: create `prescriptions` + visit → `pharmacy`. |
| FR-CON-07 | M | They complete the visit without a prescription (discharge). | Visit → `completed`. Appointment → `completed`. |
| FR-CON-08 | M | They refer the patient to a specific doctor. | The visit returns to `consultation` with `assignedTo = doctor`. The referral is recorded on the consultation. |
| FR-CON-09 | M | Consultation notes become read-only once the visit is completed. | API rejects edits. **[A]** Corrections are added as an addendum (S). |

#### Laboratory (LAB)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-LAB-01 | M | Lab techs see the lab worklist (pending and in-progress requests) with patient identifiers and the requested tests. | Lab dashboard. |
| FR-LAB-02 | M | Lab techs update request status: `requested → sample_collected → in_progress → completed`. A request can also be `cancelled` by its requester before the sample is collected. | Transition guard. |
| FR-LAB-03 | M | Lab techs enter results for each test (value, unit, reference range, abnormal flag, comment) and submit. | Embedded `tests[].result`. Submitting completes the request, records `completedBy` and `completedAt`, and returns the patient to the clinician (FR-CON-05). |
| FR-LAB-04 | M | Requesting clinicians are notified when results are available. | Dashboard badge and a "Results ready" tag in their queue (derived from data, so no separate notification store is needed). |
| FR-LAB-05 | S | Lab techs view completed requests history, with turnaround time. | Filter on the worklist. |

#### Prescription & Pharmacy (PHA)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-PHA-01 | M | Pharmacists see pending prescriptions (patient in the pharmacy queue). | Pharmacy dashboard. |
| FR-PHA-02 | M | Pharmacists review items, including the patient's allergies and the prescriber. | Prescription detail view. |
| FR-PHA-03 | M | Pharmacists record dispensing per item (quantity dispensed). Status becomes `dispensed` or `partially_dispensed`. | **Transaction**: update the prescription, decrement medication stock, and complete the visit. |
| FR-PHA-04 | M | Dispensing can't exceed the prescribed quantity or the available stock. | Conditional update `stockQty: {$gte: qty}`. On failure, the transaction is aborted. |
| FR-PHA-05 | S | Basic inventory: pharmacists view stock levels, receive stock (increase quantity) and see low-stock warnings. | `medications` collection. Inventory page. |
| FR-PHA-06 | M | Pharmacists can view dispensing history. | Filter on prescriptions list. |

#### Patient Portal (POR)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-POR-01 | M | Patients view their upcoming and past appointments and their statuses. | Portal home. |
| FR-POR-02 | M | Patients book (FR-APT-02), cancel (FR-APT-05) and see live queue status (FR-QUE-10). | — |
| FR-POR-03 | S | Patients see appointment update messages (e.g. "Cancelled by clinic: reason"). | Shown from the appointment's `statusHistory`. |
| FR-POR-04 | C | Patients view their own lab results and prescriptions. | **[A] Out of scope.** Results are released through a clinician. |

#### Internal Messaging (MSG): added from the group's answer to Q2
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-MSG-01 | M | Receptionists send in-app messages to any staff member (doctor, clinician, nurse, lab tech, pharmacist) or to a patient with a portal account. A message can optionally be linked to a patient or appointment. | Compose form with a recipient picker → `POST /api/messages`. |
| FR-MSG-02 | M | Staff and patients send messages **to reception** (a shared reception inbox), and reply in conversations they belong to. | Recipient "Reception desk" means all receptionists see the message. |
| FR-MSG-03 | M | Each user has an inbox with an unread count badge in the navigation and conversation threads. Messages are marked read on opening. | `conversations` + `messages` collections. The badge polls every 15 s. |
| FR-MSG-04 | M | **[A]** Patients can message only reception, not clinical staff directly. Staff-to-staff messaging other than with reception is out of scope. | Server-side recipient rules. |
| FR-MSG-05 | S | **[A]** Messages are operational, not clinical records. The UI warns users not to put clinical details in messages. | Notice on the compose form. |

> Messaging is **in-app only**. SMS and email remain out of scope (§13).

#### Dashboards & Reporting (RPT)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-RPT-01 | M | Each role has a dashboard with stat tiles relevant to its work (e.g. reception: today's appointments, checked-in, waiting per stage; lab: pending/completed today). | Aggregation endpoints per role. |
| FR-RPT-02 | M | Admin sees an operational report for a date range: visits, appointments by status, no-show rate, average wait per stage, lab turnaround, prescriptions dispensed. | MongoDB aggregation pipelines over `visits.stageHistory`, `appointments`, `labRequests` and `prescriptions`. |
| FR-RPT-03 | C | Export reports to CSV. | Deferred. |

#### Audit (AUD)
| ID | Pri | Requirement | How |
|---|---|---|---|
| FR-AUD-01 | S | The system logs every create/update of clinical records and every view of a patient's clinical summary (who, what, when). | `auditLogs` collection, written by service functions. |
| FR-AUD-02 | S | Admin views the audit log. | Simple filtered table. |

### 2.3 Non-Functional Requirements

| ID | Pri | Category | Requirement | How satisfied / verified |
|---|---|---|---|---|
| NFR-SEC-01 | M | Security | Passwords are stored only as bcrypt hashes (cost ≥ 10). | `bcryptjs`. Seed data contains no plain-text passwords in the database. |
| NFR-SEC-02 | M | Security | Every API route except login, patient registration and the public display requires authentication. Authorisation is enforced **on the server**. | `authenticate` + `authorize` middleware. Tests make calls with the wrong role and expect 403. |
| NFR-SEC-03 | M | Security | Session token is an httpOnly, SameSite=Strict cookie, expiring after 8 h. | Cookie options. |
| NFR-SEC-04 | M | Security | All input is validated server-side. MongoDB operator injection is blocked. | Validation layer + Mongoose `strictQuery`. Keys starting with `$` are rejected. |
| NFR-SEC-05 | S | Security | Login is rate-limited. Security headers are set. | `express-rate-limit`, `helmet`. |
| NFR-PRI-01 | M | Privacy | Users only receive the patient fields their role needs (field-level projection per role). | Role-based projections in services. E.g. lab tech: identifiers + age/sex + requested tests only. |
| NFR-PRI-02 | M | Privacy | The public display never shows names or clinical data. | Public endpoint returns ticket, stage and room only. |
| NFR-INT-01 | M | Data integrity | Multi-document updates are atomic. | MongoDB transactions (requires a replica set, §4.4). |
| NFR-INT-02 | M | Data integrity | Status changes are only allowed along defined state machines and are conditional on the current state (prevents lost updates). | Transition maps + conditional `findOneAndUpdate`. |
| NFR-PERF-01 | M | Performance | Queue and dashboard API responses take < 500 ms with demo-sized data (≈ 1,000 patients, 5,000 visits). | Indexes in §5.4. Checked with `explain()`. |
| NFR-PERF-02 | M | Performance | Queue displays refresh within 5 s of a change. | Polling interval 5 s. |
| NFR-USE-01 | M | Usability | Consistent design system: one typography scale, colour palette, spacing, and shared button/table/form/badge components. | Tailwind config tokens + shared component classes. |
| NFR-USE-02 | M | Usability | Every form gives inline validation feedback. Every action gives a success/error toast. Destructive actions ask for confirmation. | Shared form and toast helpers. |
| NFR-USE-03 | M | Usability | Responsive from 360 px (phone, mainly the patient portal) to 1920 px (desktop staff screens, TV display). | Tailwind breakpoints. Tested in DevTools device mode. |
| NFR-USE-04 | S | Accessibility | Meets WCAG 2.1 AA basics: labels on inputs, keyboard navigation, contrast ≥ 4.5:1, status not conveyed by colour alone. | Manual check + Lighthouse. |
| NFR-MNT-01 | M | Maintainability | Layered architecture (routes → controllers → services → models). Business rules live in services only. | Folder structure §4.3. |
| NFR-MNT-02 | M | Maintainability | Configuration comes from environment variables. No secrets in git. | `.env` + `.env.example`. `.gitignore` already excludes `.env`. |
| NFR-REL-01 | M | Reliability | API errors return consistent JSON (`{error:{code,message,details}}`) and never leak stack traces in production. | Central error handler. |
| NFR-REL-02 | M | Reliability | The database can be reset and seeded with one command for demos. | `npm run seed`. |
| NFR-CMP-01 | M | Compatibility | Works on current Chrome, Edge and Firefox. | Manual test. |
| NFR-TST-01 | M | Testability | Critical workflows have automated API tests. | `node:test` + `supertest` (§6). |

### 2.4 Domain Requirements

These come from how clinics operate. In the report, cite them as "healthcare domain constraints" (they are not invented assignment requirements).

| ID | Requirement | How satisfied |
|---|---|---|
| DR-01 | **Confidentiality.** Patient health information may only be accessed by staff involved in the patient's care, on a need-to-know basis. This is consistent with the **Kenya Data Protection Act, 2019**, which classifies health data as *sensitive personal data* and requires data minimisation and appropriate security safeguards. | RBAC + per-role projections + audit log. |
| DR-02 | **Patient identification.** Every patient has a unique clinic identifier, and staff confirm identity with two identifiers (name + DOB or patient no.). | `patientNo` unique. Name, DOB and patient no. are shown on every clinical screen header. |
| DR-03 | **Triage priority.** Patients in a worse clinical condition are seen first, regardless of arrival order. | Priority ordering in queues (FR-QUE-05). |
| DR-04 | **Vital-sign plausibility.** Values outside physiologically possible ranges are rejected; values outside normal ranges are flagged. Reject ranges: Temp 30–45 °C, Systolic 50–260, Diastolic 30–160 (and < systolic), Pulse 20–250, RR 5–60, SpO₂ 50–100 %, Weight 0.5–350 kg, Height 30–250 cm. Flag ranges: Temp > 37.5, BP ≥ 140/90, SpO₂ < 95, etc. **[A]** | Server-side validation + flag function. |
| DR-05 | **Prescribing authority.** Only licensed prescribers can prescribe, and clinicians only within their scope. | Role checks + `clinicianMayPrescribe` (§2.1). Prescriber name and licence no. are stored on the prescription. |
| DR-06 | **Dispensing.** Pharmacists dispense only what was prescribed, never more, and record who dispensed what and when. | FR-PHA-03/04. |
| DR-07 | **Allergy safety.** Known allergies are shown prominently, and prescribing a medication whose name matches a recorded allergy warns the prescriber. | Allergy banner. Simple name match on the prescribing form (a documented limitation, not a drug-interaction engine). |
| DR-08 | **Record permanence.** Clinical records (consultations, results, dispensing) are never hard-deleted. Corrections are additions. | No DELETE endpoints for clinical collections. Completed records are read-only. |
| DR-09 | **Lab result integrity.** Results are attributed to the technician who entered them, and can't be edited after release without a record. | `completedBy`, `completedAt`. Read-only after completion. |
| DR-10 | **Clinic operating hours.** Appointments fall within doctors' working hours and on clinic days. | Availability check (FR-DOC-02). |

---

## 3. Roles, Use Cases and Permissions

### 3.1 Use cases per actor

| Actor | Use cases |
|---|---|
| **All staff** | Log in, log out, change password, view own dashboard |
| **Receptionist** | Register patient · Search/update patient · Create patient portal access · Book appointment · Cancel appointment · Mark no-show · Check in appointment patient (to triage or consultation) · Register walk-in · Monitor queues · Cancel visit · Send/receive messages |
| **Admin** | Manage user accounts & roles · Manage doctor availability · Manage medication formulary & lab test catalogue · View patients/appointments/queues (read-only) · View reports · View audit log |
| **Patient** | Log in (account created by reception) · Book appointment · View appointments · Cancel own appointment · View queue status · Message reception |
| **Nurse** | Call next (triage) · Record vital signs & assessment · Set triage priority · Send to consultation |
| **Clinician** | Call next (consultation) · View patient summary · Record consultation · Request lab test · Review lab results · Prescribe (restricted) · Refer to doctor · Complete visit |
| **Doctor** | *All clinician use cases* (generalisation) + Prescribe (unrestricted) · View own appointment schedule |
| **Lab Technician** | View lab worklist · Call next (lab) · Update lab request status · Enter & submit results |
| **Pharmacist** | View pending prescriptions · Call next (pharmacy) · Dispense medication · Manage stock |
| **Public display** (not a user) | View "Who's Next" board |

All clinical staff and patients also have "Send/receive messages (with reception)". In the use-case diagram, `Doctor` specialises `Clinician`. Admin and Receptionist are separate actors, because their responsibilities don't overlap. The generalisation shows the shared functionality without duplicating it. "Call next patient" is a single use case that the stage-specific use cases `<<include>>`. "Check allergies" is `<<include>>`d by Prescribe and Dispense.

### 3.2 Permission matrix [R]

R = read, W = create/update, ◐ = restricted (see note), — = no access

| Resource / action | Admin | Recep. | Nurse | Clinician | Doctor | Lab | Pharm. | Patient |
|---|---|---|---|---|---|---|---|---|
| Staff & patient user accounts | RW | W (patient portal accounts only) | — | — | — | — | — | own password |
| Patient demographics | R | RW | R | R | R | R◐¹ | R◐¹ | own R |
| Doctor availability | RW | R | R | R | own R | — | — | R (slots only) |
| Appointments | R | RW | R (today) | R (own) | R (own) | — | — | own RW◐² |
| Visit / queue (operational) | R | RW | W triage | W consult | W consult | W lab | W pharm | own R (position) |
| Messages | — | RW (all) | RW (with reception) | RW (with reception) | RW (with reception) | RW (with reception) | RW (with reception) | RW (with reception) |
| Lab test catalogue | RW | — | — | R | R | R | — | — |
| Vitals / nursing assessment | — | — | RW | R | R | — | — | — |
| Consultations | — | — | — | RW (own) / R | RW (own) / R | — | — | — |
| Lab requests | — | — | — | W create / R | W create / R | RW results | — | — |
| Prescriptions | — | — | — | W◐³ / R | W / R | — | RW dispense | — |
| Medication formulary (add/edit drugs) | RW | — | — | R | R | — | R | — |
| Medication stock levels | R | — | — | R | R | — | RW | — |
| Reports | R | R (today ops) | — | — | — | — | — | — |
| Audit log | R | — | — | — | — | — | — | — |

¹ Lab and pharmacy see identifiers, age, sex and allergies only. They don't see full contact details or the clinical history.
² Patients can book and cancel only their own appointments, and cancel only within the eligibility window.
³ Clinicians may prescribe only medications flagged `clinicianMayPrescribe`.

**Admin has no clinical access** [R]. This is deliberate: administrative staff don't need clinical notes (DR-01), and a lecturer is likely to ask about it.

### 3.3 End-to-end patient flow (the cross-department workflow)

```
 Reception           Nurse            Doctor/Clinician          Lab             Pharmacy
 ─────────           ─────            ────────────────          ───             ────────
 Check-in / walk-in
   │ visit created, ticket A-014
   ▼
 [triage:waiting] ─► call next ─► record vitals, priority
                                   │ send to consultation
                                   ▼
                     [consultation:waiting] ─► call next ─► consult
                                                │   │   │
                         request lab ◄──────────┘   │   └──► complete (no Rx) ──► [completed]
                             ▼                      │
                     [lab:waiting] ─► call next ─► results submitted
                             │                      │
                             └──► [consultation:waiting, resultsReady, same clinician]
                                                    │ prescribe
                                                    ▼
                                            [pharmacy:waiting] ─► call next ─► dispense ─► [completed]
```

Every arrow is a state transition on one `visits` document. Every `[stage:status]` box is a queue.

---

## 4. System Architecture [R]

### 4.1 Style
A **three-tier, layered client–server architecture** with a REST API:

```
┌──────────────────────── Presentation tier (browser) ────────────────────────┐
│ Static HTML pages per role + vanilla JS modules (fetch API) + Tailwind CSS │
│ Public "Who's Next" display page (no login)                                │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS · JSON · httpOnly JWT cookie
┌───────────────────────────────▼──── Application tier (Node.js + Express) ───┐
│ Middleware: helmet → rate-limit → cookie/auth → authorize(role) → validate │
│ Routes → Controllers (HTTP only) → Services (business rules, state machines│
│          transactions, RBAC projections) → Models (Mongoose schemas)        │
│ Static file server for /public                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ MongoDB driver (Mongoose), sessions/transactions
┌───────────────────────────────▼──── Data tier ──────────────────────────────┐
│ MongoDB (replica set: Atlas M0 or local single-node RS)                    │
│ Collections, indexes, $jsonSchema validators, seed script                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this design:**
- **No frontend framework.** The approved stack is HTML/CSS/JS, so pages are static HTML with small ES modules. That avoids introducing React or Vue, and avoids a templating engine (EJS) which would be a new technology.
- **Polling instead of WebSockets** for live queues (5 s). It's simpler, adds no new library, and is perfectly adequate for a clinic. WebSockets/Socket.IO would be a future enhancement.
- **Express serves both the API and the static frontend**, so there is one process, one deployment and no CORS configuration.

### 4.2 Libraries requiring approval [R]

| Package | Why it's needed | Alternative without it |
|---|---|---|
| `express` | Approved. | — |
| `mongoose` | Approved stack says MongoDB. Mongoose gives schemas, validation, middleware and simple transaction sessions. It's the standard Node ODM. | The raw `mongodb` driver would mean writing every validation by hand. |
| `bcryptjs` | Password hashing (NFR-SEC-01). Mandatory for security. | None acceptable. |
| `jsonwebtoken` + `cookie-parser` | Stateless auth token in a cookie. | `express-session` + `connect-mongo`, which is equally valid. |
| `dotenv` | Environment configuration. | Node 22 `--env-file` flag (no dependency). **I'd use this instead.** |
| `helmet`, `express-rate-limit` | Security headers, login throttling. | Hand-written. These are **S** priority. |
| `tailwindcss` + `@tailwindcss/cli` (dev) | Approved. The CLI compiles a small CSS file (not the CDN play script, which is not for production). | — |
| `nodemon` (dev) | Auto-restart in development. | `node --watch` (built in). **I'd use this instead.** |
| `supertest` (dev) | HTTP API tests. | Manual Postman testing only. |

Validation: I propose writing a small validation helper plus Mongoose validators, rather than adding `zod` or `express-validator`. That's one less dependency to explain.

No chart library: dashboard charts are simple CSS bar/stat components. If you want proper charts, `Chart.js` would need approval.

### 4.3 Folder structure
```
clinic-queue-management-system/
├─ src/
│  ├─ server.js              app bootstrap
│  ├─ app.js                 express app, middleware, routes
│  ├─ config/                env, db connection
│  ├─ middleware/            authenticate, authorize, validate, errorHandler
│  ├─ models/                Mongoose schemas (one per collection)
│  ├─ services/              business logic: queue, appointment, visit, lab, pharmacy, rbac
│  ├─ controllers/
│  ├─ routes/
│  └─ utils/                 counters, transitions, vitals flags, errors
├─ public/                   frontend (served statically)
│  ├─ index.html (login) · display.html (Who's Next)
│  ├─ app/  reception.html, nurse.html, consult.html, lab.html, pharmacy.html, admin.html, patient.html …
│  ├─ js/   api.js, auth.js, ui/ (table, toast, modal, form), pages/
│  └─ css/  input.css → output.css (Tailwind)
├─ scripts/  seed.js, init-db.js (indexes + $jsonSchema validators)
├─ tests/    *.test.js
├─ docs/     BLUEPRINT.md, diagrams/*.puml, report/, presentation/
├─ PROJECT_STATUS.md
└─ .env.example
```

### 4.4 Database hosting [R]
MongoDB **multi-document transactions only work on a replica set**, and MongoDB is not currently installed on this machine. I'm recommending **MongoDB Atlas M0 (free)**. It is a replica set by default, needs no install, and every group member can use the same database. The fallback is a local MongoDB run as a single-node replica set (`mongod --replSet rs0` + `rs.initiate()`).

---

## 5. MongoDB Data Model [R]

### 5.1 Design principles
1. **Model around the access pattern, not around tables.** The hottest operations are "who's next at stage X" and "move patient to the next stage". So the **`visits` document is the unit of workflow**: it embeds the current queue state, triage vitals and stage history. A stage change is a **single-document atomic update**, so it doesn't need a transaction.
2. **Embed** data that is owned by its parent, bounded in size and read together with it (vitals in a visit, test lines in a lab request, items in a prescription, availability in a doctor profile, status history).
3. **Reference** data that has its own lifecycle, is accessed independently, is unbounded, or has different access permissions (patients, consultations, lab requests, prescriptions). Keeping clinical records in **separate collections from operational queue data** also enforces privacy: reception's queue queries physically never touch clinical collections.
4. **Snapshot** values that must not change retroactively: medication name, strength and prescriber name are copied onto the prescription, and the test name onto the lab request.
5. **Use transactions only where more than one document must change together** (check-in, lab request, prescribe, dispense, patient self-registration).

### 5.2 Collections

**`users`**: accounts for all roles
```js
{ _id, email /*unique, lowercase*/, passwordHash, role /*admin|receptionist|doctor|clinician|nurse|lab_tech|pharmacist|patient*/,
  firstName, lastName, phone, isActive: true,
  staffProfile: {                     // embedded; staff only
    staffNo /*unique sparse*/, department, specialization, licenseNo, room,
    availability: [ { dayOfWeek: 1, start: "08:00", end: "13:00" } ],   // doctors
    slotMinutes: 20, unavailableDates: ["2026-11-19"] },
  patientId /*ref patients; role=patient only*/,
  lastLoginAt, createdAt, updatedAt }
```

**`patients`**
```js
{ _id, patientNo: "P-2026-00042" /*unique*/, firstName, lastName, dateOfBirth, sex, nationalId /*unique sparse*/,
  phone, email, address,
  emergencyContact: { name, relationship, phone },     // embedded 1:1
  allergies: [ "Penicillin" ], bloodGroup, chronicConditions: [ ],
  userId /*ref users, if portal account*/, createdBy, createdAt, updatedAt }
```

**`appointments`**
```js
{ _id, appointmentNo, patientId, doctorId, startAt: ISODate, endAt, reason,
  status: "scheduled|checked_in|completed|cancelled|no_show",
  isActive: true,               // true while scheduled|checked_in → drives partial unique indexes
  bookedBy: { userId, channel: "reception|portal" },
  cancellation: { at, by, reason },
  statusHistory: [ { status, at, by, note } ],         // embedded, bounded (~5)
  visitId, createdAt, updatedAt }
```

**`visits`**: one clinic attendance. This is the queue.
```js
{ _id, visitNo, ticketNo: "A-014", clinicDate: "2026-11-16", patientId, appointmentId?, type: "appointment|walk_in",
  stage: "triage|consultation|lab|pharmacy|done",
  queueStatus: "waiting|called|in_service|skipped|completed|cancelled",
  isActive: true,
  priority: "emergency|urgent|normal", priorityRank: 0|1|2, queueTime: ISODate,
  assignedTo: userId|null,       // who should serve at this stage (null = pool)
  calledBy, calledAt, room,
  labResultsReady: false,
  triage: { vitals: { temperature, systolic, diastolic, pulse, respRate, spo2, weight, height, bmi },
            flags: ["HIGH_BP"], complaint, notes, recordedBy, recordedAt },      // embedded 1:1
  stageHistory: [ { stage, enteredAt, calledAt, startedAt, leftAt, servedBy } ], // embedded, bounded
  createdBy, createdAt, updatedAt }
```

**`consultations`**
```js
{ _id, visitId, patientId, clinicianId, clinicianRole, chiefComplaint, history, examination,
  diagnosis: [ { description, code? } ], plan, notes,
  referral: { toDoctorId, reason, at }, status: "draft|final", addenda: [ { text, by, at } ],
  createdAt, updatedAt }
```

**`labRequests`**
```js
{ _id, requestNo, visitId, patientId, requestedBy, priority, clinicalNotes,
  status: "requested|sample_collected|in_progress|completed|cancelled",
  tests: [ { testCode, testName /*snapshot*/, result: { value, unit, refRange, flag: "normal|low|high|critical", comment } } ],
  sampleCollectedAt, completedBy, completedAt, createdAt, updatedAt }
```

**`labTests`**: catalogue (seeded): `{ code /*unique*/, name, sampleType, unit, refRange, isActive }`

**`prescriptions`**
```js
{ _id, rxNo, visitId, patientId, prescriber: { userId, name, role, licenseNo },   // snapshot
  status: "pending|partially_dispensed|dispensed|cancelled",
  items: [ { medicationId, name, strength, form /*snapshot*/, dose, frequency, durationDays, quantity,
             dispensedQty: 0, instructions } ],
  dispensedBy, dispensedAt, createdAt, updatedAt }
```

**`medications`**: formulary + stock: `{ name, strength, form, unit, stockQty, reorderLevel, clinicianMayPrescribe, isActive }`

**`counters`**: atomic sequences: `{ _id: "patientNo:2026" | "ticket:2026-11-16", seq }`, incremented with `findOneAndUpdate({$inc}, {upsert:true})`.

**`conversations`** (messaging): `{ participants: [userId] | includesReception: true, subject, patientId?, appointmentId?, lastMessageAt, createdBy }`. Index `{participants:1, lastMessageAt:-1}`.

**`messages`**: `{ conversationId, senderId, body, readBy: [userId], createdAt }`. Index `{conversationId:1, createdAt:1}`. Referenced rather than embedded in the conversation, because threads are unbounded.

`users` additionally gets `mustChangePassword: Boolean` (for reception-created patient accounts).

**`auditLogs`** (S): `{ at, userId, role, action, entity, entityId, ip }`

### 5.3 Relationships

| From → To | Cardinality | Type | Reason |
|---|---|---|---|
| users → patients | 1 : 0..1 | reference (`users.patientId`) | Not every patient has a portal account. |
| patients → appointments | 1 : N | reference | Unbounded, queried independently. |
| users(doctor) → appointments | 1 : N | reference | — |
| appointments → visits | 1 : 0..1 | reference both ways | A no-show has no visit. |
| patients → visits | 1 : N | reference | — |
| visits → triage/vitals | 1 : 1 | **embedded** | Owned by the visit, always read with it. |
| visits → consultations | 1 : 1..N | reference | Different permissions. Can be 2 per visit (before/after lab). |
| visits → labRequests | 1 : 0..N | reference | Separate worklist and permissions. |
| labRequests → tests/results | 1 : N | **embedded** | Bounded, never accessed alone. |
| visits → prescriptions | 1 : 0..1 | reference | Pharmacy worklist. |
| prescriptions → items | 1 : N | **embedded** | Bounded, atomic with status. |
| items → medications | N : 1 | reference + snapshot | Stock vs historical record. |

### 5.4 Indexes

| Collection | Index | Type | Purpose |
|---|---|---|---|
| users | `{email:1}` | unique | Login, no duplicate accounts |
| users | `{role:1, isActive:1}` | compound | Staff lists, doctor lists |
| patients | `{patientNo:1}` | unique | Identifier |
| patients | `{nationalId:1}` | unique, sparse | Duplicate prevention |
| patients | `{lastName:1, firstName:1, dateOfBirth:1}` | compound | Search + duplicate warning |
| patients | `{phone:1}` | single | Search |
| appointments | `{doctorId:1, startAt:1}` | **unique partial** `{isActive:true}` | No double-booking (FR-APT-03) |
| appointments | `{patientId:1, startAt:1}` | **unique partial** `{isActive:true}` | Patient can't be in two places at once |
| appointments | `{startAt:1, status:1}` | compound | Daily lists |
| visits | `{patientId:1}` | **unique partial** `{isActive:true}` | No duplicate queue entries (FR-QUE-03) |
| visits | `{stage:1, queueStatus:1, priorityRank:1, queueTime:1}` | compound (ESR order) | "Call next" & Who's Next |
| visits | `{clinicDate:1, ticketNo:1}` | unique | Ticket uniqueness per day |
| labRequests | `{status:1, createdAt:1}` | compound | Worklist |
| labRequests | `{visitId:1}` | single | Lookup |
| prescriptions | `{status:1, createdAt:1}` | compound | Pharmacy worklist |
| prescriptions | `{visitId:1}` | unique | One prescription per visit [A] |
| consultations | `{patientId:1, createdAt:-1}` | compound | Patient history |
| medications | `{name:1, strength:1, form:1}` | unique | No duplicate formulary items |
| auditLogs | `{entity:1, entityId:1, at:-1}` | compound | Audit lookup |

### 5.5 Validation
There are two layers, and the report should explain why both exist:
1. **Mongoose schemas**: types, required fields, enums, min/max, custom validators. These give friendly error messages.
2. **MongoDB `$jsonSchema` validators** on `patients`, `appointments`, `visits` and `prescriptions`, created by `scripts/init-db.js`. These are the last line of defence: they reject invalid data even if it bypasses the app (e.g. someone writing directly in Compass).

### 5.6 Consistency & integrity strategies
| Risk | Strategy |
|---|---|
| Two receptionists book the same slot simultaneously | Unique partial index. The second insert fails with E11000 → 409 "Slot no longer available". |
| Two doctors click "Call next" simultaneously | Atomic `findOneAndUpdate` with a `queueStatus:"waiting"` filter, so only one succeeds. |
| Invalid transition (e.g. dispensing a completed visit) | Transition map + conditional update filter on the current status. |
| Appointment checked in but visit creation fails | Transaction. |
| Stock decremented but prescription not updated | Transaction. |
| Dangling references (deleting a patient with visits) | No hard deletes of patients or clinical docs. Deactivate instead. Existence of referenced IDs is checked in services. |
| Patient record edited after prescription | Snapshots of the fields that matter. |

### 5.7 Initialisation & sample data
- `npm run db:init`: creates collections, `$jsonSchema` validators and indexes.
- `npm run seed`: wipes and loads **synthetic** data: 1 admin, 2 receptionists, 3 doctors, 2 clinicians, 2 nurses, 2 lab techs, 2 pharmacists, ~40 patients, ~20 lab tests, ~30 medications, and a realistic mix of today's appointments and visits at every stage. That way the demo starts with full dashboards. Demo passwords are documented in the README.

### 5.8 Data model diagram
I'll produce a PlantUML **class-style data model diagram**. Each class = a collection, nested boxes/composition (◆) = embedded documents, and arrows with multiplicities = references. Standard relational ERD notation implies foreign keys and joins, which MongoDB doesn't have. The report will include a legend explaining the mapping.

---

## 6. Testing Strategy [R]
| Level | Tool | What |
|---|---|---|
| Unit | `node:test` (built in) | Transition maps, vitals validation/flags, slot computation, queue ordering. |
| API / integration | `node:test` + `supertest` against a test database | Each role's happy path, 401/403 for every wrong role, double-booking → 409, concurrent call-next → only one wins, dispense > stock → rejected, duplicate active visit → rejected. |
| End-to-end (manual) | Browser, scripted test cases in `docs/testing/` | Full patient journey across 5 roles with 5 browser profiles. Screenshots kept as evidence. |
| Non-functional | Lighthouse, DevTools device mode, `explain()` | Accessibility, responsiveness, index usage. |

The test case table (ID, steps, expected, actual, pass/fail) doubles as report evidence.

---

## 7. UML Diagrams to Produce (PlantUML) [R]
These are drawn **after each increment is built**, from the actual code, so they cannot describe features that don't exist.

| # | Diagram | Content |
|---|---|---|
| 1 | Use-case diagram | All 8 actors (7 categories, Admin ⊂ Receptionist generalisation, Doctor ⊂ Clinician), system boundary, include/extend. |
| 2 | Sequence: Patient registration & appointment booking | Patient/Receptionist → UI → API → AppointmentService → MongoDB (incl. alt: slot taken → 409). |
| 3 | Sequence: Check-in & queue assignment | Includes transaction and ticket counter. |
| 4 | Sequence: Call next patient / queue movement | Concurrent call race and atomic findOneAndUpdate. |
| 5 | Sequence: Nurse triage & vitals | Validation alt fragment, abnormal flag. |
| 6 | Sequence: Consultation | Includes opt fragments for lab / prescribe / refer. |
| 7 | Sequence: Lab request → results → return to clinician | Cross-department. |
| 8 | Sequence: Prescription → dispensing | Transaction with stock check, alt insufficient stock. |
| 9 | **Interaction diagram(s)** | **[A]** Communication (collaboration) diagrams for "Call next patient" and "Dispense medication". See question Q6. |
| 10 | State machine diagrams (recommended extra) | Visit/queue lifecycle and appointment lifecycle. These directly document FR-QUE-07 and FR-APT-06. |
| 11 | Data model diagram | §5.8. |
| 12 | Architecture/deployment diagram | §4.1. |

**On "interaction diagrams":** in UML 2, *interaction diagram* is the family name covering sequence, communication, interaction overview and timing diagrams. Because the brief lists sequence diagrams separately, the lecturer most likely expects **communication diagrams** (sometimes called collaboration diagrams). Please confirm (Q6).

---

## 8. CASE Tools [R]
We'll only claim a tool if we actually use it. Each one needs evidence collected as we go.

| Category | Tool | Purpose | Evidence to capture |
|---|---|---|---|
| Planning | `PROJECT_STATUS.md` in Git; GitHub Issues/Projects **(only if you use it)** | Task tracking, increments | Screenshot of board/file history |
| Requirements & design | PlantUML (VS Code extension or plantuml.com) | UML diagrams as code, version-controlled | `.puml` files + rendered images + commit history |
| Design | draw.io (**only if used**, e.g. for the architecture diagram) | Free-form diagrams | `.drawio` file |
| Coding | Visual Studio Code | Editing, debugging, integrated terminal & Git | Screenshot of workspace/debugger |
| Coding (AI assistance) | Claude Code | Code generation, review, documentation drafting | **Check your university's AI policy (Q11)**. It may need declaring. |
| Database | MongoDB Atlas UI / MongoDB Compass | Schema inspection, index verification, `explain()` plans, data browsing | Screenshots of collections, indexes, explain output |
| Build | npm, Tailwind CLI | Dependency management, CSS build | `package.json`, scripts |
| Version control | Git + GitHub | History, branches, collaboration, increment tags | Commit graph, tags `inc-1…`, contributors page |
| Testing | `node:test` + supertest; Chrome DevTools; Lighthouse | Automated API tests, debugging, accessibility/perf audits | Test run output, Lighthouse report |
| API testing | Postman or VS Code Thunder Client (**only if used**) | Manual endpoint testing | Saved collection |

---

## 9. Code Snippet & Error Analysis Topic [R]

**Primary snippet:** the **"Call next patient"** queue service. It's an atomic `findOneAndUpdate` that:
- filters on `{stage, queueStatus:"waiting", assignedTo ∈ {me, null}}`,
- sorts by `{priorityRank, queueTime}`,
- updates to `called` with `calledBy`/`calledAt`, and
- pushes a `stageHistory` timestamp.

It belongs to the **Queue Management** module and is the heart of the system: it implements fairness (priority + order), concurrency safety (two staff can never get the same patient) and the state machine. It's short enough (~25 lines) to put on a slide.

**Backup snippet:** the **dispense medication transaction** (stock check + decrement + prescription update + visit completion, all-or-nothing).

**Error analysis (with realistic examples):**
| Type | Example in this system | Detection | Prevention / resolution |
|---|---|---|---|
| Syntax | Missing `}` in the service, or `await` used outside an async function | Node fails on start; VS Code red squiggle | Linting, editor, running tests |
| Runtime | `Cannot read properties of null (reading 'patientId')` when the queue is empty | Uncaught exception, 500 response | Null check → return 204 "Queue empty"; central error handler |
| Logical | Sorting `queueTime` descending, so the newest patient is served first; or forgetting `priorityRank`, so emergencies wait | Unit test on queue order; demo scenario | Test with seeded mixed priorities |
| Database | E11000 duplicate key when checking in a patient already in the queue; transaction fails on standalone MongoDB ("Transaction numbers are only allowed on a replica set member") | Error code 11000; startup check | Map 11000 → 409 with a friendly message; use a replica set |
| Integration | Frontend sends `startAt` as local time and the server stores it as UTC, so the appointment appears 3 h off; or the frontend expects `patient.name` but the API returns `firstName`/`lastName` | Manual E2E test, wrong UI display | Send ISO 8601 with offset; document an API contract |
| Validation | Systolic 1200 entered; diastolic > systolic; booking in the past | Server returns 422 with field errors | Server-side validation + range rules (DR-04); client-side hints |
| Security | Pharmacist calls `GET /api/consultations/:id` directly; a patient changes `patientId` in a request to view another patient's appointment (IDOR); NoSQL injection `{"email":{"$ne":null}}` at login | 403/401 tests; code review | `authorize` middleware; ownership checks; reject `$`-prefixed keys; `strictQuery` |
| Concurrency (bonus) | Two doctors call the same patient (lost update) | Concurrency test | Atomic conditional update, which is the snippet itself |

---

## 10. Development Roadmap (4 days) [R]

| Day | Workstream A: Application | Workstream B: Academic |
|---|---|---|
| **Mon 16 Nov** | Approve blueprint · Atlas setup · scaffold, Tailwind, models, indexes, seed · Auth + RBAC · UI shell & design system | Methodology chapter, requirements chapter (from this blueprint) |
| **Tue 17 Nov** | Patients, doctors/availability, appointments, check-in/walk-in, queue engine, Who's Next, nurse triage | Use-case diagram, architecture & data-model diagrams, CASE tools chapter (evidence screenshots begin) |
| **Wed 18 Nov** | Consultation, lab, prescriptions/pharmacy + stock, patient portal, dashboards | Sequence + communication diagrams from the built code |
| **Thu 19 Nov** | Reports, audit (S), automated tests, full multi-role E2E test, bug fixing, freeze code at the end of the day | Code snippet & error analysis, testing chapter, screenshots, draft slides |
| **Fri 20 Nov** | Bug fixes only · demo rehearsal with seeded data | Final report, slides + speaker notes, Q&A prep, **submit** |

**What gets cut first if we slip:** C items → audit log → reports date range (keep today's dashboard) → stock receiving → reception-created portal accounts → no-show bulk action.

---

## 11. Academic Documentation Structure [R]

**The report is limited to 10 pages in Word.** Proposed page budget:

| Section | Pages |
|---|---|
| Title + introduction/problem/objectives | 1 |
| Methodology | 1 |
| Requirements (key FR/NFR/DR tables with IDs) | 2 |
| Architecture + database design + data model diagram | 1.5 |
| Use-case, sequence and communication diagrams | 2 |
| CASE tools | 0.5 |
| Code snippet & error analysis | 1 |
| Testing + conclusion + references | 1 |

The full requirements specification and the remaining diagrams go in appendices, **if the lecturer allows appendices outside the 10-page limit** (to confirm). If not, the tables are trimmed to the essential (M) requirements.

The original (pre-limit) structure is kept below for reference:

1. Title page, declaration, abstract, table of contents
2. **Introduction**: background, problem statement, objectives, scope & limitations
3. **Methodology**: chosen model, stages, justification, application, alternatives
4. **Requirements analysis**: stakeholders/roles, functional, non-functional and domain requirements (with IDs and priorities), permission matrix
5. **System design**: architecture, data model (collections, embedding vs referencing, indexes, validation, consistency), UI design
6. **System modelling**: use-case, sequence, communication and state diagrams with explanations
7. **Implementation**: tech stack, CASE tools with evidence, module walkthrough with screenshots
8. **Code snippet & error analysis**
9. **Testing**: strategy, test cases, results, known issues
10. **Conclusion & recommendations**: achievements vs objectives, limitations, future work (SMS notifications, WebSockets, billing, multi-branch, HL7/FHIR integration)
11. References · Appendices (requirements traceability matrix, seed credentials, installation guide)

A **requirements traceability matrix** (requirement ID → API endpoint → UI page → test case → diagram) will be in the appendix. It's the strongest evidence that the documentation matches the system.

---

## 12. Presentation Outline [R] (~15 min, 16 slides)
| # | Slide | Content / notes |
|---|---|---|
| 1 | Title | Project, group members, date |
| 2 | Problem | Long waits, disorganised queues, poor coordination between departments |
| 3 | Objectives & scope | What's in and what's out |
| 4 | Methodology | Incremental model, increments diagram, why not Waterfall/Scrum |
| 5 | Users & roles | 7 categories and the permission matrix highlight |
| 6 | Requirements overview | Counts per category, 3–4 key examples with IDs |
| 7 | Architecture | 3-tier diagram |
| 8 | Patient journey | The cross-department flow (§3.3) |
| 9 | MongoDB design | Data model diagram, embedding vs referencing |
| 10 | Integrity | Indexes, transactions, state machines |
| 11 | Use-case diagram | — |
| 12 | Sequence + communication diagram | Call next / lab round trip |
| 13 | CASE tools | With evidence screenshots |
| 14 | Code snippet & error analysis | "Call next" + error table |
| 15 | **Live demo** | Patient journey through 5 roles (scripted, seeded) |
| 16 | Conclusion & recommendations | Achievements, limitations, future work |

**Likely lecturer questions** (full answers will be in the speaker notes):
- Why MongoDB instead of a relational database for clinical data?
- Where are joins needed?
- How do you stop two doctors calling the same patient?
- What happens if the server crashes halfway through dispensing?
- Why does the admin not see clinical notes?
- How is Doctor different from Clinician?
- Why the Incremental model and not Agile?
- How do you know your diagrams match your code?
- How would you scale to several branches?
- How are passwords stored?
- What is a partial index?
- What is the difference between a communication diagram and a sequence diagram?

---

## 13. Scope Exclusions [A]
These are out of scope unless you say otherwise:

- Billing, payments and insurance
- SMS/email notifications
- Multi-branch clinics
- Rooms/equipment scheduling beyond a `room` label
- Drug–drug interaction checking
- Medical coding (ICD-10 lookup)
- HL7/FHIR integration
- Native mobile apps
- Real-time WebSockets
- File uploads (e.g. scanned results)

---

## 14. Decisions (answered 16 Nov 2026)
| # | Decision |
|---|---|
| Q1 | 20 Nov is the deadline for code, report **and** presentation. The group has 10 members. |
| Q2 | Admin and Receptionist are separate roles. Admin manages the system but does not alter operational/clinical records. Receptionist is the front desk and communication hub (adds module MSG). |
| Q3 | The Doctor vs Clinician model is approved. |
| Q4 | Patients are registered **only at reception**. FR-PAT-05 is removed. Reception creates portal logins (FR-PAT-06 → M). |
| Q5 | Pharmacy stock is in scope. |
| Q6 | The group describes "interaction diagrams" as stick figures with arrows to ovals. **That is the UML use-case diagram notation.** Plan: deliver the use-case diagram in that style. Also deliver communication diagrams, labelled as UML interaction diagrams, unless the lecturer confirms they are not needed. **Still to confirm.** |
| Q7 | MongoDB setup: Claude to specify exactly what is needed (see PROJECT_STATUS.md). |
| Q8 | Libraries in §4.2 approved. |
| Q9 | Report: **≤ 10 pages in Word (.docx)**. Slides: **PowerPoint (.pptx)**. §11 must be compressed. |
| Q10 | Cite the Kenya Data Protection Act, 2019. |
| Q11 | AI declaration is not required. Keep `CLAUDE-ASSISTANCE.md` in the repo root as a short log of AI-assisted work. |
| Q12 | Triage is optional. Reception chooses triage or straight to consultation at check-in. |

## 14b. Original questions (for reference)
| # | Question | My default if you don't answer |
|---|---|---|
| Q1 | Is **20 Nov** the final deadline for *both* the code and the report/presentation? Is there a presentation date after it? How many group members are there, and who takes Workstream B? | Treat 20 Nov as the deadline for everything. |
| Q2 | Should Admin and Receptionist be two separate role values within category A (§2.1)? | Yes, two roles. |
| Q3 | Is the Doctor vs Clinician model acceptable (shared module; clinician restricted to `clinicianMayPrescribe` drugs, no booked appointments)? | Yes. |
| Q4 | Can patients self-register online, or are they only registered at reception? | Both. |
| Q5 | Is basic pharmacy stock management in scope (stock levels, decrement on dispense, receive stock, low-stock alert)? | Yes, decrement-on-dispense as **M**, receiving stock as **S**. |
| Q6 | Does the lecturer expect **communication diagrams** as the "interaction diagrams"? | Yes, communication diagrams. |
| Q7 | Database: MongoDB Atlas free tier (recommended), or install MongoDB locally as a replica set? | Atlas. One of you creates the cluster and puts the connection string in `.env` (never in chat or git). |
| Q8 | Do you approve the libraries in §4.2 (mongoose, bcryptjs, jsonwebtoken, cookie-parser, helmet, express-rate-limit, Tailwind CLI, supertest)? | Approve as listed. |
| Q9 | Are there required formats for the report and slides (Word/PDF, university template, referencing style, page/slide limits, presentation length)? | Markdown drafts, convertible to Word; APA 7; ~15 min talk. |
| Q10 | Which country's data protection law should DR-01 cite? | Generic wording. |
| Q11 | Does your university require you to declare AI-tool assistance? | Declare it as a CASE tool (honest and safe). |
| Q12 | Should every visit pass through nurse triage, or can reception send some patients straight to consultation? | Always triage. |
