// Generates docs/report/CareQueue-Project-Report.docx (Word).
// Usage: node scripts/docs/build-report.mjs
// Requirement tables are read from docs/BLUEPRINT.md so the report and the specification never diverge.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const OUT_DIR = path.join(ROOT, "docs/report");
const OUT = path.join(OUT_DIR, "CareQueue-Project-Report.docx");
const DIAG = (n) => path.join(ROOT, "docs/diagrams/rendered", `${n}.png`);
const SHOT = (n) => path.join(ROOT, "docs/screenshots", `${n}.jpg`);
const BRAND = "088577";
const FONT = "Calibri";

/* ---------------- helpers ---------------- */
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, ...o });
// Inline **bold** markup support for body text.
function runs(t, o = {}) {
  return t
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**")
        ? run(part.slice(2, -2), { ...o, bold: true })
        : run(part, o),
    );
}
const P = (t, o = {}) =>
  new Paragraph({
    children: runs(t),
    spacing: { after: 120, line: 276 },
    alignment: AlignmentType.JUSTIFIED,
    ...o,
  });
const H1 = (t) =>
  new Paragraph({
    text: t,
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: false,
    spacing: { before: 240, after: 120 },
  });
const H2 = (t) =>
  new Paragraph({
    text: t,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
  });
const B = (t, level = 0) =>
  new Paragraph({
    children: runs(t),
    numbering: { reference: "bullets", level },
    spacing: { after: 60, line: 264 },
  });
const N = (t) =>
  new Paragraph({
    children: runs(t),
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 60, line: 264 },
  });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

let figNo = 0;
let tabNo = 0;
function imgSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89)
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: "png" };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc2)
      return {
        h: b.readUInt16BE(i + 5),
        w: b.readUInt16BE(i + 7),
        type: "jpg",
      };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(file);
}
/** Figure with caption. maxW/maxH in pixels (96 dpi; page text width ≈ 624 px). */
function figure(file, captionText, { maxW = 620, maxH = 520 } = {}) {
  const s = imgSize(file);
  const r = Math.min(maxW / s.w, maxH / s.h, 1.2);
  figNo++;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: s.type,
          data: fs.readFileSync(file),
          transformation: {
            width: Math.round(s.w * r),
            height: Math.round(s.h * r),
          },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        run(`Figure ${figNo}: `, { bold: true, size: 18, color: "475569" }),
        run(captionText, { italics: true, size: 18, color: "475569" }),
      ],
    }),
  ];
}
const border = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const borders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
  insideHorizontal: border,
  insideVertical: border,
};
/** Table with a coloured header row. widths in percent. */
function table(header, rows, widths, captionText, { size = 18 } = {}) {
  tabNo++;
  const cell = (t, i, head) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: head
        ? { type: ShadingType.CLEAR, color: "auto", fill: BRAND }
        : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [
        new Paragraph({
          children: runs(String(t ?? ""), {
            size,
            color: head ? "FFFFFF" : "1E293B",
            bold: head,
          }),
        }),
      ],
    });
  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        run(`Table ${tabNo}: `, { bold: true, size: 18, color: "475569" }),
        run(captionText, { italics: true, size: 18, color: "475569" }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: header.map((h, i) => cell(h, i, true)),
        }),
        ...rows.map(
          (r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }),
        ),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
function code(lines) {
  return lines.map(
    (l, i) =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "F1F5F9" },
        spacing: { after: 0, line: 240 },
        indent: { left: 120, right: 120 },
        children: [
          run(`${String(i + 1).padStart(2, " ")}  `, {
            font: "Consolas",
            size: 16,
            color: "94A3B8",
          }),
          run(l || " ", { font: "Consolas", size: 16, color: "0F172A" }),
        ],
      }),
  );
}

