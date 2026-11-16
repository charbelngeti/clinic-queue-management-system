# Presentation Outline — Clinic Queue & Appointment Management System

**Status:** APPROVED (16 Nov 2026). Presenter names are not shown on the slides; presenters move at their own pace (no per-slide timings).
**Format:** PowerPoint (.pptx), 16:9.
**Time limit:** ~30 min talk + 10 min live demo + up to 20 min questions.

**Tags used on slides:**
- **[NOW]** content can be written today from the approved design.
- **[BUILD]** content depends on the finished application (screenshots, module status, test results, code). Those slides will only show what actually works on 20 Nov.

**Visual style:** clean healthcare theme. White background, one teal/blue primary colour, one accent colour for alerts. A large, readable sans-serif font (≥ 24 pt body). No slide carries more than ~6 bullets or ~40 words. Every slide has a visual.

---

## Presenter allocation

| Presenter | Adm. No. | Slides | Section |
|---|---|---|---|
| Charbel Ngeti | 221441 | 1, 25, 27 | Opening, live demo, Q&A moderation |
| Adelight Naino | 220702 | 2, 3 | Background & problem |
| Abigael Wambui | 193891 | 4, 5 | Objectives & proposed solution |
| Alvin Otanga | 220267 | 8, 9, 10 | Requirements (guideline 2) |
| Ajani M'maitsi | 186452 | 11, 12, 13 | Architecture & database |
| Nathaniel Lado | 178626 | 6, 7, 14 | Methodology (guideline 1), use-case diagram |
| Evans Kima | 212539 | 15, 16, 17 | Sequence & interaction diagrams (guideline 3), CASE tools (guideline 4) |
| Faith Wanjira | 220506 | 18, 19, 20, 23 | Implemented modules, screenshots, testing |
| Matthew Mwachi | 189603 | 21, 22, 24 | Code snippet & errors (guideline 5), conclusion |

The group has 9 members (Nathaniel Jaden / Nathaniel Lado was one person registered twice).

The demo is assigned to Charbel as the repository owner. Swap it to whoever is most comfortable driving the app live.

---

## SECTION A — Introduction

### Slide 1 — Title  ·  [NOW]
- **Content:** "Clinic Queue & Appointment Management System". Course name & code, lecturer, date (20 Nov 2026), group member names + admission numbers.
- **Visuals:** Clean title layout, app logo/icon, members in a 2×5 grid.
- **Speaker notes:** "Good morning. We are presenting our Clinic Queue and Appointment Management System, a web application that coordinates a patient's journey from reception through nursing, consultation, laboratory and pharmacy. I'll briefly introduce the team, and each member will present one part of the project."

### Slide 2 — Introduction & Background  ·  [NOW]
- **Content:**
  - Outpatient clinics serve walk-ins and booked patients every day.
  - A single visit passes through up to 5 departments.
  - Many clinics still rely on paper registers, verbal calls and manual tickets.
- **Visuals:** Simple icon strip: Reception → Nurse → Doctor → Lab → Pharmacy.
- **Speaker notes:** "A typical outpatient visit is not one interaction but a chain of them. Each hand-off between departments is a point where patients wait and where information gets lost. Our system targets those hand-offs."

### Slide 3 — Problem Statement  ·  [NOW]
- **Content:** Six problems, one icon each:
  1. Long waiting times
  2. Poor appointment scheduling and double-booking
  3. Disorganised queues: who is next?
  4. Doctor availability hard to manage
  5. Poor status tracking: where is the patient now?
  6. Weak coordination between reception, nursing, lab and pharmacy
- **Visuals:** 2×3 icon grid.
- **Speaker notes:** Walk through each problem with a short real-life example, e.g. "a patient sent to the lab returns and has to queue again from the start." End with: "These problems are about coordination and information, which is exactly what an information system solves."

