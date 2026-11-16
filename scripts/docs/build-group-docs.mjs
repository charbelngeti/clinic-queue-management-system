// Generates two documents for the group:
//   docs/group/Project-Explainer.docx   – plain-language explanation of the whole project
//   docs/group/Presentation-Guide.docx  – what and how each member (1–9) presents
// Usage: node scripts/docs/build-group-docs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'docs/group');
const BRAND = '088577';
const FONT = 'Calibri';

/* ---------------- helpers ---------------- */
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, ...o });
const runs = (t, o = {}) => t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => (p.startsWith('**') ? run(p.slice(2, -2), { ...o, bold: true }) : run(p, o)));
const P = (t, o = {}) => new Paragraph({ children: runs(t), spacing: { after: 120, line: 288 }, ...o });
const H1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
const H2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
const H3 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3 });
const B = (t) => new Paragraph({ children: runs(t), numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60, line: 276 } });
const N = (t, ref = 'numbers') => new Paragraph({ children: runs(t), numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 276 } });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
function table(header, rows, widths) {
  const cell = (t, i, head) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: BRAND } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ children: runs(String(t), { size: 20, color: head ? 'FFFFFF' : '1E293B', bold: head }) })],
    });
  return [
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))] }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
/** Shaded call-out box (one-cell table). */
function box(title, lines, fill = 'EFFCF9') {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 24, color: BRAND }, right: border },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, color: 'auto', fill },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [new Paragraph({ spacing: { after: 60 }, children: [run(title, { bold: true, color: '0B6A61' })] }), ...lines.map((l) => new Paragraph({ spacing: { after: 40 }, children: runs(l, { size: 20 }) }))],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}
function imgSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: 'png' };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: 'jpg' };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(file);
}
function image(file, caption, maxW = 600, maxH = 330) {
  const s = imgSize(file);
  const r = Math.min(maxW / s.w, maxH / s.h);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, children: [new ImageRun({ type: s.type, data: fs.readFileSync(file), transformation: { width: Math.round(s.w * r), height: Math.round(s.h * r) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(caption, { italics: true, size: 18, color: '64748B' })] }),
  ];
}
function makeDoc(title, children) {
  return new Document({
    creator: 'CareQueue Clinic project group',
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: '022A28' }, paragraph: { spacing: { before: 360, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: BRAND }, paragraph: { spacing: { before: 240, after: 80 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true, color: '334155' }, paragraph: { spacing: { before: 160, after: 60 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
        ...Array.from({ length: 20 }, (_, i) => ({ reference: i ? `numbers${i}` : 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 280 } } } }] })),
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, bottom: 1200, left: 1250, right: 1250 } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`${title}   ·   Page `, { size: 16, color: '94A3B8' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8', font: FONT })] })] }) },
        children,
      },
    ],
  });
}
const titleBlock = (t, sub) => [
  new Paragraph({ spacing: { after: 60 }, children: [run('CareQueue Clinic', { size: 24, color: BRAND, bold: true })] }),
  new Paragraph({ spacing: { after: 80 }, children: [run(t, { size: 44, bold: true, color: '022A28' })] }),
  new Paragraph({ spacing: { after: 280 }, children: [run(sub, { size: 22, color: '64748B', italics: true })] }),
];
const shot = (n) => path.join(ROOT, 'docs/screenshots', `${n}.jpg`);
const diag = (n) => path.join(ROOT, 'docs/diagrams/rendered', `${n}.png`);