/* ---------------- data from the blueprint ---------------- */
const blueprint = fs.readFileSync(path.join(ROOT, "docs/BLUEPRINT.md"), "utf8");
const clean = (s) =>
  s
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/~~/g, "")
    .replace(/\[A\]|\[R\]|\[C\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const FR_STATUS = {
  "FR-NUR-06": "Not implemented",
  "FR-APT-09": "Not implemented (future work)",
  "FR-RPT-03": "Not implemented (future work)",
  "FR-POR-04": "Out of scope",
  "FR-CON-09": "Partial: read-only after finalising; addenda not built",
  "FR-LAB-02": "Partial: requester cancellation not built",
};
// Split on ' | ' (with spaces) so pipes inside cell text, e.g. 'triage|consultation', are kept.
const cells = (line) =>
  line.replace(/^\| /, "").replace(/ \|$/, "").split(" | ");
const frRows = blueprint
  .split("\n")
  .filter((l) => /^\| FR-[A-Z]+-\d+ \| [MSC] \|/.test(l))
  .map(cells)
  .map((c) => [c[0], c[1], clean(c[2]), FR_STATUS[c[0]] || "Implemented"]);
const NFR_STATUS = {
  "NFR-PERF-01": "Not formally measured",
  "NFR-USE-03": "Designed responsive; phone width not tested",
  "NFR-USE-04": "Partial: labels & keyboard; no audit run",
  "NFR-CMP-01": "Tested in a Chromium browser only",
};
const nfrRows = [
  ...blueprint.matchAll(
    /^\| (NFR-[A-Z]+-\d+) \| ([MSC]) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm,
  ),
].map((m) => [m[1], clean(m[3]), clean(m[4]), NFR_STATUS[m[1]] || "Met"]);
const drRows = [
  ...blueprint.matchAll(/^\| (DR-\d+) \| ([^|]+) \| ([^|]+) \|$/gm),
].map((m) => [m[1], clean(m[2]), clean(m[3])]);

// The real code snippet, read from the source file.
const qsrc = fs
  .readFileSync(path.join(ROOT, "src/services/queue.service.js"), "utf8")
  .split("\n");
const start = qsrc.findIndex((l) =>
  l.startsWith("export async function callNext"),
);
const end = qsrc.findIndex((l, i) => i > start && l === "}");
const snippet = qsrc.slice(start, end + 1);

const members = [
  ["Charbel Ngeti", "221441"],
  ["Adelight Naino", "220702"],
  ["Abigael Wambui", "193891"],
  ["Alvin Otanga", "220267"],
  ["Ajani M'maitsi", "186452"],
  ["Nathaniel Lado", "178626"],
  ["Evans Kima", "212539"],
  ["Faith Wanjira", "220506"],
  ["Matthew Mwachi", "189603"],
];

/* ================================================================== */
/* Title page                                                          */
/* ================================================================== */
const titlePage = [
  new Paragraph({
    spacing: { before: 1400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [run("CareQueue Clinic", { size: 30, color: BRAND, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      run("Clinic Queue & Appointment Management System", {
        size: 44,
        bold: true,
        color: "022A28",
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [run("Project Report", { size: 28, color: "475569" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [run("Software Engineering", { size: 24 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [
      run("Lecturer: Dr Jael Sanyanda   ·   20 November 2026", { size: 24 }),
    ],
  }),
  ...table(
    ["Group member", "Admission number"],
    members,
    [60, 40],
    "Group members",
    { size: 22 },
  ),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [
      run(
        "All patient data used in the system and in this report is synthetic.",
        { italics: true, size: 18, color: "64748B" },
      ),
    ],
  }),
  pageBreak(),
];

/* ================================================================== */
/* Front matter                                                        */
/* ================================================================== */
const front = [
  new Paragraph({ text: "Abstract", heading: HeadingLevel.HEADING_1 }),
  P(
    "Outpatient clinics coordinate every patient visit across reception, nursing, consultation, laboratory and pharmacy, often with paper registers and verbal calls. This causes long and invisible waiting times, double-booked appointments, disorganised queues and lost information between departments. This project designed and implemented **CareQueue Clinic**, a web-based Clinic Queue and Appointment Management System built with HTML, Tailwind CSS and JavaScript on the frontend, Node.js and Express on the backend, and MongoDB as the database.",
  ),
  P(
    'The system supports eight user roles (administrator, receptionist, doctor, clinician, nurse, laboratory technician, pharmacist and patient) with server-side role-based access control. Patients receive a ticket at check-in and move through priority-based queues for triage, consultation, laboratory and pharmacy. Laboratory results return the patient to the requesting clinician, and medication dispensing updates stock inside a database transaction. A public "Who\'s Next" display shows ticket numbers only, in line with the Kenya Data Protection Act, 2019. The system was developed using the Incremental Model in five increments, modelled with UML (use-case, sequence, communication and state diagrams), and verified with 46 automated API tests and a multi-role browser walkthrough.',
  ),
  new Paragraph({ text: "Table of contents", heading: HeadingLevel.HEADING_1 }),
  new TableOfContents("Table of contents", {
    hyperlink: true,
    headingStyleRange: "1-2",
  }),
  pageBreak(),
];

/* ================================================================== */
/* 1. Introduction                                                     */
/* ================================================================== */
const ch1 = [
  H1("1. Introduction"),
  H2("1.1 Background"),
  P(
    "A typical outpatient visit is not one interaction but a chain of them: the patient registers or checks in at reception, a nurse records vital signs, a doctor or clinician consults, the laboratory may run investigations, and the pharmacy dispenses medication. Every hand-off between these departments is a point where patients wait and information can be lost. Many clinics still coordinate these steps with paper registers, handwritten tickets and verbal calls.",
  ),
  H2("1.2 Problem statement"),
  P(
    "The clinic workflow suffers from the following problems, which this project addresses:",
  ),
  B("**Long waiting times** that patients cannot see or predict."),
  B(
    "**Poor appointment scheduling**, including double-booking of doctors and difficulty seeing doctors' availability.",
  ),
  B(
    "**Disorganised queues** in which emergencies and normal arrivals are mixed.",
  ),
  B(
    "**No tracking of patient status**: staff cannot tell whether a patient is at triage, the laboratory or the pharmacy.",
  ),
  B(
    "**Weak coordination between departments**: laboratory requests, results and prescriptions travel on paper.",
  ),
  H2("1.3 Objectives"),
  P(
    "**Main objective:** to develop a web-based system that manages patients, appointments and queues across all clinic departments, with role-based access for every user.",
  ),
  P("**Specific objectives:**"),
  N(
    "Provide conflict-free online appointment booking based on doctors' schedules.",
  ),
  N(
    "Provide priority-based digital queues for triage, consultation, laboratory and pharmacy.",
  ),
  N('Provide a public "Who\'s Next" display that protects patient privacy.'),
  N("Enforce role-based access control for eight user roles."),
  N(
    "Record vital signs, consultations, laboratory results and prescriptions digitally.",
  ),
  N(
    "Provide operational dashboards and reports, including waiting time per department.",
  ),
  H2("1.4 Scope and limitations"),
  P(
    "The system covers a single clinic. It includes patient registration (at reception only), appointments, check-in and queues, nursing triage, consultation, laboratory, prescriptions with basic pharmacy stock, a patient portal, in-app messaging and reports. Billing, insurance, SMS notifications, multi-branch operation and HL7/FHIR integration are out of scope. Queue screens refresh by polling every 4–5 seconds rather than with real-time WebSockets.",
  ),
];

/* ================================================================== */
/* 2. Methodology                                                      */
/* ================================================================== */
const ch2 = [
  H1("2. Software development methodology"),
  H2("2.1 The Incremental Model"),
  P(
    "We used the **Incremental Model**. The system is divided into small increments; each increment is designed, implemented, integrated with the earlier increments and tested, and then added to the working product. Requirements and the overall architecture are agreed once at the start, and detailed design happens per increment.",
  ),
  P(
    "**Main stages:** (1) requirements and architecture, done once in our project blueprint; (2) increment planning; (3) for each increment: design → build → integrate → test; (4) system testing; (5) delivery.",
  ),
  ...table(
    ["Increment", "Scope", "Evidence"],
    [
      [
        "1 Foundation",
        "Project setup, data model (13 collections), authentication, role-based access, seed data, application shell, staff accounts",
        "Session 3 commit",
      ],
      [
        "2 Front desk",
        'Patients, doctor schedules, appointments, check-in, queue engine, queue board, "Who\'s Next" display, nurse triage',
        "Git tag inc-2",
      ],
      [
        "3 Clinical flow",
        "Consultation, laboratory, prescriptions, pharmacy dispensing and stock",
        "Git tag inc-3",
      ],
      [
        "4 Portal & insight",
        "Patient portal, messaging, reports, activity log",
        "Git tag inc-4",
      ],
      [
        "5 Hardening",
        "Multi-role walkthrough, bug fixes, UML diagrams, documentation",
        "Session 6 commit",
      ],
    ],
    [20, 60, 20],
    "Increments as delivered",
  ),
  H2("2.2 Justification"),
  P(
    "The choice was driven by our constraints rather than popularity. The requirements were **stable** (the roles and modules were fixed by the brief), the **deadline was short**, and the clinic workflow forms a **natural dependency chain** (registration → appointment → check-in → triage → consultation → laboratory → pharmacy) that maps directly onto increments. **Waterfall** was rejected because testing happens only at the end, leaving nothing usable if time runs out. **Scrum** was rejected because it is designed for changing requirements and its sprints and ceremonies are too heavy for our timeframe.",
  ),
  P(
    "**Advantages:** working software after every increment; risk handled early (the concurrency-sensitive queue engine was built in increment 2); progress that is easy to measure. **Limitations:** a sound architecture is needed up front (hence the data model was designed first); integration problems can appear between increments; there is less user feedback than in Agile methods.",
  ),
];

/* ================================================================== */
/* 3. Requirements                                                     */
/* ================================================================== */
const roles = [
  [
    "Administrator",
    "Manages staff accounts, doctor schedules, the medication formulary; views reports and the activity log; read-only access to patients, appointments and queues; no access to clinical records.",
  ],
  [
    "Receptionist",
    "Registers patients, creates portal logins, books/cancels appointments, checks patients in (to triage or straight to consultation), monitors queues; hub for in-app messages.",
  ],
  [
    "Patient",
    "Books and cancels own appointments, sees live queue position, messages reception.",
  ],
  [
    "Nurse",
    "Calls the next patient, records vital signs and assessment, sets triage priority, sends the patient to consultation.",
  ],
  [
    "Clinician",
    "Consultation: notes, lab requests, prescriptions (approved list only), referral, discharge.",
  ],
  [
    "Doctor",
    "Everything a clinician can do, plus a bookable schedule and unrestricted prescribing.",
  ],
  [
    "Lab technician",
    "Calls the next patient, records sample collection, enters and releases results.",
  ],
  [
    "Pharmacist",
    "Reviews prescriptions, dispenses with stock control, receives stock.",
  ],
];
const frByModule = {};
for (const r of frRows) {
  const mod = r[0].split("-")[1];
  frByModule[mod] ??= { M: 0, S: 0, C: 0 };
  frByModule[mod][r[1]]++;
}
const MOD_NAMES = {
  AUTH: "Authentication & authorisation",
  USR: "User & staff management",
  PAT: "Patient management",
  DOC: "Doctor availability",
  APT: "Appointments",
  QUE: "Check-in & queues",
  NUR: "Nursing & assessment",
  CON: "Clinical consultation",
  LAB: "Laboratory",
  PHA: "Prescriptions & pharmacy",
  MSG: "Messaging",
  POR: "Patient portal",
  RPT: "Dashboards & reports",
  AUD: "Audit",
};
const keyFR = [
  "FR-AUTH-03",
  "FR-PAT-02",
  "FR-APT-03",
  "FR-QUE-03",
  "FR-QUE-05",
  "FR-QUE-06",
  "FR-QUE-09",
  "FR-NUR-02",
  "FR-CON-05",
  "FR-CON-06",
  "FR-PHA-03",
  "FR-PHA-04",
  "FR-MSG-01",
  "FR-RPT-02",
];
const ch3 = [
  H1("3. Requirements analysis"),
  P(
    "Requirements were gathered from the project brief and refined with the group (decisions recorded in the blueprint). Every requirement has a unique identifier (e.g. **FR-APT-03** = appointments requirement 3) and a MoSCoW priority: **M**ust, **S**hould or **C**ould. The complete list of 80 functional requirements, with how each is satisfied and its implementation status, is in Appendix A.",
  ),
  H2("3.1 Users and roles"),
  ...table(
    ["Role", "Responsibilities in the system"],
    roles,
    [18, 82],
    "User roles (role-based access control is enforced on the server for every API request)",
  ),
  P(
    "**Doctor vs clinician:** both use one shared consultation module. The difference is only in permissions, which avoids duplicating functionality. **Admin vs receptionist:** the administrator manages the system but cannot alter operational or clinical records; the receptionist runs the front desk.",
  ),
  H2("3.2 Functional requirements"),
  ...table(
    ["Module", "Must", "Should", "Could"],
    Object.entries(frByModule).map(([k, v]) => [
      MOD_NAMES[k] || k,
      v.M,
      v.S,
      v.C,
    ]),
    [52, 16, 16, 16],
    `Functional requirements per module (${frRows.length} in total)`,
  ),
  ...table(
    ["ID", "Requirement", "Status"],
    frRows.filter((r) => keyFR.includes(r[0])).map((r) => [r[0], r[2], r[3]]),
    [14, 70, 16],
    "Key functional requirements (full list in Appendix A)",
  ),
  H2("3.3 Non-functional requirements"),
  ...table(
    ["ID", "Category", "Requirement", "Status"],
    nfrRows,
    [14, 14, 54, 18],
    "Non-functional requirements",
    { size: 16 },
  ),
  H2("3.4 Domain requirements"),
  P(
    "Domain requirements come from how healthcare works rather than from user requests. The most important is confidentiality under the **Kenya Data Protection Act, 2019**, which classifies health data as sensitive personal data.",
  ),
  ...table(
    ["ID", "Requirement", "How the system satisfies it"],
    drRows,
    [8, 52, 40],
    "Domain requirements",
    { size: 16 },
  ),
];

/* ================================================================== */
/* 4. Design                                                           */
/* ================================================================== */
const ch4 = [
  H1("4. System design"),
  H2("4.1 Architecture"),
  P(
    "CareQueue uses a **three-tier, layered client–server architecture** (Figure 1). The presentation tier is static HTML with JavaScript modules and Tailwind CSS (no frontend framework). The application tier is a Node.js 22 / Express 5 REST API in which every request passes through security headers, authentication (a JWT in an httpOnly cookie), role authorisation and input validation before reaching a controller. **Business rules live only in the service layer** (state machines, transactions, privacy projections). The data tier is a MongoDB Atlas replica set, which is required for multi-document transactions.",
  ),
  ...figure(
    DIAG("architecture"),
    "Three-tier layered architecture (as implemented)",
    { maxH: 430 },
  ),
  H2("4.2 MongoDB data model"),
  P(
    'We did not force a relational design into MongoDB; the model follows the access patterns. The central decision is that **a visit document is the patient\'s queue entry**: it embeds the current queue state (stage, status, priority, assigned staff), the nursing vitals and the stage history. Moving a patient between departments is therefore a single atomic update of one document, and the "call next patient" query is served by one compound index.',
  ),
  ...table(
    ["Decision", "Used for", "Reason"],
    [
      [
        "Embed",
        "Vitals and stage history in visits; test lines and results in lab requests; items in prescriptions; weekly availability in the doctor's profile; status history in appointments",
        "Owned by the parent, bounded in size, always read together, updated atomically with it",
      ],
      [
        "Reference",
        "Patients ↔ visits and appointments; visits → consultations, lab requests, prescriptions; prescription items → medications; conversations → messages",
        "Own lifecycle, unbounded growth, or different access rights (clinical data is kept in separate collections so front-desk queries never touch it)",
      ],
      [
        "Snapshot",
        "Medication name/strength and prescriber on prescriptions; test names on lab requests",
        "Historical records must not change if the catalogue changes later",
      ],
    ],
    [14, 50, 36],
    "Embedding vs referencing",
  ),
  ...figure(
    DIAG("data-model"),
    "MongoDB data model: boxes are collections, filled diamonds are embedded sub-documents, arrows are references",
    { maxH: 420 },
  ),
  P("**Integrity mechanisms:**"),
  B(
    "**Unique partial indexes** that only consider active documents: {doctorId, startAt} and {patientId, startAt} on appointments prevent double-booking; {patientId} on visits prevents a patient being in the queue twice. Because they are enforced by the database, they hold even when two users act at the same moment.",
  ),
  B(
    "**Multi-document transactions** for check-in (visit + appointment), lab requests (request + stage move), prescribing (prescription + note + stage move) and dispensing (stock + prescription + visit + appointment).",
  ),
  B(
    "**State machines** (Figure 7) for appointments, queue status, stages and lab requests; every status change is a conditional update on the current status, so conflicting actions cannot both succeed.",
  ),
  B(
    "**Two validation layers:** Mongoose schemas give friendly messages, and MongoDB $jsonSchema validators (e.g. stock can never be negative) reject invalid data even if it bypasses the application.",
  ),
];

/* ================================================================== */
/* 5. UML                                                              */
/* ================================================================== */
const ch5 = [
  H1("5. System modelling (UML)"),
  P(
    "All diagrams were written in PlantUML from the implemented code, using the real endpoints, services and statuses, so they describe only functionality that exists. Further sequence and communication diagrams are in Appendix B.",
  ),
  H2("5.1 Use-case diagram"),
  ...figure(
    DIAG("use-case"),
    "Use-case diagram: nine actors; Doctor generalises Clinician; «include» and «extend» relationships",
    { maxH: 560 },
  ),
  P(
    'The **Doctor** actor specialises the **Clinician**: it inherits every clinician use case and adds booked appointments and unrestricted prescribing. "Call next patient" is included by every department\'s use case, and "Check allergies" is included by both prescribing and dispensing.',
  ),
  H2("5.2 Sequence diagrams"),
  P(
    "Five sequence diagrams model the key workflows: registration and booking, check-in and queue assignment, triage, consultation with the laboratory round trip, and prescribing with dispensing. Figure 4 shows the cross-department laboratory round trip; Figure 5 shows prescribing and dispensing, including the alternative paths for clinician restrictions, allergy warnings and insufficient stock.",
  ),
  ...figure(
    DIAG("seq-consultation-lab"),
    "Sequence diagram: consultation → laboratory → consultation",
    { maxH: 520 },
  ),
  ...figure(
    DIAG("seq-prescribe-dispense"),
    "Sequence diagram: prescription and dispensing (all-or-nothing transaction)",
    { maxH: 560 },
  ),
  H2("5.3 Interaction (communication) diagram"),
  P(
    'A communication diagram shows the same kind of interaction as a sequence diagram but emphasises which objects are linked, with numbered messages giving the order. Figure 6 models "Call next patient".',
  ),
  ...figure(
    DIAG("comm-call-next"),
    "Communication diagram: call next patient",
    { maxH: 200 },
  ),
  H2("5.4 State machine"),
  ...figure(DIAG("state-visit"), "State machine of a visit (queue entry)", {
    maxH: 380,
  }),
];

/* ================================================================== */
/* 6. Implementation                                                   */
/* ================================================================== */
const ch6 = [
  H1("6. Implementation"),
  P(
    'The implementation consists of about 8,200 lines of JavaScript, HTML and CSS: an Express API organised as routes → controllers → services → models, 13 MongoDB collections, and a single-page interface with a separate workspace for each role. A seed script loads synthetic demonstration data (14 staff, 42 patients, 14 days of history). Every role has its own interface: reception manages registration, booking and queues (Figure 8); clinical staff work in department workspaces with a shared "Call next" queue panel (Figure 9).',
  ),
  ...figure(SHOT("01-reception-dashboard"), "Reception dashboard", {
    maxH: 300,
  }),
  ...figure(
    SHOT("09-consultation-results-ready"),
    "Doctor's consultation workspace after laboratory results were released",
    { maxH: 300 },
  ),
  P("Further screenshots of every module are in Appendix C."),
  H1("7. CASE tools"),
  P("Only tools for which we have evidence in the repository are listed."),
  ...table(
    ["Activity", "Tool", "How we used it", "Evidence"],
    [
      [
        "Planning",
        "PROJECT_STATUS.md in Git",
        "Tracked increments, tasks, known bugs and deliverables",
        "File history",
      ],
      [
        "Design",
        "PlantUML 1.2026.10",
        "All UML diagrams as version-controlled text",
        "docs/diagrams/*.puml",
      ],
      [
        "Coding",
        "Claude Code (AI assistant)",
        "Code generation, review and documentation drafting",
        "CLAUDE-ASSISTANCE.md",
      ],
      [
        "Database",
        "MongoDB Atlas",
        "Hosted replica set; collections, validators, indexes",
        "scripts/init-db.js output",
      ],
      [
        "Build",
        "npm, Tailwind CLI",
        "Dependency management and CSS build",
        "package.json",
      ],
      [
        "Version control",
        "Git and GitHub",
        "History, increment tags inc-2…inc-4",
        "Commit log, tags",
      ],
      [
        "Testing",
        "node:test + Supertest",
        "46 automated API tests",
        "npm test output",
      ],
      [
        "Documentation",
        "pptxgenjs, docx",
        "Generated this report and the slides from scripts",
        "scripts/docs/",
      ],
    ],
    [14, 22, 40, 24],
    "CASE tools by activity",
  ),
];

/* ================================================================== */
/* 8. Code snippet & errors                                            */
/* ================================================================== */
const ch8 = [
  H1("8. Code snippet and error analysis"),
  H2('8.1 "Call next patient" (Queue Management module)'),
  P(
    "The function below, from src/services/queue.service.js, is called when a nurse, clinician, doctor, lab technician or pharmacist presses **Call next**. It is the heart of the system.",
  ),
  ...code(snippet),
  new Paragraph({ spacing: { after: 120 }, children: [] }),
  B(
    '**What it does:** selects the next waiting patient at a department and marks them as called by this staff member, recording the time and room (shown on the "Who\'s Next" display).',
  ),
  B(
    "**How it works:** it first refuses if the staff member is already serving someone. It then builds a filter for patients still **waiting** at this stage (for consultation: assigned to this clinician or unassigned). The **findOneAndUpdate** call finds and updates the patient in one atomic operation, sorted by priority rank (emergency, urgent, normal) and then queue time. An array filter stamps the call time in the open stage-history entry for the waiting-time reports.",
  ),
  B(
    '**Why it is important:** it implements triage fairness and concurrency safety in one place. Because the match ("still waiting") and the update ("now called by me") happen on one document atomically, two staff members pressing Call next at the same moment can never receive the same patient. An automated test verifies this.',
  ),
  H2("8.2 Possible errors"),
  ...table(
    [
      "Type",
      "Realistic example in this system",
      "Detection / prevention / resolution",
    ],
    [
      [
        "Syntax",
        "A missing bracket in a service file; await used outside an async function",
        "The server fails to start with a SyntaxError; node --check and the editor detect it before running",
      ],
      [
        "Runtime",
        "The queue is empty, so the visit is null and the code reads visit.patientId",
        'Null check: the API returns "No patients are waiting"; the central error handler turns unexpected errors into a 500 without leaking stack traces',
      ],
      [
        "Logical",
        "Sorting queueTime descending (newest first), or forgetting priorityRank so emergencies wait",
        'Automated test "calls emergencies before earlier normal arrivals"',
      ],
      [
        "Database",
        "Checking in a patient who is already in the queue → E11000 duplicate key; transactions on a standalone server fail",
        "Unique partial index; the error handler maps E11000 to a clear 409 message; Atlas replica set supports transactions",
      ],
      [
        "Integration",
        "Found during testing: changing doctor then date in the booking dialog sent two requests; the older response arrived last and showed the wrong day's slots",
        "Fixed by tagging each request and ignoring responses that are no longer the latest (race condition)",
      ],
      [
        "Validation",
        "Systolic pressure 1200, diastolic higher than systolic, booking in the past",
        "Server-side range rules return 422 with field-level messages shown next to the inputs",
      ],
      [
        "Security",
        'A pharmacist calls a consultation endpoint directly; a patient changes an ID to read another patient\'s appointment; NoSQL injection {"$ne": null} at login',
        "Server-side role checks (403), ownership checks returning 404, rejection of $-prefixed keys (400); all covered by tests",
      ],
    ],
    [12, 44, 44],
    "Error analysis with examples from the implementation",
    { size: 16 },
  ),
];

/* ================================================================== */
/* 9. Testing & 10. Conclusion                                          */
/* ================================================================== */
const ch9 = [
  H1("9. Testing"),
  P(
    "Testing combined **automated API tests** (Node's built-in test runner with Supertest, each suite running against a freshly seeded test database) and a **manual multi-role walkthrough** in the browser covering reception, nurse, doctor, laboratory, pharmacy, patient and administrator. All 46 automated tests pass.",
  ),
  ...table(
    ["Suite", "Tests", "Examples of what is verified", "Result"],
    [
      [
        "Authentication, patients, appointments",
        "16",
        "Wrong password, NoSQL injection, 403 for wrong roles, duplicate patient warning, simultaneous double-booking (exactly one succeeds), patient cannot read another patient's appointment",
        "Pass",
      ],
      [
        "Check-in and queue",
        "11",
        "Duplicate queue entry refused, two nurses calling at once get different patients, emergency first, impossible vitals rejected, reception cannot see vitals, display shows no names",
        "Pass",
      ],
      [
        "Clinical flow",
        "10",
        "Note required before lab request, results return to the same doctor, allergy acknowledgement, clinician prescribing limits, dispensing rolled back on insufficient stock, no over-dispensing",
        "Pass",
      ],
      [
        "Portal, messaging, reports",
        "9",
        "Own queue position, 2-hour cancellation rule, shared reception inbox, no reading of others' conversations, admin-only reports and audit",
        "Pass",
      ],
    ],
    [22, 8, 58, 12],
    "Automated test results (46 of 46 passing)",
    { size: 16 },
  ),
  P(
    "The walkthrough found and fixed five interface defects: the booking race condition described in section 8.2, a laboratory table overflowing the page, a cramped consultation layout on laptop screens, a display animation that faded ticket numbers, and a misleading dashboard label. **Not tested:** formal performance measurement, an accessibility audit, and the layout at phone width.",
  ),
];
const ch10 = [
  H1("10. Conclusion and recommendations"),
  P(
    'All six objectives were achieved. The system tracks every patient across five departments with a visible ticket, prevents double-booking and duplicate queue entries at database level, serves patients in priority order with concurrency-safe "call next" operations, moves laboratory results and prescriptions digitally, and reports waiting and service times per department. Privacy is enforced by role, as the Kenya Data Protection Act, 2019 requires.',
  ),
  P(
    "**Limitations:** a single clinic; in-app messages only; polling instead of real-time updates; no billing or insurance; a few should/could requirements not built (one-step rescheduling, CSV export, cancelling a laboratory request, addenda to finalised notes); phone-width layout not formally tested.",
  ),
  P("**Recommendations for future work:**"),
  B('SMS or WhatsApp "you are next" notifications.'),
  B("WebSockets for instant queue updates."),
  B("Billing and integration with the Social Health Authority (SHA)."),
  B(
    "Multi-branch support (a branch identifier on documents and branch-scoped roles).",
  ),
  B(
    "HL7/FHIR interoperability, and drug-class allergy checking instead of name matching.",
  ),
  H1("References"),
  P(
    "Republic of Kenya (2019). The Data Protection Act, No. 24 of 2019. Kenya Gazette Supplement No. 181.",
  ),
  P("Sommerville, I. (2016). Software Engineering (10th ed.). Pearson."),
  P(
    "Pressman, R. S., & Maxim, B. R. (2020). Software Engineering: A Practitioner's Approach (9th ed.). McGraw-Hill.",
  ),
  P(
    "MongoDB, Inc. (2026). MongoDB Manual: Transactions; Partial Indexes; Schema Validation. https://www.mongodb.com/docs/manual/",
  ),
  P(
    "Object Management Group (2017). OMG Unified Modeling Language (UML), Version 2.5.1.",
  ),
];

/* ================================================================== */
/* Appendices                                                          */
/* ================================================================== */
const appendices = [
  pageBreak(),
  H1("Appendix A: Full functional requirements"),
  ...table(
    ["ID", "Pri.", "Requirement", "Status"],
    frRows.map((r) => [r[0], r[1], r[2], r[3]]),
    [13, 6, 63, 18],
    "All functional requirements (M = must, S = should, C = could)",
    { size: 15 },
  ),
  H1("Appendix B: Further UML diagrams"),
  ...figure(
    DIAG("seq-register-book"),
    "Sequence diagram: patient registration and appointment booking",
    { maxH: 560 },
  ),
  ...figure(
    DIAG("seq-checkin-queue"),
    "Sequence diagram: check-in, queue assignment and call next",
    { maxH: 560 },
  ),
  ...figure(
    DIAG("seq-triage"),
    "Sequence diagram: nurse assessment and vital signs",
    { maxH: 480 },
  ),
  ...figure(
    DIAG("comm-dispense"),
    "Communication diagram: dispense medication",
    { maxH: 260 },
  ),
  ...figure(DIAG("state-appointment"), "State machine: appointment", {
    maxH: 300,
  }),
  ...figure(DIAG("state-lab"), "State machine: laboratory request", {
    maxH: 300,
  }),
  H1("Appendix C: Screenshots"),
  ...[
    ["00-login", "Sign-in page"],
    ["02-booking-slots", "Booking an appointment with the free-slot grid"],
    ["03-queue-board", "Live queue board (reception)"],
    [
      "04-whos-next-display",
      'Public "Who\'s Next" display: ticket numbers only',
    ],
    [
      "06-triage-vitals-flags",
      "Nurse triage: vitals with abnormal values flagged",
    ],
    ["07-consultation", "Consultation note with today's vitals"],
    ["08-lab-results-entry", "Laboratory results entry"],
    ["10-prescribe", "Prescribing medication"],
    ["11-pharmacy-dispensing", "Pharmacy dispensing with stock levels"],
    ["12-patient-portal", "Patient portal: live ticket and position"],
    ["13-messages", "Messaging with the reception desk"],
    ["14-reports-summary", "Administrator reports"],
    ["15-reports-departments", "Waiting and service time per department"],
    ["16-admin-staff-accounts", "Staff accounts"],
    ["17-activity-log", "Activity (audit) log"],
  ].flatMap(([f, c]) => figure(SHOT(f), c, { maxH: 300 })),
  H1("Appendix D: Installation and demo accounts"),
  N("Install Node.js 22 or later, then run npm install."),
  N(
    "Copy .env.example to .env and set MONGODB_URI (a MongoDB Atlas cluster or another replica set) and JWT_SECRET.",
  ),
  N(
    "Run npm run seed to create collections, validators, indexes and synthetic demo data.",
  ),
  N(
    "Run npm start and open http://localhost:3000 (public display: /display). Run npm test for the automated tests.",
  ),
  P(
    "Demo accounts for every role are listed in README.md and docs/Demo-Accounts.docx (all synthetic).",
  ),
  H1("Appendix E: Use of AI assistance"),
  P(
    "The group used Claude Code, an AI coding assistant, for code generation, review, diagrams and documentation drafting. Its work is logged session by session in CLAUDE-ASSISTANCE.md in the repository. The group reviewed, tested and is accountable for the submitted work.",
  ),
];

/* ================================================================== */
const doc = new Document({
  creator: "CareQueue Clinic project group",
  title: "Clinic Queue & Appointment Management System: Project Report",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: "022A28" },
        paragraph: { spacing: { before: 320, after: 120 } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: BRAND },
        paragraph: { spacing: { before: 200, after: 80 } },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 260 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                run("CareQueue Clinic: Project Report   ·   Page ", {
                  size: 16,
                  color: "94A3B8",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 16,
                  color: "94A3B8",
                  font: FONT,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...titlePage,
        ...front,
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...ch5,
        ...ch6,
        ...ch8,
        ...ch9,
        ...ch10,
        ...appendices,
      ],
    },
  ],
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, await Packer.toBuffer(doc));
console.log(
  `Wrote ${path.relative(ROOT, OUT)}: ${frRows.length} FR, ${nfrRows.length} NFR, ${drRows.length} DR, ${figNo} figures, ${tabNo} tables`,
);