### Slide 4 — Project Objectives  ·  [NOW]
- **Content:**
  - **Main objective:** develop a web-based system that manages patients, appointments and queues across clinic departments.
  - **Specific objectives:**
    - Online appointment booking without conflicts.
    - Priority-based digital queues per department.
    - A "Who's Next" display.
    - Role-based access for 8 roles.
    - Digital vitals, consultation, lab and prescription records.
    - Operational dashboards.
- **Visuals:** Target icon. Checklist layout.
- **Speaker notes:** "Each specific objective maps to a module that you will see in the demo." (Keep this true: remove any objective whose module is not finished.)

### Slide 5 — Proposed Solution  ·  [NOW]
- **Content:**
  - One shared system for all departments.
  - Each patient visit carries a ticket number (e.g. A-014) through every stage.
  - Staff "call next" from their own queue.
  - Results and prescriptions flow digitally between departments.
- **Visuals:** **Patient journey flow diagram:** Reception → (Triage, optional) → Consultation ⇄ Lab → Pharmacy → Done, with the role responsible under each stage.
- **Speaker notes:** Explain the journey using one fictional patient. Point out that reception can send a patient straight to consultation without triage, and that a patient sent to the lab automatically returns to the same clinician when the results are ready.

---

## SECTION B — Methodology (Guideline 1)

### Slide 6 — Methodology: Incremental Model  ·  [NOW]
- **Content:**
  - **What:** the system is built and delivered in small, fully tested increments.
  - **Stages:** Requirements & architecture → [Design → Build → Integrate → Test] × increments → System test → Delivery.
  - **Our 5 increments:** Foundation · Front desk · Clinical flow · Portal & reports · Hardening.
- **Visuals:** Increment "staircase" diagram, each step labelled with its modules.
- **Speaker notes:** "Requirements and architecture were agreed once at the start. Then each increment went through its own mini-cycle and was added to the working system. After every increment we had something that ran and could be demonstrated."

### Slide 7 — Why Incremental? Justification  ·  [NOW]
- **Content:**
  - **Why it fits:** short deadline; the clinic workflow is a natural dependency chain; requirements were stable.
  - **Advantages:** working software early, risk handled early, easy progress tracking.
  - **Limitations:** needs a good architecture up front; integration issues between increments.
  - **Rejected:** Waterfall (testing too late), Scrum (sprint overhead too heavy for our timeframe).
- **Visuals:** Comparison table: Waterfall / Scrum / Incremental against deadline fit, early working software, overhead.
- **Speaker notes:** Stress that the choice was justified by our constraints, not popularity. Mention evidence: Git tags per increment and the PROJECT_STATUS file.

---

## SECTION C — Requirements (Guideline 2)

### Slide 8 — Functional Requirements  ·  [NOW]
- **Content:** Table of modules with requirement counts and one key example each:
  - Authentication & RBAC
  - Users
  - Patients
  - Appointments
  - Queue
  - Nursing
  - Consultation
  - Laboratory
  - Pharmacy
  - Messaging
  - Portal
  - Reports
- **Visuals:** Table with ID ranges (FR-APT-01…). Highlight 3 examples, e.g.:
  - FR-APT-03: no double-booking
  - FR-QUE-06: atomic "call next"
  - FR-PHA-04: no over-dispensing
- **Speaker notes:** Explain the ID scheme and the MoSCoW priority. Mention that the full specification is in the report.

### Slide 9 — Non-Functional Requirements  ·  [NOW]
- **Content:** Six categories with one line each:
  - **Security:** hashed passwords, server-side RBAC
  - **Privacy:** role-based field visibility
  - **Integrity:** transactions, state machines
  - **Performance:** < 500 ms queue responses
  - **Usability:** responsive, consistent UI
  - **Maintainability:** layered code
- **Visuals:** Six icon cards.
- **Speaker notes:** For each, say *how* it is satisfied, not just what it is.