/* ================================================================== */
/* DOCUMENT 1 — Project explainer                                      */
/* ================================================================== */
const explainer = [
  ...titleBlock('Project Explainer', 'Our whole project in plain language: read this before the presentation.'),
  ...box('In one sentence', ['We built a website that a clinic uses to book appointments, issue queue tickets, and move each patient smoothly from **reception → nurse → doctor → laboratory → pharmacy**, with each staff member seeing only what their job needs.']),

  H1('1. The problem we are solving'),
  P('Think of a busy outpatient clinic. A patient may visit up to five places in one visit: reception, a nurse, a doctor, the laboratory and the pharmacy. In many clinics this is run with paper registers and people calling names out loud. That causes:'),
  B('**Long, invisible waiting:** patients don\'t know their position or how long they will wait.'),
  B('**Double-booking:** two people get the same doctor at the same time.'),
  B('**Chaotic queues:** an emergency patient can end up waiting behind people with minor problems.'),
  B('**Lost patients and papers:** nobody knows whether a patient is at the lab or the pharmacy, and lab results or prescriptions get lost between departments.'),

  H1('2. What we built'),
  P('**CareQueue Clinic** is a web application (a website people log into). It has three parts:'),
  B('**The staff/patient app:** each person logs in and sees a screen made for their job.'),
  B('**The "Who\'s Next" screen:** a TV display in the waiting area showing ticket numbers (never names) and which room to go to.'),
  B('**Reports:** the administrator can see how many patients came, how long they waited in each department, and so on.'),
  ...image(shot('04-whos-next-display'), 'The "Who\'s Next" display: patients only see ticket numbers, for privacy.'),

  H2('2.1 The eight user roles'),
  P('A **role** is a type of user. What you can see and do depends on your role. This is called **role-based access control (RBAC)**.'),
  ...table(
    ['Role', 'What they do in the system'],
    [
      ['Receptionist', 'Registers patients, books appointments, checks patients in (gives them a ticket), watches all queues, and is the "message hub" for everyone.'],
      ['Administrator', 'Manages the system: creates staff accounts, sets doctors\' working hours, manages the list of medicines, views reports and the activity log. Cannot change patient records and cannot read medical notes.'],
      ['Nurse', 'Calls the next patient, records vital signs (temperature, blood pressure, pulse and so on), sets how urgent the patient is, then sends them to a doctor.'],
      ['Clinician', 'Sees patients: writes consultation notes, requests lab tests, prescribes (only from an approved list), refers to a doctor, discharges.'],
      ['Doctor', 'Everything a clinician does, plus can be booked for appointments and can prescribe any medicine.'],
      ['Lab technician', 'Calls the next patient, records that a sample was taken, enters test results and releases them.'],
      ['Pharmacist', 'Sees the prescription, gives out (dispenses) the medicine, and manages stock.'],
      ['Patient', 'Logs into the patient portal to book or cancel appointments, see their place in the queue and message reception. Patients are registered only at reception, like a real hospital.'],
    ],
    [20, 80],
  ),

  H2('2.2 One patient\'s journey (follow this and you understand the system)'),
  N('**Booking:** reception (or the patient online) picks a doctor, a date and a free time slot. Taken slots are crossed out, so double-booking is impossible.'),
  N('**Check-in:** the patient arrives; reception checks them in and the system issues a **ticket**, e.g. A-014 (A = appointment, W = walk-in). Reception chooses whether the patient sees the nurse first or goes straight to the doctor.'),
  N('**Triage (nurse):** the nurse presses **Call next**. The ticket flashes on the TV screen. The nurse records vital signs. Impossible values (e.g. blood pressure 1200) are rejected; worrying ones (fever, high blood pressure) are highlighted in red. The nurse can mark the patient as urgent or emergency.'),
  N('**Consultation (doctor/clinician):** the doctor presses Call next, sees the vitals and history, and writes notes. They can then: request lab tests, prescribe, refer to another doctor, or discharge.'),
  N('**Laboratory:** the lab technician calls the patient, records the sample and enters results. When results are released, the patient automatically goes back to the **same doctor**, marked "Results ready", without losing their place in line.'),
  N('**Pharmacy:** the pharmacist sees the prescription and current stock, gives out the medicine, and the visit is finished. Stock goes down automatically.'),
  N('**Throughout:** the patient can see "You are 3rd in line for Triage" on their phone in the patient portal.'),
  ...box('Why "Call next" matters', ['Staff don\'t choose patients by hand. The system picks the right one: **most urgent first, then whoever has waited longest**. And if two nurses press Call next at the exact same moment, they will never get the same patient (explained in section 5).']),

  H1('3. How it is built (the technology)'),
  P('A useful picture is a **restaurant**: the dining room is what customers see (**frontend**), the kitchen does the work (**backend**), and the store room keeps the ingredients (**database**).'),
  ...table(
    ['Part', 'What we used', 'Plain explanation'],
    [
      ['Frontend (what users see)', 'HTML, CSS (Tailwind), JavaScript', 'The pages, buttons and forms in the browser. Tailwind is a tool that makes styling consistent and quick.'],
      ['Backend (the kitchen)', 'Node.js + Express', 'A program running on a server that receives requests ("call the next patient"), checks who is asking and whether they are allowed, applies the rules, and talks to the database.'],
      ['Database (store room)', 'MongoDB (hosted on MongoDB Atlas)', 'Where all the data lives: patients, appointments, visits, results, prescriptions and so on. Atlas is MongoDB\'s online hosting service.'],
    ],
    [24, 26, 50],
  ),
  P('The frontend and backend talk through an **API** (Application Programming Interface): a fixed list of addresses the frontend can call, like a waiter carrying orders to the kitchen. For example, the frontend sends "POST /api/queue/triage/call-next" and the backend replies with the patient who was called. Our API follows the **REST** style (each address represents a thing, and you use standard actions such as GET to read and POST to create or act).'),
  P('Inside the backend the code is organised in **layers**: routes (the list of addresses) → controllers (read the request, send the reply) → services (the actual rules, e.g. "can this patient be checked in?") → models (the shape of the data). Keeping the rules in one layer makes the system easier to maintain.'),

  H1('4. How the data is stored (MongoDB)'),
  P('Many students know **relational** databases like MySQL, where data sits in tables with rows and columns. **MongoDB** is a **document** database: each record is a **document** (like a filled-in form, written in a format similar to JSON), and similar documents are kept in a **collection** (like a folder of forms). We have 13 collections, e.g. users, patients, appointments, visits, consultations, labRequests, prescriptions and medications.'),
  P('Two important design choices:'),
  B('**Embedding** means putting related information inside the same document. Example: a patient\'s vital signs for a visit are stored inside that visit\'s document, because they belong to it and are always read together.'),
  B('**Referencing** means storing an ID that points to a document in another collection. Example: a visit points to the patient by their ID. We reference things that are large, grow over time, or need different access rights. For example, doctors\' notes are kept separately so reception\'s screens never touch medical data.'),
  ...box('Our key idea', ['A **visit** document *is* the patient\'s queue entry. It records which department the patient is in, their status (waiting, called, being served) and their priority. Moving a patient to the next department is one single update to one document, which keeps things fast and safe.']),

  H1('5. How we keep it safe and correct'),
  H2('5.1 Security and privacy'),
  B('**Passwords are never stored as text.** They are **hashed** with bcrypt: scrambled one-way, so even we cannot read them; at login the system scrambles what you typed and compares.'),
  B('**Login session:** after login the browser gets a secure token (a **JWT**, JSON Web Token) in an **httpOnly cookie**, which JavaScript on the page cannot read. This protects against stealing sessions.'),
  B('**Server-side permission checks:** hiding a button is not enough. Every request is checked on the server against the user\'s role. A pharmacist who tries to open a doctor\'s notes gets an "access denied" (error **403**).'),
  B('**Privacy by role:** each role gets only the fields it needs; the lab and pharmacy see the patient\'s name, age, sex and allergies, not their contact details or history. The TV display shows ticket numbers only. This follows the **Kenya Data Protection Act, 2019**, which treats health data as sensitive.'),
  B('**Attack protection:** we block **NoSQL injection** (sneaking database commands into a form) and **IDOR** (changing an ID in a request to see someone else\'s record).'),
  B('**Activity log (audit):** who did what and when, including every time someone opened a patient\'s medical record.'),
  H2('5.2 Keeping data correct'),
  B('**No double-booking:** the database has a **unique index**, a rule that says "only one active appointment per doctor per start time". Even if two receptionists click Book at the same instant, the database accepts only one. (It is a **partial** index: cancelled appointments don\'t count, so that slot can be booked again.)'),
  B('**No patient in the queue twice:** the same kind of unique rule on visits.'),
  B('**Atomic "Call next":** **atomic** means "happens as one unbreakable step". Finding the next waiting patient and marking them as called happen together, so two staff can never grab the same patient.'),
  B('**Transactions (all-or-nothing):** when several records must change together, either all changes are saved or none are. Like a bank transfer: money must leave one account AND arrive in the other. Example: dispensing reduces stock, updates the prescription and closes the visit; if one medicine is out of stock, nothing changes at all.'),
  B('**State machines:** each thing can only move through allowed statuses. An appointment can go scheduled → checked in → completed, but a cancelled appointment can never be checked in.'),
  B('**Validation:** every form is checked on the server (e.g. phone format, date of birth not in the future, vital signs within possible ranges).'),

  H1('6. How we worked (methodology and requirements)'),
  P('We used the **Incremental Model**: build the system in small, complete pieces, each tested and working before the next. Like building a house room by room, where every finished room is usable. Our five increments: (1) foundation: login, roles, database; (2) front desk and queues; (3) clinical flow: doctor, lab, pharmacy; (4) patient portal, messaging and reports; (5) testing, fixes, diagrams. We chose it over **Waterfall** (everything tested only at the end: risky with a short deadline) and **Scrum** (an Agile method built for frequently changing requirements, with lots of meetings and sprints).'),
  P('**Requirements** are statements of what the system must do. We have three types:'),
  B('**Functional (FR):** what the system does, e.g. FR-APT-03 "no double-booking". We have 80, each with an ID.'),
  B('**Non-functional (NFR):** how well it does it: security, speed, usability, maintainability (21).'),
  B('**Domain (DR):** rules that come from healthcare itself, e.g. triage priority, plausible vital signs, data protection (10).'),
  P('Each requirement has a **MoSCoW** priority: **M**ust have, **S**hould have, **C**ould have (and Won\'t have). We built all the Must haves and most Should haves.'),

  H1('7. The diagrams and how to read them'),
  P('We drew our diagrams in **UML** (Unified Modeling Language), the standard picture language for software, using a tool called **PlantUML**, which turns text into diagrams.'),
  ...table(
    ['Diagram', 'What it shows', 'How to read it'],
    [
      ['Use-case diagram', 'Who uses the system and what they can do', 'Stick figures = actors (roles); ovals = things they can do. «include» = always also does that step; «extend» = optional extra step. A hollow triangle arrow = "is a kind of" (Doctor is a kind of Clinician).'],
      ['Sequence diagram', 'The order of messages in one task, e.g. a lab request', 'Read top to bottom; time flows down. Each arrow is one message between parts. Boxes labelled "alt" = alternative paths, "loop" = repeat, "transaction" = all-or-nothing.'],
      ['Communication diagram', 'The same kind of interaction, focusing on which parts talk to which', 'Objects linked by lines, with numbered messages (1, 2, 3…) giving the order. This is our "interaction diagram".'],
      ['State machine diagram', 'The allowed statuses of a visit, appointment or lab request', 'Rounded boxes = states; arrows = allowed changes; the black dot = start.'],
      ['Data model (ERD)', 'The database collections and how they connect', 'Boxes = collections; filled diamond = embedded data; arrow = reference; numbers like 1 and * = "one" and "many".'],
      ['Architecture diagram', 'How the browser, server and database fit together', 'Layers from top (browser) to bottom (database).'],
    ],
    [20, 30, 50],
  ),
  ...image(diag('state-appointment'), 'Example: the appointment state machine (allowed status changes).', 600, 260),

  H1('8. Testing'),
  P('We wrote **46 automated tests**: small programs that use the system the way a person would and check the result. They run in about a minute against a separate test database, and all pass. They prove things like: two bookings for the same slot at the same moment → only one succeeds; two nurses pressing Call next together → different patients; a pharmacist opening doctor\'s notes → refused; dispensing with too little stock → nothing changes.'),
  P('We also clicked through the whole system as every role in a browser. That found five interface bugs, which we fixed. The most interesting was a **race condition** (two operations "racing" and the slower, older one winning): changing doctor and then date quickly in the booking box sometimes showed the wrong day\'s slots. Now the system ignores the older answer.'),

  H1('9. Honest limitations'),
  B('One clinic only; no billing or insurance; messages are in-app only (no SMS).'),
  B('Screens refresh every 4–5 seconds (**polling**: asking the server repeatedly) rather than instantly (**WebSockets**: a permanent live connection). That is good enough for a clinic, but WebSockets are listed as future work.'),
  B('Not built: one-step rescheduling, CSV export of reports, cancelling a lab request, adding notes to a finalised consultation.'),
  B('The layout on a phone has not been formally tested.'),
  B('All data in the system is **synthetic** (made up for demonstration), never real patients.'),

  H1('10. Where things are and how to run it'),
  ...table(
    ['Location', 'What is there'],
    [
      ['src/', 'Backend code (API, rules, database models)'],
      ['public/', 'Frontend code (pages, styles, scripts)'],
      ['tests/', 'The 46 automated tests'],
      ['scripts/seed.js', 'Fills the database with synthetic demo data'],
      ['docs/', 'Blueprint, diagrams, screenshots, report, presentation, these guides'],
      ['README.md', 'How to run the system and the demo login accounts'],
      ['PROJECT_STATUS.md / CLAUDE-ASSISTANCE.md', 'Progress tracker / log of AI-assisted work'],
    ],
    [35, 65],
  ),
  P('To run it: install Node.js, run **npm install**, put the database address in a file called **.env**, run **npm run seed** (fresh demo data) and **npm start**, then open **http://localhost:3000**. The demo accounts and the shared password are in README.md and docs/Demo-Accounts.docx.'),

  H1('11. Glossary'),
  ...table(
    ['Term', 'Meaning'],
    [
      ['API / endpoint', 'The list of addresses the frontend uses to ask the backend to do things; one address = one endpoint.'],
      ['Atomic', 'Happens as one unbreakable step; nobody can sneak in halfway.'],
      ['bcrypt / hashing', 'One-way scrambling of passwords so they are never stored readable.'],
      ['CASE tools', 'Computer-Aided Software Engineering: software that helps build software (PlantUML, Git, test tools and so on).'],
      ['Collection / document', 'MongoDB\'s "folder" / "form". A document holds one record; a collection holds many documents.'],
      ['Cookie / JWT', 'A small item the browser stores; ours holds a signed login token (JSON Web Token).'],
      ['Git / GitHub / commit / tag', 'Version control: a history of every change (commit), stored online on GitHub; a tag marks a milestone (e.g. inc-3).'],
      ['HTTP status codes', '200 OK; 201 created; 400 bad request; 401 not logged in; 403 not allowed; 404 not found; 409 conflict (e.g. slot taken); 422 invalid input.'],
      ['IDOR', 'Insecure Direct Object Reference: changing an ID in a request to see someone else\'s data. We block it.'],
      ['Index / unique index', 'A database shortcut for fast searching / a rule that forbids duplicates.'],
      ['Mongoose', 'A library that defines the shape and rules of our MongoDB documents in code.'],
      ['NoSQL injection', 'Sneaking database commands into a form field; we reject such input.'],
      ['Polling', 'The screen asks the server for updates every few seconds.'],
      ['Race condition', 'A bug where the result depends on which of two simultaneous operations finishes first.'],
      ['RBAC', 'Role-based access control: permissions depend on your role.'],
      ['Replica set', 'MongoDB running as a group of copies; needed for transactions. Atlas provides it.'],
      ['Seed data', 'Sample data loaded into the database for demos and tests.'],
      ['Transaction', 'Several changes that are saved all together or not at all.'],
      ['Triage', 'Sorting patients by how urgently they need care.'],
      ['UML', 'Unified Modeling Language: standard diagrams for designing software.'],
      ['Vital signs', 'Basic body measurements: temperature, blood pressure, pulse, breathing rate, oxygen level (SpO₂), weight, height.'],
    ],
    [26, 74],
  ),
];