### Slide 10 — Domain Requirements  ·  [NOW]
- **Content:**
  - Confidentiality under the **Kenya Data Protection Act, 2019**: health data is sensitive personal data.
  - Unique patient identification.
  - Triage priority over arrival order.
  - Plausible vital-sign ranges.
  - Prescribing authority and dispensing limits.
  - Allergy warnings.
  - Clinical records are never deleted.
- **Visuals:** Shield icon. Short list.
- **Speaker notes:** "Domain requirements come from how healthcare works, not from user requests. For example, the Data Protection Act classifies health data as sensitive personal data, which is why the public display shows only ticket numbers and the admin cannot read clinical notes."

---

## SECTION D — Design

### Slide 11 — System Architecture  ·  [NOW]
- **Content:**
  - **Three tiers:** Browser (HTML, Tailwind, JavaScript) → Node.js/Express REST API (routes → controllers → services → models) → MongoDB.
  - **Request pipeline:** authentication → role authorisation → validation.
- **Visuals:** Architecture diagram (`docs/diagrams/architecture`).
- **Speaker notes:** Explain why business rules live in the service layer. Explain polling vs WebSockets: simpler, adequate for clinic volumes.

### Slide 12 — Database Design (MongoDB)  ·  [NOW]
- **Content:**
  - **Collections:** users, patients, appointments, visits, consultations, labRequests, prescriptions, medications, labTests, messages, counters, auditLogs.
  - **Embedded:** vitals, stage history, lab test results, prescription items.
  - **Referenced:** records with their own lifecycle or different access rights.
- **Visuals:** Two-column "Embed vs Reference" table with the reason for each.
- **Speaker notes:** "We did not copy a relational design into MongoDB. The visit document is the unit of work: moving a patient between departments is one atomic update to one document."

### Slide 13 — ER / Data Model Diagram & Integrity  ·  [NOW, finalised after build]
- **Content:**
  - Data model diagram (collections, embedded parts, references with cardinalities).
  - **Integrity callouts:**
    - Unique partial indexes → no double-booking, no duplicate queue entries.
    - Transactions → dispensing and stock update together.
- **Visuals:** Data model diagram (PlantUML) with legend; 3 small callout boxes.
- **Speaker notes:** Explain the legend: a diamond means embedded, an arrow means a reference. Explain one partial index in plain words.

---

## SECTION E — UML Modelling (Guideline 3)

### Slide 14 — Use-Case Diagram  ·  [NOW, verified after build]
- **Content:** Actors (stick figures): Admin, Receptionist, Patient, Nurse, Clinician, Doctor, Lab Technician, Pharmacist. Use cases (ovals) inside the system boundary.
- **Visuals:** Full use-case diagram. If it's too dense, show one overview diagram and a zoomed-in version for clinical roles.
- **Speaker notes:**
  - Explain generalisation: Doctor inherits all Clinician use cases and adds booked appointments and unrestricted prescribing.
  - Explain `<<include>>` using "Call next patient".

### Slide 15 — Sequence Diagram: Lab Request Round Trip  ·  [BUILD]
- **Content:** Clinician → UI → API → LabService → MongoDB → Lab Tech → results → patient returns to the same clinician's queue.
- **Visuals:** Sequence diagram. Highlight the transaction block.
- **Speaker notes:** Read the diagram top-to-bottom: time flows downward and each arrow is a message. Point out the transaction fragment. Mention that the other sequence diagrams are in the report.

### Slide 16 — Interaction (Communication) Diagram  ·  [BUILD]
- **Content and visuals:** Confirmed: interaction diagrams = UML diagrams of message flow between objects. We show a **communication diagram** for "Call next patient": objects linked with numbered messages.
- **Speaker notes:** "A communication diagram shows the same interaction as a sequence diagram, but focuses on *which objects are linked* rather than on timing."

---

## SECTION F — Tools & Implementation

### Slide 17 — CASE Tools (Guideline 4)  ·  [BUILD: only tools actually used]
- **Content:** Table of tools by purpose:

| Category | Tools |
|---|---|
| Planning | PROJECT_STATUS.md, Git |
| Design | PlantUML |
| Coding | VS Code, Claude Code (AI assistant) |
| Database | MongoDB Atlas / Compass |
| Version control | Git & GitHub |
| Testing | node:test, Supertest, Chrome DevTools, Lighthouse |

- **Visuals:** Tool logos + one evidence screenshot (e.g. GitHub commit graph or Compass index view).
- **Speaker notes:** For each tool, give what it is, what we used it for, and the evidence. Be ready to open the evidence if asked.

### Slide 18 — Implemented Modules  ·  [BUILD]
- **Content:** Module checklist showing **actual** status on presentation day (✅ implemented / ⏳ partial / ✗ future work).
- **Visuals:** Checklist grid.
- **Speaker notes:** Be honest about anything partial. Lecturers reward accuracy.

### Slide 19 — Screenshots: Front Desk  ·  [BUILD]
- **Content:** Reception dashboard, booking with the slot picker, queue board, "Who's Next" display.
- **Visuals:** 2×2 screenshot grid with captions.
- **Speaker notes:** One sentence per screenshot on what the user does there.

### Slide 20 — Screenshots: Clinical Departments  ·  [BUILD]
- **Content:** Nurse vitals form (with abnormal flag), consultation screen, lab results entry, pharmacy dispensing, patient portal.
- **Visuals:** Screenshot collage.
- **Speaker notes:** Emphasise role-specific interfaces: each role sees only its own tools.

---

## SECTION G — Code & Errors (Guideline 5)

### Slide 21 — Code Snippet: "Call Next Patient"  ·  [BUILD]
- **Content:**
  - ~20 lines of the actual queue service: an atomic `findOneAndUpdate` filtered on stage + waiting, sorted by priority then queue time, setting status to "called".
  - Module: Queue Management.
- **Visuals:** Syntax-highlighted code with 3 numbered callouts:
  1. filter
  2. sort
  3. atomic update
- **Speaker notes:**
  - "If two doctors click *Call next* at the same moment, MongoDB applies the update to one document atomically. The second doctor gets the next patient, never the same one."
  - "Priority sorting implements triage."

### Slide 22 — Possible Errors  ·  [NOW, examples verified after build]
- **Content:** Table of error types, one example each, and how each is prevented:

| Type | Example from our system | Prevention |
|---|---|---|
| Syntax | Missing bracket | Editor, linter |
| Runtime | Empty queue → null | Null check, 204 response |
| Logical | Wrong sort order → newest served first | Unit test |
| Database | Duplicate key / no replica set | Index, error mapping |
| Integration | Time zone shift | ISO dates |
| Validation | Blood pressure 1200 | Range rules |
| Security | Pharmacist reading consultations; IDOR; NoSQL injection | RBAC, ownership checks, input sanitising |

- **Visuals:** Colour-coded table.
- **Speaker notes:** Pick 2 errors and tell them as short stories, ideally real bugs we hit during development (record them in CLAUDE-ASSISTANCE.md / PROJECT_STATUS.md as they happen).

---

## SECTION H — Testing, Demo, Close

### Slide 23 — Testing & Results  ·  [BUILD]
- **Content:**
  - Test levels: unit, API (automated), manual end-to-end across roles.
  - **Actual** results: tests passed / total. Key cases include double-booking → rejected, wrong role → 403, over-dispensing → rejected.
- **Visuals:** Screenshot of the test-runner output + small results table.
- **Speaker notes:** Report real numbers only. Mention any known issues.

### Slide 24 — Conclusion & Recommendations  ·  [BUILD]
- **Content:**
  - **Achieved:** objectives vs outcome.
  - **Limitations:** single clinic, in-app messages only, no billing.
  - **Future work:** SMS notifications, WebSockets for real-time updates, billing/NHIF-SHA integration, multi-branch support, HL7/FHIR.
- **Visuals:** Two columns: Achieved / Future.
- **Speaker notes:** Tie each achievement back to a problem from slide 3.