/* ================================================================== */
/* DOCUMENT 2 — Presentation guide                                     */
/* ================================================================== */
const MEMBERS = [
  {
    n: 1, role: 'Opening, live demo and question moderator', slides: '1, 25, 26, 27',
    parts: [
      ['Slide 1: Title', ['Welcome the audience; name the project and say it coordinates a patient\'s visit across five departments.', 'Introduce the group (names are on the slide) and say each member presents one part, ending with a live demo.']],
      ['Slide 25: Live demonstration (about 10 minutes)', ['Follow the 7 steps on the slide (script below).', 'Narrate what each role sees, and point out the ticket appearing on the "Who\'s Next" screen.']],
      ['Slides 26–27: Thank you, then Q&A', ['Thank the lecturer. During questions, **send each question to the member who presented that topic** (see the table on page 1).']],
    ],
    prep: [
      'Demo script: (1) reception checks in a booked patient → ticket on the display; (2) nurse calls and records vitals, including a fever so the red flags show; (3) doctor calls the patient and requests a malaria test; (4) lab technician records the sample and releases results; (5) doctor sees "Results ready" and prescribes; (6) pharmacist dispenses, so the visit is complete; (7) show the patient portal and the admin Reports page.',
      'Before the session: run **npm run seed** (fresh demo data), **npm start**, and open one browser window per role, already logged in (receptionist, nurse, doctor, lab technician, pharmacist, patient, admin), plus the display (http://localhost:3000/display) on a second screen if possible.',
      'Rehearse at least twice. Keep a **recorded backup video** in case the internet or database fails.',
    ],
    qa: [['Did you use AI?', 'Yes, Claude Code helped with code and documents; every step is logged in CLAUDE-ASSISTANCE.md, and the group reviewed and tested the work.']],
  },
  {
    n: 2, role: 'Introduction and problem', slides: '2, 3',
    parts: [
      ['Slide 2: Introduction & background', ['A visit is a chain: reception → nurse → doctor → lab → pharmacy.', 'Many clinics coordinate this with paper and verbal calls; every hand-off is where patients wait and information gets lost.']],
      ['Slide 3: Problem statement', ['Go through the six problems with a quick real example for one or two of them (e.g. a patient sent to the lab has to queue again from the start).', 'Close with: these are information and coordination problems, which is what an information system solves.']],
    ],
    prep: ['Read sections 1 and 2 of the Project Explainer.'],
    qa: [['Who are the users of the system?', 'Eight roles: receptionist, administrator, nurse, clinician, doctor, lab technician, pharmacist and patient.']],
  },
  {
    n: 3, role: 'Objectives and proposed solution', slides: '4, 5',
    parts: [
      ['Slide 4: Objectives', ['Read the main objective, then the six specific objectives. Say that each one maps to a module that the demo shows.']],
      ['Slide 5: Proposed solution', ['Walk through the coloured journey arrows with one imaginary patient.', 'Point to the purple curved arrow: lab results send the patient back to the same clinician, keeping their place.', 'Mention the portal screenshot: the patient sees their position.']],
    ],
    prep: ['Read section 2.2 of the Explainer ("One patient\'s journey"). Practise telling it as a short story.'],
    qa: [['Can a patient skip the nurse?', 'Yes. At check-in, reception chooses triage or straight to consultation.']],
  },
  {
    n: 4, role: 'Methodology and use-case diagram (Guidelines 1 and 3)', slides: '6, 7, 14',
    parts: [
      ['Slide 6: Incremental Model', ['Define it: build in small, complete, tested pieces. Explain the five coloured increments.', 'Evidence: Git tags inc-2, inc-3, inc-4 and PROJECT_STATUS.md.']],
      ['Slide 7: Why Incremental?', ['Use the comparison table: Waterfall tests too late; Scrum is built for changing requirements and has heavy overhead.', 'Give one advantage and one limitation from the cards.']],
      ['Slide 14: Use-case diagram', ['Stick figures = actors, ovals = use cases.', 'Doctor "is a kind of" Clinician (generalisation), which avoids duplicating features. «include» = always also done (Call next); «extend» = optional (create portal access).']],
    ],
    prep: ['Explainer sections 6 and 7 (use-case row).'],
    qa: [['Why not Agile/Scrum?', 'Our requirements were stable and the timeframe very short; Scrum\'s sprints and ceremonies would add overhead without benefit.'], ['Doctor vs clinician?', 'Same consultation module; doctors also have bookable schedules and unrestricted prescribing.']],
  },
  {
    n: 5, role: 'Requirements (Guideline 2)', slides: '8, 9, 10',
    parts: [
      ['Slide 8: Functional requirements', ['Explain the ID format (FR-APT-03) and MoSCoW (65 must, 12 should, 3 could; 80 total).', 'Pick one of the three highlighted rules and explain why the database enforces it.']],
      ['Slide 9: Non-functional requirements', ['For each card say **how** it is met, e.g. passwords are hashed with bcrypt; every request is permission-checked on the server.']],
      ['Slide 10: Domain requirements', ['Kenya Data Protection Act 2019: health data is sensitive → display shows tickets only, admin cannot read medical notes.', 'Mention two more rules, e.g. triage priority and impossible vital signs being rejected.']],
    ],
    prep: ['Explainer sections 5.1 and 6.'],
    qa: [['Functional vs non-functional vs domain?', 'What it does / how well it does it / rules that come from healthcare itself.'], ['Why can\'t the admin read clinical notes?', 'Need-to-know principle under the Data Protection Act: admin manages the system, not patient care.']],
  },
  {
    n: 6, role: 'Architecture and database', slides: '11, 12, 13',
    parts: [
      ['Slide 11: Architecture', ['Three tiers: browser (frontend), Node.js/Express server (backend), MongoDB (database). Use the restaurant picture if helpful.', 'Each request passes security checks, login check, role check and validation before the rules run.']],
      ['Slide 12: Database design', ['MongoDB stores documents in 13 collections.', 'Embedded vs referenced: explain one example of each. Key idea: the visit document IS the queue entry.']],
      ['Slide 13: Data model & integrity', ['How to read the diagram: boxes = collections, diamond = embedded, arrow = reference.', 'Explain the three integrity tools: unique partial indexes, transactions, schema validators.']],
    ],
    prep: ['Explainer sections 3, 4 and 5.2.'],
    qa: [['Why MongoDB and not MySQL?', 'Clinical data is nested (vitals, results, prescription items), which suits documents; MongoDB still gives integrity with unique indexes, validators and transactions.'], ['How is double-booking prevented?', 'A unique index on doctor + start time for active appointments; the database itself rejects the second booking.'], ['What if the server crashes mid-dispensing?', 'It is one transaction: either everything is saved or nothing is.']],
  },
  {
    n: 7, role: 'Sequence and interaction diagrams, CASE tools (Guidelines 3 and 4)', slides: '15, 16, 17',
    parts: [
      ['Slide 15: Sequence diagram (consultation → lab)', ['Read it top to bottom: time flows down, each arrow is a message.', 'Point at the "transaction" boxes: creating the lab request and moving the patient happen all-or-nothing.']],
      ['Slide 16: Communication diagram', ['Both are interaction diagrams: sequence = time order; communication = which objects talk, with numbered messages.', 'Follow messages 1 to 10 for "Call next".']],
      ['Slide 17: CASE tools', ['For each tool: what it is, what we used it for, the evidence. Only claim tools we really used.']],
    ],
    prep: ['Explainer section 7. Open docs/diagrams/rendered/ and look at each diagram once.', 'If group members also used VS Code or MongoDB Compass, add them to the slide with a screenshot as evidence.'],
    qa: [['Sequence vs communication diagram?', 'Same information, different focus: time order vs links between objects.'], ['How do your diagrams match the code?', 'They were drawn from the finished code using the real function names and addresses.']],
  },
  {
    n: 8, role: 'Implemented modules, screenshots and testing', slides: '18, 19, 20, 23',
    parts: [
      ['Slide 18: Implemented modules', ['14 modules with green ticks; the charts come from the system\'s own Reports page (demo data).', 'Be honest about the short "not yet built" list at the bottom.']],
      ['Slides 19–20: Screenshots', ['One sentence per screenshot; stress that each role has its own screen and sees only its own tools.']],
      ['Slide 23: Testing & results', ['46 automated tests, all passing, plus a browser walkthrough of every role.', 'Read two key test cases (e.g. two nurses calling at once get different patients).']],
    ],
    prep: ['Explainer sections 8 and 9. Run **npm test** once so you have seen the tests pass.'],
    qa: [['How did you test it?', 'Automated API tests for the rules and permissions, plus a manual walkthrough as every role.'], ['Is it real-time?', 'Near real-time: screens refresh every 4–5 seconds (polling). WebSockets are future work.']],
  },
  {
    n: 9, role: 'Code snippet, errors and conclusion (Guideline 5)', slides: '21, 22, 24',
    parts: [
      ['Slide 21: Code snippet "Call next patient"', ['It belongs to the Queue Management module.', 'Walk through the three numbered points: filter (only waiting patients), atomic update (two staff can never get the same patient), sort (most urgent first, then longest wait).']],
      ['Slide 22: Possible errors', ['Tell two short stories, e.g. the real race condition we found in the booking box, and a duplicate check-in being refused with a clear message.']],
      ['Slide 24: Conclusion & recommendations', ['Link achievements back to the problems on slide 3; read the limitations honestly; give two or three future-work ideas (SMS alerts, WebSockets, insurance integration).']],
    ],
    prep: ['Explainer sections 5.2, 8 and 9. Read the full code snippet in section 8.1 of the report.'],
    qa: [['What is findOneAndUpdate?', 'A MongoDB command that finds one document and updates it in a single atomic step.'], ['What happens if the queue is empty?', 'The function returns nothing and the screen says "No patients are waiting"; it does not crash.']],
  },
];

const guide = [
  ...titleBlock('Presentation Guide', 'What each member presents and how. Members choose their own section; members are labelled 1–9.'),
  H1('How the session works'),
  ...table(
    ['Part', 'Time', 'Notes'],
    [['Talk (slides 1–24)', 'about 30 minutes', 'Members 1–9 in order; each moves at their own pace'], ['Live demo (slide 25)', 'about 10 minutes', 'Member 1 drives the system'], ['Questions (slide 27)', 'up to 20 minutes', 'Member 1 sends each question to the member who covered that topic']],
    [30, 22, 48],
  ),
  P('**File to use:** docs/presentation/CareQueue-Presentation.pptx. Every slide has **speaker notes** (in PowerPoint: View → Notes) with what to say. Before presenting, fill in the course name, course code and lecturer on slide 1.'),
  H1('Who presents what'),
  ...table(['Member', 'Slides', 'Topic'], MEMBERS.map((m) => [`Member ${m.n}`, m.slides, m.role]), [16, 18, 66]),
  P('Pick a member number, write your name next to it, and stick to that section. If the group has a strong demo driver, they should take Member 1.'),
  ...MEMBERS.flatMap((m, i) => [
    H1(`Member ${m.n}: ${m.role}`),
    P(`**Slides:** ${m.slides}`),
    ...m.parts.flatMap(([title, points]) => [H3(title), ...points.map((p) => B(p))]),
    H3('How to prepare'),
    ...m.prep.map((p) => B(p)),
    ...box('Questions you may get (short answers)', m.qa.map(([q, a]) => `**${q}** ${a}`), 'F8FAFC'),
    ...(i < MEMBERS.length - 1 ? [P(`**Hand over:** finish with one sentence that leads to the next topic, e.g. "Member ${m.n + 1} will now take you through …"`, { spacing: { after: 200 } })] : []),
  ]),
  H1('General tips'),
  B('Talk to the audience, not the screen; the slides are mostly pictures, so explain them.'),
  B('Keep to the facts: never claim something the system doesn\'t do. If unsure, say "that is future work".'),
  B('Read the **Project Explainer** first so everyone understands the whole project, not just their own slides.'),
  B('Do one full rehearsal as a group, including the demo and handovers.'),
];

/* ---------------- write ---------------- */
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = [
  ['Project-Explainer.docx', makeDoc('CareQueue Clinic: Project Explainer', explainer)],
  ['Presentation-Guide.docx', makeDoc('CareQueue Clinic: Presentation Guide', guide)],
];
for (const [name, doc] of out) {
  fs.writeFileSync(path.join(OUT_DIR, name), await Packer.toBuffer(doc));
  console.log(`Wrote docs/group/${name}`);
}