### Slide 25 — Live Demonstration  ·  [BUILD]
- **Content:** Demo script on the slide:
  1. Reception checks in a booked patient → ticket shown on "Who's Next".
  2. Nurse calls the patient and records vitals.
  3. Doctor calls the patient → requests a lab test.
  4. Lab tech enters results.
  5. Doctor sees "Results ready" → prescribes.
  6. Pharmacist dispenses → visit complete.
  7. Patient portal view.
- **Visuals:** Numbered journey graphic. The demo itself runs in the browser with role windows pre-logged-in (one browser profile per role).
- **Speaker notes:**
  - Rehearse at least twice with freshly seeded data.
  - Have a recorded backup video in case of network or database failure.

### Slide 26 — Thank You  ·  [NOW]
- **Content:** Thank you, repository link.

### Slide 27 — Questions & Answers  ·  [NOW]
- **Content:** "Questions?"
- **Speaker notes:** The moderator routes each question to the section owner (see below).

---

## Likely lecturer questions & answers

| # | Question | Answer (summary) | Answered by |
|---|---|---|---|
| 1 | Why MongoDB and not MySQL for medical data? | Flexible document structure suits nested clinical data (vitals, test results, prescription items). MongoDB still provides integrity through unique indexes, schema validators and multi-document ACID transactions. The data is designed around access patterns, not tables. | Ajani |
| 2 | How do you prevent two doctors calling the same patient? | An atomic `findOneAndUpdate` that only matches a patient whose status is still "waiting". Only one update can succeed. | Matthew |
| 3 | How do you prevent double-booking? | A unique partial index on doctor + start time for active appointments. The database itself rejects the second booking, even if both happen at the same moment. | Ajani |
| 4 | What if the server crashes in the middle of dispensing? | Dispensing runs in a transaction: stock decrement, prescription update and visit completion either all commit or none do. | Ajani |
| 5 | Why the Incremental model and not Agile/Scrum? | Our requirements were stable and our timeframe very short. Scrum's sprints and ceremonies don't fit. Incremental still gives working software early. | Nathaniel |
| 6 | Difference between functional and non-functional requirements? | Functional = what the system does (book an appointment). Non-functional = how well it does it (response time, security). Domain = constraints from healthcare itself. | Alvin |
| 7 | Why can't the admin read clinical notes? | Need-to-know principle under the Kenya Data Protection Act 2019. Admin manages the system, not patient care. | Alvin |
| 8 | How is a Doctor different from a Clinician? | The same consultation module. Doctors also have bookable schedules and unrestricted prescribing. Clinicians prescribe only from an approved list. Shown as generalisation in the use-case diagram. | Nathaniel |
| 9 | Difference between a sequence and a communication diagram? | Both are interaction diagrams. Sequence emphasises time order. Communication emphasises the links between objects, with numbered messages. | Evans |
| 10 | How are passwords stored? | bcrypt hashes with a salt. The plain password is never stored. The login session is an httpOnly cookie that JavaScript can't read. | Evans |
| 11 | How do the diagrams match the code? | Diagrams were drawn after each increment from the implemented code, and a traceability matrix links requirements → endpoints → tests. | Nathaniel |
| 12 | How did you test it? | Automated API tests for rules and permissions, plus manual end-to-end tests across all roles. | Evans |
| 13 | Is the live queue real-time? | Near-real-time: screens poll every 5 seconds. WebSockets are recommended future work. | Ajani |
| 14 | How would this scale to many branches? | Add a `branchId` to documents and indexes, a branch-scoped RBAC, and deploy on a larger MongoDB cluster. | Matthew |
| 15 | What did the CASE tools contribute? | PlantUML kept diagrams version-controlled. Git gave history and rollback per increment. Compass verified indexes. VS Code was used for development and debugging. | Evans |
| 16 | Did you use AI? | Yes. Claude Code assisted with design and code; this is documented in CLAUDE-ASSISTANCE.md. The group reviewed, tested and is accountable for all of it. | Charbel |
