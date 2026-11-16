// Generates docs/presentation/CareQueue-Presentation.pptx from the approved outline.
// Usage: node --env-file=.env scripts/docs/build-slides.mjs
// Charts use live figures from the (synthetic) demo database via the report service.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";
import { connectDB, disconnectDB } from "../../src/config/db.js";
import { summary } from "../../src/services/report.service.js";
import { clinicDate, addDays } from "../../src/utils/dates.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const DIAG = path.join(ROOT, "docs/diagrams/rendered");
const SHOT = path.join(ROOT, "docs/screenshots");
const OUT = path.join(ROOT, "docs/presentation/CareQueue-Presentation.pptx");

/* ---------------- design system ---------------- */
const C = {
  brand: "088577",
  brandDark: "0B6A61",
  ink: "022A28",
  mint: "EFFCF9",
  mint2: "C9F6EC",
  slate: "334155",
  muted: "64748B",
  line: "E2E8F0",
  bg: "F8FAFC",
  white: "FFFFFF",
  amber: "F59E0B",
  rose: "E11D48",
  violet: "7C3AED",
  sky: "0284C7",
  emerald: "059669",
  orange: "EA580C",
  pink: "DB2777",
  indigo: "4F46E5",
};
const FONT = "Segoe UI";
const W = 13.333;
const H = 7.5;

// Lucide-style icon paths (same set as the app's icons.js), rendered as coloured SVG images.
const ICON = {
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
  calendar:
    '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  monitor:
    '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  stethoscope:
    '<path d="M5 3v5a5 5 0 0 0 10 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.3 3.7 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.3 0 5.4 3.3 4.2 6.6C19.5 15.4 12 20 12 20Z"/>',
  flask:
    '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  pill: '<rect x="2.6" y="8.5" width="18.8" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M11 10v8M15 12v6M19 7v11"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  git: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/>',
  test: '<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="m9 15 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  smartphone:
    '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
  megaphone:
    '<path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14"/>',
  package:
    '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};
const icon = (name, color = "FFFFFF") =>
  `image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`,
  ).toString("base64")}`;

/* ---------------- helpers ---------------- */
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "CareQueue Clinic project group";
pptx.title = "Clinic Queue & Appointment Management System";
pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

let slideNo = 0;
function base(title, { kicker, dark = false } = {}) {
  const s = pptx.addSlide();
  slideNo++;
  s.background = { color: dark ? C.ink : C.white };
  if (!dark) {
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: 0.12,
      fill: { color: C.brand },
      line: { color: C.brand },
    });
    if (kicker)
      s.addText(kicker.toUpperCase(), {
        x: 0.6,
        y: 0.35,
        w: 9,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: C.brand,
        charSpacing: 2,
        fontFace: FONT,
      });
    s.addText(title, {
      x: 0.6,
      y: kicker ? 0.62 : 0.4,
      w: 12,
      h: 0.75,
      fontSize: 30,
      bold: true,
      color: C.ink,
      fontFace: FONT,
    });
    s.addText(`CareQueue Clinic  ·  ${slideNo}`, {
      x: W - 3.6,
      y: H - 0.42,
      w: 3.2,
      h: 0.3,
      fontSize: 9,
      color: C.muted,
      align: "right",
      fontFace: FONT,
    });
  }
  return s;
}
function notes(s, text) {
  s.addNotes(text.trim().replace(/\n\s+/g, "\n"));
}
function iconCircle(s, x, y, size, name, fill) {
  s.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color: fill },
    line: { color: fill },
  });
  const p = size * 0.24;
  s.addImage({
    data: icon(name),
    x: x + p,
    y: y + p,
    w: size - 2 * p,
    h: size - 2 * p,
  });
}
function card(s, x, y, w, h, { fill = C.white, border = C.line, accent } = {}) {
  s.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: border, width: 1 },
    rectRadius: 0.08,
    shadow: {
      type: "outer",
      color: "0F172A",
      opacity: 0.08,
      blur: 6,
      offset: 2,
      angle: 90,
    },
  });
  if (accent)
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: y + 0.08,
      w: 0.07,
      h: h - 0.16,
      fill: { color: accent },
      line: { color: accent },
    });
}
function text(s, t, o) {
  s.addText(t, {
    fontFace: FONT,
    color: C.slate,
    valign: "top",
    margin: 0,
    ...o,
  });
}
function bullets(s, items, o) {
  s.addText(
    items.map((t) => ({
      text: t,
      options: { bullet: { code: "25CF" }, paraSpaceAfter: 6 },
    })),
    { fontFace: FONT, fontSize: 15, color: C.slate, valign: "top", ...o },
  );
}
function image(s, file, box, { border = true } = {}) {
  // Fit an image inside the box while keeping its aspect ratio.
  const { w: iw, h: ih } = pngSize(file);
  const r = Math.min(box.w / iw, box.h / ih);
  const w = iw * r;
  const h = ih * r;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  if (border)
    s.addShape(pptx.ShapeType.rect, {
      x: x - 0.03,
      y: y - 0.03,
      w: w + 0.06,
      h: h + 0.06,
      fill: { color: C.white },
      line: { color: C.line, width: 1 },
      shadow: {
        type: "outer",
        color: "0F172A",
        opacity: 0.12,
        blur: 8,
        offset: 3,
        angle: 90,
      },
    });
  s.addImage({ path: file, x, y, w, h });
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2; // JPEG
  while (i < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc2)
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`unknown image size ${file}`);
}
const shot = (n) => path.join(SHOT, `${n}.jpg`);
const diag = (n) => path.join(DIAG, `${n}.png`);
function caption(s, t, x, y, w) {
  text(s, t, {
    x,
    y,
    w,
    h: 0.3,
    fontSize: 11,
    color: C.muted,
    italic: true,
    align: "center",
  });
}

/* ---------------- data for charts ---------------- */
await connectDB();
const today = clinicDate();
const report = await summary(addDays(today, -13), today);
await disconnectDB();

/* ================================================================== */
/* 1. Title                                                            */
/* ================================================================== */
{
  const s = base("", { dark: true });
  s.background = { color: C.ink };
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 7.6,
    h: H,
    fill: { color: C.brandDark },
    line: { color: C.brandDark },
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: 4.9,
    y: 4.6,
    w: 4.6,
    h: 4.6,
    fill: { color: C.brand, transparency: 40 },
    line: { color: C.brand, transparency: 40 },
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: -1.2,
    y: -1.4,
    w: 3.6,
    h: 3.6,
    fill: { color: "0E554F" },
    line: { color: "0E554F" },
  });
  iconCircle(s, 0.7, 0.75, 0.8, "heart", C.brand);
  text(s, "CareQueue Clinic", {
    x: 1.65,
    y: 0.92,
    w: 5,
    h: 0.5,
    fontSize: 20,
    bold: true,
    color: C.white,
  });
  text(s, "Clinic Queue & Appointment\nManagement System", {
    x: 0.7,
    y: 2.2,
    w: 6.7,
    h: 1.9,
    fontSize: 38,
    bold: true,
    color: C.white,
  });
  text(
    s,
    "Reception · Nursing · Consultation · Laboratory · Pharmacy, in one coordinated web system",
    { x: 0.7, y: 4.2, w: 6.3, h: 0.8, fontSize: 15, color: C.mint2 },
  );
  text(s, "ICS 2201   ·   Lecturer: Dr Jael Sanyanda   ·   20 November 2026", {
    x: 0.7,
    y: 6.55,
    w: 6.6,
    h: 0.4,
    fontSize: 12,
    color: C.mint2,
  });
  text(s, "GROUP MEMBERS", {
    x: 8.2,
    y: 0.9,
    w: 4.5,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: C.mint2,
    charSpacing: 2,
  });
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
  members.forEach(([n, a], i) => {
    const y = 1.35 + i * 0.6;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 8.2,
      y,
      w: 4.5,
      h: 0.5,
      fill: { color: "0B3B37" },
      line: { color: "115E57" },
      rectRadius: 0.06,
    });
    text(s, n, {
      x: 8.4,
      y: y + 0.11,
      w: 2.9,
      h: 0.3,
      fontSize: 14,
      bold: true,
      color: C.white,
    });
    text(s, a, {
      x: 11.2,
      y: y + 0.12,
      w: 1.3,
      h: 0.3,
      fontSize: 13,
      color: C.mint2,
      align: "right",
    });
  });
  notes(
    s,
    `Good morning. We are presenting CareQueue Clinic, our Clinic Queue and Appointment Management System: a web application that coordinates a patient's whole visit, from reception through nursing, consultation, laboratory and pharmacy.
  Briefly introduce the team. Each member presents one part of the project, and we finish with a live demonstration.
  (Fill in the course name, course code and lecturer on this slide before presenting.)`,
  );
}

/* ================================================================== */
/* 2. Introduction & background                                        */
/* ================================================================== */
const JOURNEY = [
  ["Reception", "users", C.sky],
  ["Nurse triage", "heart", C.rose],
  ["Doctor / clinician", "stethoscope", C.brand],
  ["Laboratory", "flask", C.violet],
  ["Pharmacy", "pill", C.amber],
];
{
  const s = base("Introduction & background", { kicker: "Introduction" });
  bullets(
    s,
    [
      "Outpatient clinics serve booked patients and walk-ins every day",
      "A single visit can pass through up to five departments",
      "Many clinics still rely on paper registers, verbal calls and manual tickets",
      "Every hand-off between departments is a point where patients wait and information gets lost",
    ],
    { x: 0.6, y: 1.6, w: 6.2, h: 3.4, fontSize: 18 },
  );
  JOURNEY.forEach(([label, ic, col], i) => {
    const x = 0.75 + i * 2.5;
    iconCircle(s, x, 5.05, 1.05, ic, col);
    text(s, label, {
      x: x - 0.5,
      y: 6.2,
      w: 2.05,
      h: 0.5,
      fontSize: 13,
      bold: true,
      color: C.ink,
      align: "center",
    });
    if (i < JOURNEY.length - 1)
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + 1.3,
        y: 5.4,
        w: 0.9,
        h: 0.38,
        fill: { color: C.line },
        line: { color: C.line },
      });
  });
  image(s, shot("04-whos-next-display"), { x: 7.2, y: 1.45, w: 5.6, h: 3.3 });
  caption(
    s,
    "Our public “Who’s Next” display: ticket numbers only",
    7.2,
    4.8,
    5.6,
  );
  notes(
    s,
    `A typical outpatient visit is not one interaction but a chain of them: reception, a nurse, a doctor or clinician, often the laboratory, and finally the pharmacy.
  In many clinics these steps are coordinated with paper registers and verbal calls. Every hand-off is a point where patients wait and information gets lost.
  Our system targets exactly those hand-offs.`,
  );
}

/* ================================================================== */
/* 3. Problem statement                                                */
/* ================================================================== */
{
  const s = base("Problem statement", { kicker: "Introduction" });
  const P = [
    [
      "Long waiting times",
      "clock",
      C.rose,
      "Patients wait without knowing their position or how long it will take.",
    ],
    [
      "Poor appointment scheduling",
      "calendar",
      C.orange,
      "Double-booked doctors and slots that cannot be checked quickly.",
    ],
    [
      "Disorganised queues",
      "queue",
      C.amber,
      "Who is next? Emergencies and arrivals mixed in one line.",
    ],
    [
      "Doctor availability",
      "stethoscope",
      C.brand,
      "Working hours and days off are hard to see when booking.",
    ],
    [
      "No status tracking",
      "search",
      C.sky,
      "Nobody knows where a patient is: triage, lab or pharmacy?",
    ],
    [
      "Weak coordination",
      "users",
      C.violet,
      "Lab results and prescriptions travel on paper between departments.",
    ],
  ];
  P.forEach(([t, ic, col, d], i) => {
    const x = 0.6 + (i % 3) * 4.1;
    const y = 1.55 + Math.floor(i / 3) * 2.75;
    card(s, x, y, 3.85, 2.45, { accent: col });
    iconCircle(s, x + 0.35, y + 0.3, 0.75, ic, col);
    text(s, t, {
      x: x + 0.35,
      y: y + 1.15,
      w: 3.3,
      h: 0.4,
      fontSize: 17,
      bold: true,
      color: C.ink,
    });
    text(s, d, {
      x: x + 0.35,
      y: y + 1.6,
      w: 3.3,
      h: 0.75,
      fontSize: 13,
      color: C.muted,
    });
  });
  notes(
    s,
    `Walk through each problem with a short real-life example. For example: a patient sent to the lab comes back and has to queue again from the start, or two receptionists book the same doctor at the same time.
  End with: these are coordination and information problems, which is exactly what an information system solves.`,
  );
}

/* ================================================================== */
/* 4. Objectives                                                       */
/* ================================================================== */
{
  const s = base("Project objectives", { kicker: "Introduction" });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 1.5,
    w: 12.1,
    h: 1.05,
    fill: { color: C.brand },
    line: { color: C.brand },
    rectRadius: 0.1,
  });
  iconCircle(s, 0.85, 1.65, 0.75, "target", C.brandDark);
  text(
    s,
    "Main objective: develop a web-based system that manages patients, appointments and queues across all clinic departments, with role-based access for every user.",
    {
      x: 1.8,
      y: 1.72,
      w: 10.7,
      h: 0.7,
      fontSize: 17,
      bold: true,
      color: C.white,
      valign: "middle",
    },
  );
  const O = [
    ["Conflict-free online appointment booking", "calendar", C.sky],
    ["Priority-based digital queues for every department", "queue", C.amber],
    ["A public “Who’s Next” display", "monitor", C.brand],
    ["Role-based access for 8 user roles", "lock", C.violet],
    [
      "Digital vitals, consultation, lab and prescription records",
      "file",
      C.rose,
    ],
    ["Operational dashboards and reports", "chart", C.emerald],
  ];
  O.forEach(([t, ic, col], i) => {
    const x = 0.6 + (i % 2) * 6.1;
    const y = 2.9 + Math.floor(i / 2) * 1.3;
    card(s, x, y, 5.9, 1.1);
    iconCircle(s, x + 0.25, y + 0.2, 0.7, ic, col);
    text(s, t, {
      x: x + 1.15,
      y: y + 0.2,
      w: 4.6,
      h: 0.7,
      fontSize: 16,
      bold: true,
      color: C.ink,
      valign: "middle",
    });
  });
  notes(
    s,
    `The main objective was to build one shared web system for every department.
  Each specific objective maps to a module you will see in the demo: booking, queues, the Who's Next display, role-based access, digital clinical records, and dashboards and reports. All six were implemented.`,
  );
}

/* ================================================================== */
/* 5. Proposed solution                                                */
/* ================================================================== */
{
  const s = base("Proposed solution: one system, one patient journey", {
    kicker: "Solution",
  });
  const steps = [
    ["Check-in", "Ticket A-014 issued", "users", C.sky],
    ["Triage (optional)", "Vitals & priority", "heart", C.rose],
    ["Consultation", "Notes, diagnosis", "stethoscope", C.brand],
    ["Laboratory", "Results released", "flask", C.violet],
    ["Pharmacy", "Dispensed, visit done", "pill", C.amber],
  ];
  steps.forEach(([t, d, ic, col], i) => {
    const x = 0.6 + i * 2.48;
    s.addShape(pptx.ShapeType.chevron, {
      x,
      y: 1.6,
      w: 2.55,
      h: 1.25,
      fill: { color: col },
      line: { color: col },
    });
    text(s, t, {
      x: x + 0.62,
      y: 1.78,
      w: 1.55,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: C.white,
    });
    text(s, d, {
      x: x + 0.62,
      y: 2.18,
      w: 1.5,
      h: 0.55,
      fontSize: 11,
      color: C.white,
    });
  });
  s.addShape(pptx.ShapeType.curvedUpArrow, {
    x: 6.2,
    y: 2.95,
    w: 2.7,
    h: 0.6,
    fill: { color: C.violet, transparency: 30 },
    line: { color: C.violet, transparency: 30 },
    flipH: true,
  });
  text(s, "Results ready → back to the same clinician, keeping their place", {
    x: 5.3,
    y: 3.55,
    w: 4.6,
    h: 0.3,
    fontSize: 11,
    color: C.violet,
    bold: true,
    align: "center",
  });
  bullets(
    s,
    [
      "Every visit carries a ticket number through every department",
      "Staff press “Call next”: priority first, then arrival order",
      "Reception can send a patient straight to consultation",
      "Lab results and prescriptions move digitally between departments",
      "Patients follow their own position in the portal",
    ],
    { x: 0.6, y: 4.1, w: 6.3, h: 3, fontSize: 15 },
  );
  image(s, shot("12-patient-portal"), { x: 7.2, y: 4.0, w: 5.6, h: 2.9 });
  notes(
    s,
    `Explain the journey with one fictional patient. Reception checks them in and a ticket is issued. A nurse records vitals; this step is optional, because reception can send the patient straight to consultation.
  If the doctor requests lab tests, the patient goes to the lab queue and comes back to the SAME doctor when results are released, keeping their original place in line.
  Finally the pharmacy dispenses and the visit is closed. The patient can follow all of this in the portal (screenshot on the right).`,
  );
}

/* ================================================================== */
/* 6. Methodology                                                      */
/* ================================================================== */
{
  const s = base("Methodology: the Incremental Model", {
    kicker: "Guideline 1 · Methodology",
  });
  text(
    s,
    "The system is delivered in small increments. Each one is designed, built, integrated and tested, then added to the working product.",
    { x: 0.6, y: 1.45, w: 12, h: 0.6, fontSize: 16, color: C.slate },
  );
  const inc = [
    ["1", "Foundation", "Auth, RBAC, data model, seed", C.sky],
    ["2", "Front desk", "Patients, booking, queue, triage", C.brand],
    ["3", "Clinical flow", "Consultation, lab, pharmacy", C.violet],
    ["4", "Portal & insight", "Portal, messages, reports", C.amber],
    ["5", "Hardening", "Walkthrough, fixes, diagrams", C.rose],
  ];
  inc.forEach(([n, t, d, col], i) => {
    const x = 0.6 + i * 2.45;
    const h = 1.3 + i * 0.6;
    const y = 6.7 - h;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 2.3,
      h,
      fill: { color: col },
      line: { color: col },
      rectRadius: 0.08,
    });
    text(s, `INCREMENT ${n}`, {
      x: x + 0.15,
      y: y + 0.12,
      w: 2,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: C.white,
      charSpacing: 1,
    });
    text(s, t, {
      x: x + 0.15,
      y: y + 0.42,
      w: 2.05,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: C.white,
    });
    text(s, d, {
      x: x + 0.15,
      y: y + 0.82,
      w: 2.05,
      h: 0.6,
      fontSize: 11,
      color: C.white,
    });
  });
  const stages = [
    "Requirements & architecture",
    "Design → Build → Integrate → Test (per increment)",
    "System test",
    "Delivery",
  ];
  stages.forEach((t, i) => {
    const y = 2.25 + i * 0.5;
    s.addShape(pptx.ShapeType.ellipse, {
      x: 0.6,
      y: y + 0.04,
      w: 0.3,
      h: 0.3,
      fill: { color: C.brand },
      line: { color: C.brand },
    });
    text(s, String(i + 1), {
      x: 0.6,
      y: y + 0.06,
      w: 0.3,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: C.white,
      align: "center",
    });
    text(s, t, {
      x: 1.05,
      y: y + 0.05,
      w: 6,
      h: 0.35,
      fontSize: 14,
      color: C.ink,
    });
  });
  text(s, "Evidence: Git tags inc-2, inc-3, inc-4 · PROJECT_STATUS.md", {
    x: 7.6,
    y: 2.3,
    w: 5.1,
    h: 0.4,
    fontSize: 12,
    color: C.brandDark,
    bold: true,
    align: "right",
  });
  notes(
    s,
    `Requirements and architecture were agreed once at the start, in our project blueprint. After that, each increment went through its own mini-cycle of design, build, integration and testing, and was added to the working system.
  After every increment we had something that ran and could be demonstrated. The evidence is in Git: each increment is tagged (inc-2, inc-3, inc-4), and PROJECT_STATUS.md tracked progress.`,
  );
}

/* ================================================================== */
/* 7. Justification                                                    */
/* ================================================================== */
{
  const s = base("Why the Incremental Model?", {
    kicker: "Guideline 1 · Methodology",
  });
  const rows = [
    ["", "Waterfall", "Scrum", "Incremental ✓"],
    [
      "Fits a short deadline",
      "✗ testing comes last",
      "✗ sprint overhead",
      "✓ working build each step",
    ],
    ["Working software early", "✗", "✓", "✓"],
    ["Stable requirements", "✓", "built for change", "✓"],
    ["Process overhead", "low", "high (ceremonies)", "low"],
  ];
  s.addTable(
    rows.map((r, i) =>
      r.map((c, j) => ({
        text: c,
        options: {
          bold: i === 0 || j === 0,
          color:
            i === 0
              ? C.white
              : c.startsWith("✓")
                ? C.emerald
                : c.startsWith("✗")
                  ? C.rose
                  : C.slate,
          fill: {
            color:
              i === 0
                ? j === 3
                  ? C.brand
                  : C.slate
                : j === 3
                  ? C.mint
                  : C.white,
          },
          fontSize: 13,
          fontFace: FONT,
        },
      })),
    ),
    {
      x: 0.6,
      y: 1.5,
      w: 7.4,
      colW: [2.2, 1.7, 1.7, 1.8],
      border: { type: "solid", color: C.line, pt: 1 },
      rowH: 0.55,
    },
  );
  const cols = [
    [
      "Advantages",
      C.emerald,
      [
        "Working software after every increment",
        "Risk handled early (queue engine in increment 2)",
        "Easy to track progress",
      ],
    ],
    [
      "Limitations",
      C.rose,
      [
        "Needs a good architecture up front",
        "Integration issues between increments",
        "Less user feedback than Agile",
      ],
    ],
  ];
  cols.forEach(([t, col, items], i) => {
    const y = 1.5 + i * 2.65;
    card(s, 8.4, y, 4.3, 2.4, { accent: col });
    text(s, t, {
      x: 8.7,
      y: y + 0.2,
      w: 3.8,
      h: 0.4,
      fontSize: 17,
      bold: true,
      color: col,
    });
    bullets(s, items, { x: 8.7, y: y + 0.65, w: 3.85, h: 1.7, fontSize: 13 });
  });
  text(
    s,
    "Chosen because of our constraints (stable requirements, a short deadline, a natural dependency chain), not because it is popular.",
    {
      x: 0.6,
      y: 4.6,
      w: 7.4,
      h: 0.9,
      fontSize: 14,
      italic: true,
      color: C.brandDark,
    },
  );
  notes(
    s,
    `Stress that the choice was justified by our constraints, not by popularity.
  Waterfall would have left testing to the end, with nothing working if time ran out. Scrum is designed for changing requirements, and its sprints and ceremonies are too heavy for our timeframe.
  Our requirements were stable and the clinic workflow is a natural chain (registration → appointment → check-in → triage → consultation → lab → pharmacy), so the modules mapped directly onto increments.`,
  );
}

/* ================================================================== */
/* 8. Functional requirements                                          */
/* ================================================================== */
{
  const s = base("Functional requirements", {
    kicker: "Guideline 2 · Requirements",
  });
  const mods = [
    ["Authentication & RBAC", 6, C.indigo],
    ["Users & staff", 3, C.slate],
    ["Patients", 6, C.sky],
    ["Doctor schedules", 4, C.brand],
    ["Appointments", 9, C.orange],
    ["Check-in & queue", 12, C.amber],
    ["Nursing", 6, C.rose],
    ["Consultation", 9, C.brand],
    ["Laboratory", 5, C.violet],
    ["Pharmacy", 6, C.amber],
    ["Messaging", 5, C.pink],
    ["Portal", 4, C.sky],
    ["Reports", 3, C.emerald],
    ["Audit", 2, C.slate],
  ];
  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Requirements",
        labels: mods.map((m) => m[0]),
        values: mods.map((m) => m[1]),
      },
    ],
    {
      x: 0.5,
      y: 1.4,
      w: 6.6,
      h: 5.6,
      barDir: "bar",
      chartColors: mods.map((m) => m[2]),
      showValue: true,
      dataLabelFontSize: 10,
      dataLabelColor: C.slate,
      catAxisLabelFontSize: 11,
      catAxisLabelColor: C.slate,
      valAxisHidden: true,
      valGridLine: { style: "none" },
      catAxisOrientation: "maxMin",
      showLegend: false,
      barGapWidthPct: 40,
      showTitle: true,
      title:
        "80 functional requirements by module (65 must · 12 should · 3 could)",
      titleFontSize: 12,
      titleColor: C.ink,
    },
  );
  const ex = [
    [
      "FR-APT-03",
      "No double-booking of a doctor or patient, enforced by the database itself",
      C.orange,
    ],
    [
      "FR-QUE-06",
      "“Call next” gives each patient to exactly one staff member",
      C.amber,
    ],
    [
      "FR-PHA-04",
      "Never dispense more than prescribed or than the stock allows",
      C.violet,
    ],
  ];
  ex.forEach(([id, d, col], i) => {
    const y = 1.6 + i * 1.75;
    card(s, 7.5, y, 5.2, 1.5, { accent: col });
    text(s, id, {
      x: 7.8,
      y: y + 0.2,
      w: 4.6,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: col,
    });
    text(s, d, {
      x: 7.8,
      y: y + 0.6,
      w: 4.7,
      h: 0.8,
      fontSize: 14,
      color: C.ink,
    });
  });
  notes(
    s,
    `Every requirement has a unique ID: FR, then the module, then a number. FR-APT-03, for example, is appointments requirement 3. Each is prioritised with MoSCoW: 65 Must, 12 Should, 3 Could.
  The chart shows how they are spread across the modules. The three examples on the right are the most important integrity rules, and all three are enforced in the database or with atomic operations, not just in the interface.
  The full specification with all 80 IDs is in the report appendix.`,
  );
}

/* ================================================================== */
/* 9. Non-functional requirements                                      */
/* ================================================================== */
{
  const s = base("Non-functional requirements", {
    kicker: "Guideline 2 · Requirements",
  });
  const N = [
    [
      "Security",
      "lock",
      C.indigo,
      "bcrypt password hashes, httpOnly JWT cookie, server-side role checks, login rate-limit, security headers",
    ],
    [
      "Privacy",
      "shield",
      C.violet,
      "Each role sees only the fields it needs; lab & pharmacy see identifiers only",
    ],
    [
      "Data integrity",
      "database",
      C.brand,
      "Unique indexes, transactions, state machines with conditional updates",
    ],
    [
      "Performance",
      "zap",
      C.amber,
      "Indexed queue queries; screens refresh within 5 s",
    ],
    [
      "Usability",
      "smartphone",
      C.sky,
      "One design system, inline validation, confirmations, responsive layout",
    ],
    [
      "Maintainability",
      "layers",
      C.emerald,
      "Layered code: routes → controllers → services → models",
    ],
  ];
  N.forEach(([t, ic, col, d], i) => {
    const x = 0.6 + (i % 3) * 4.1;
    const y = 1.55 + Math.floor(i / 3) * 2.75;
    card(s, x, y, 3.85, 2.45);
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 3.85,
      h: 0.95,
      fill: { color: col },
      line: { color: col },
    });
    iconCircle(s, x + 0.25, y + 0.15, 0.65, ic, C.ink);
    text(s, t, {
      x: x + 1.05,
      y: y + 0.27,
      w: 2.7,
      h: 0.45,
      fontSize: 18,
      bold: true,
      color: C.white,
    });
    text(s, d, {
      x: x + 0.25,
      y: y + 1.1,
      w: 3.4,
      h: 1.25,
      fontSize: 13,
      color: C.slate,
    });
  });
  notes(
    s,
    `For each one, say HOW it is satisfied, not just what it is.
  Security: passwords are stored only as bcrypt hashes, the session is an httpOnly cookie that JavaScript cannot read, and every API route checks the role on the server.
  Privacy: field-level projections per role. Integrity: unique indexes, transactions and state machines. Performance: queue queries use a compound index. Maintainability: business rules live only in the service layer.`,
  );
}

/* ================================================================== */
/* 10. Domain requirements                                             */
/* ================================================================== */
{
  const s = base("Domain requirements", {
    kicker: "Guideline 2 · Requirements",
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 1.5,
    w: 4.6,
    h: 5.3,
    fill: { color: C.indigo },
    line: { color: C.indigo },
    rectRadius: 0.1,
  });
  iconCircle(s, 1.0, 1.85, 1.1, "shield", "3730A3");
  text(s, "Kenya Data Protection Act, 2019", {
    x: 1.0,
    y: 3.15,
    w: 3.9,
    h: 0.9,
    fontSize: 21,
    bold: true,
    color: C.white,
  });
  text(
    s,
    "Health data is sensitive personal data → access on a need-to-know basis, minimal data per role, appropriate safeguards.",
    { x: 1.0, y: 4.15, w: 3.9, h: 1.4, fontSize: 14, color: "E0E7FF" },
  );
  text(
    s,
    "That is why the display shows tickets only and the admin cannot read clinical notes.",
    {
      x: 1.0,
      y: 5.6,
      w: 3.9,
      h: 1.0,
      fontSize: 13,
      italic: true,
      color: "C7D2FE",
    },
  );
  const D = [
    [
      "Unique patient identification",
      "P-2026-00042 + name & date of birth on every screen",
      C.sky,
    ],
    [
      "Triage priority before arrival order",
      "Emergency → urgent → normal",
      C.rose,
    ],
    [
      "Plausible vital signs",
      "BP 1200 rejected; fever & high BP flagged",
      C.amber,
    ],
    [
      "Prescribing authority",
      "Clinicians prescribe only from an approved list",
      C.brand,
    ],
    [
      "Dispensing limits & allergy warnings",
      "Never more than prescribed; allergies shown",
      C.violet,
    ],
    [
      "Clinical records are never deleted",
      "Finalised notes and results are read-only",
      C.emerald,
    ],
  ];
  D.forEach(([t, d, col], i) => {
    const y = 1.5 + i * 0.9;
    card(s, 5.5, y, 7.2, 0.78, { accent: col });
    text(s, t, {
      x: 5.8,
      y: y + 0.1,
      w: 6.8,
      h: 0.3,
      fontSize: 15,
      bold: true,
      color: C.ink,
    });
    text(s, d, {
      x: 5.8,
      y: y + 0.42,
      w: 6.8,
      h: 0.3,
      fontSize: 12,
      color: C.muted,
    });
  });
  notes(
    s,
    `Domain requirements come from how healthcare works, not from user requests.
  The Kenya Data Protection Act 2019 classifies health data as sensitive personal data. That is why the public display shows only ticket numbers, why lab and pharmacy see identifiers only, and why the administrator manages the system but cannot read clinical notes.
  Other domain rules: triage priority, physiologically possible vital signs, prescribing authority, dispensing limits, allergy warnings, and clinical records that are never deleted.`,
  );
}

/* ================================================================== */
/* 11. Architecture                                                    */
/* ================================================================== */
{
  const s = base("System architecture", { kicker: "Design" });
  const tiers = [
    [
      "Presentation",
      "HTML · Tailwind CSS · JavaScript modules",
      "monitor",
      C.sky,
    ],
    ["Application", "Node.js 22 · Express 5 REST API", "code", C.brand],
    ["Data", "MongoDB Atlas (replica set) · Mongoose", "database", C.violet],
  ];
  tiers.forEach(([t, d, ic, col], i) => {
    const y = 1.55 + i * 1.75;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y,
      w: 5.6,
      h: 1.45,
      fill: { color: col },
      line: { color: col },
      rectRadius: 0.1,
    });
    iconCircle(s, 0.85, y + 0.3, 0.85, ic, C.ink);
    text(s, t, {
      x: 1.95,
      y: y + 0.25,
      w: 4.1,
      h: 0.45,
      fontSize: 19,
      bold: true,
      color: C.white,
    });
    text(s, d, {
      x: 1.95,
      y: y + 0.75,
      w: 4.1,
      h: 0.5,
      fontSize: 13,
      color: C.white,
    });
    if (i < 2)
      s.addShape(pptx.ShapeType.downArrow, {
        x: 3.2,
        y: y + 1.45,
        w: 0.4,
        h: 0.3,
        fill: { color: C.line },
        line: { color: C.line },
      });
  });
  text(
    s,
    "Request pipeline: security headers → authenticate (JWT) → authorize(role) → validate → controller → service",
    {
      x: 0.6,
      y: 6.85,
      w: 12,
      h: 0.35,
      fontSize: 12,
      bold: true,
      color: C.brandDark,
    },
  );
  image(s, diag("architecture"), { x: 6.6, y: 1.45, w: 6.1, h: 5.3 });
  notes(
    s,
    `Three tiers. The browser runs plain HTML and JavaScript modules styled with Tailwind; there is no frontend framework. The Node.js/Express server exposes a REST API, and MongoDB Atlas stores the data.
  Inside the API, requests pass through security headers, authentication, role authorisation and validation before reaching a controller. Business rules live only in the service layer.
  Live updates use polling every 4–5 seconds. That is simpler than WebSockets and adequate for clinic volumes.`,
  );
}

/* ================================================================== */
/* 12. Database design                                                 */
/* ================================================================== */
{
  const s = base("Database design (MongoDB)", { kicker: "Design" });
  const colls = [
    "users",
    "patients",
    "appointments",
    "visits",
    "consultations",
    "labRequests",
    "labTests",
    "prescriptions",
    "medications",
    "conversations",
    "messages",
    "auditLogs",
    "counters",
  ];
  const palette = [
    C.sky,
    C.brand,
    C.orange,
    C.amber,
    C.rose,
    C.violet,
    C.indigo,
    C.pink,
    C.emerald,
    C.sky,
    C.brand,
    C.slate,
    C.muted,
  ];
  colls.forEach((c, i) => {
    const x = 0.6 + (i % 7) * 1.75;
    const y = 1.5 + Math.floor(i / 7) * 0.62;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 1.62,
      h: 0.48,
      fill: { color: palette[i] },
      line: { color: palette[i] },
      rectRadius: 0.2,
    });
    text(s, c, {
      x,
      y: y + 0.11,
      w: 1.62,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: C.white,
      align: "center",
    });
  });
  const two = [
    [
      "EMBEDDED (sub-documents)",
      C.brand,
      "Owned by the parent, bounded, read together",
      [
        "Vitals inside the visit",
        "Stage history inside the visit",
        "Test results inside the lab request",
        "Items inside the prescription",
        "Weekly availability inside the doctor",
      ],
    ],
    [
      "REFERENCED (ObjectId)",
      C.violet,
      "Own lifecycle, unbounded, or different permissions",
      [
        "Patient → visits, appointments",
        "Visit → consultations (clinical data kept separate)",
        "Visit → lab requests, prescription",
        "Prescription item → medication (+ name snapshot)",
        "Conversation → messages",
      ],
    ],
  ];
  two.forEach(([t, col, sub, items], i) => {
    const x = 0.6 + i * 6.15;
    card(s, x, 2.95, 5.95, 3.95);
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 2.95,
      w: 5.95,
      h: 0.6,
      fill: { color: col },
      line: { color: col },
    });
    text(s, t, {
      x: x + 0.3,
      y: 3.08,
      w: 5.4,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: C.white,
    });
    text(s, sub, {
      x: x + 0.3,
      y: 3.7,
      w: 5.4,
      h: 0.35,
      fontSize: 13,
      italic: true,
      color: col,
    });
    bullets(s, items, { x: x + 0.3, y: 4.15, w: 5.4, h: 2.6, fontSize: 14 });
  });
  notes(
    s,
    `We did not copy a relational design into MongoDB. There are 13 collections.
  The key decision: the visit document IS the patient's queue entry. It embeds the current queue state, the vitals and the stage history, so moving a patient between departments is a single atomic update of one document.
  Clinical records (consultations, lab requests, prescriptions) are referenced in separate collections because they have different access rights: reception's queue queries never touch clinical data.`,
  );
}

/* ================================================================== */
/* 13. Data model + integrity                                          */
/* ================================================================== */
{
  const s = base("Data model & integrity", { kicker: "Design" });
  image(s, diag("data-model"), { x: 0.5, y: 1.35, w: 8.4, h: 5.75 });
  const call = [
    [
      "Unique partial indexes",
      "No double-booking, no duplicate queue entry (only active documents count)",
      C.orange,
    ],
    [
      "Multi-document transactions",
      "Check-in, lab request, prescribing and dispensing: all or nothing",
      C.violet,
    ],
    [
      "$jsonSchema validators",
      "The database rejects invalid data, e.g. negative stock",
      C.brand,
    ],
  ];
  call.forEach(([t, d, col], i) => {
    const y = 1.45 + i * 1.9;
    card(s, 9.2, y, 3.55, 1.7, { accent: col });
    text(s, t, {
      x: 9.45,
      y: y + 0.15,
      w: 3.2,
      h: 0.55,
      fontSize: 15,
      bold: true,
      color: col,
    });
    text(s, d, {
      x: 9.45,
      y: y + 0.72,
      w: 3.15,
      h: 0.9,
      fontSize: 12,
      color: C.ink,
    });
  });
  notes(
    s,
    `How to read the diagram: each box is a collection. A filled diamond means an embedded sub-document; an arrow is a reference by ObjectId, with cardinalities.
  Integrity: the unique partial index on doctorId plus startAt only counts active appointments, so a cancelled slot can be booked again, but two active bookings at the same time are impossible. The same idea stops a patient from being in the queue twice.
  Transactions make multi-document changes all-or-nothing, and schema validators are the last line of defence, even against edits made directly in the database.`,
  );
}

/* ================================================================== */
/* 14-16. UML                                                          */
/* ================================================================== */
{
  const s = base("Use-case diagram", { kicker: "Guideline 3 · UML" });
  image(s, diag("use-case"), { x: 0.5, y: 1.3, w: 7.6, h: 5.85 });
  const pts = [
    [
      "9 actors",
      "Admin, Receptionist, Patient, Nurse, Clinician, Doctor, Lab Technician, Pharmacist, public display",
      C.sky,
    ],
    [
      "Generalisation",
      "Doctor inherits every Clinician use case, plus booked appointments and unrestricted prescribing",
      C.brand,
    ],
    [
      "«include»",
      "“Call next patient” is shared by triage, consultation, lab and pharmacy",
      C.violet,
    ],
    [
      "«extend»",
      "“Create portal access” optionally extends patient registration",
      C.amber,
    ],
  ];
  pts.forEach(([t, d, col], i) => {
    const y = 1.4 + i * 1.42;
    card(s, 8.5, y, 4.25, 1.25, { accent: col });
    text(s, t, {
      x: 8.75,
      y: y + 0.12,
      w: 3.9,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: col,
    });
    text(s, d, {
      x: 8.75,
      y: y + 0.48,
      w: 3.9,
      h: 0.75,
      fontSize: 12,
      color: C.ink,
    });
  });
  notes(
    s,
    `Stick figures are actors and ovals are use cases inside the system boundary.
  Generalisation: the Doctor inherits all Clinician use cases and adds booked appointments and unrestricted prescribing. This is how we avoided duplicating the consultation module.
  «include» marks mandatory shared behaviour: every department uses "Call next patient". «extend» marks optional behaviour: creating portal access when registering a patient.`,
  );
}
{
  const s = base("Sequence diagram: consultation → laboratory → consultation", {
    kicker: "Guideline 3 · UML",
  });
  image(s, diag("seq-consultation-lab"), { x: 0.5, y: 1.3, w: 9.3, h: 5.85 });
  bullets(
    s,
    [
      "Time flows downward; each arrow is a message",
      "“group transaction” blocks are all-or-nothing",
      "Results return the patient to the SAME clinician",
      "Four more sequence diagrams are in the report",
    ],
    { x: 10.0, y: 1.5, w: 2.9, h: 5, fontSize: 13 },
  );
  notes(
    s,
    `Read the diagram top to bottom. Time flows downward and each arrow is a message between objects.
  The clinician requests tests. In one transaction the lab request is created and the patient is moved to the lab queue. The lab technician records the sample and releases results; again in one transaction, the patient returns to the requesting clinician's queue, flagged "Results ready".
  The report contains four more sequence diagrams: registration and booking, check-in and queue, triage, and prescribing and dispensing.`,
  );
}
{
  const s = base(
    "Interaction diagram: communication diagram for “Call next patient”",
    { kicker: "Guideline 3 · UML" },
  );
  image(s, diag("comm-call-next"), { x: 0.5, y: 1.5, w: 12.3, h: 2.4 });
  card(s, 0.6, 4.3, 5.95, 2.6, { accent: C.brand });
  text(s, "Communication vs sequence diagram", {
    x: 0.9,
    y: 4.45,
    w: 5.5,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: C.brand,
  });
  text(
    s,
    "Both are UML interaction diagrams. A sequence diagram emphasises time order; a communication diagram emphasises which objects are linked, with numbered messages (1, 2, 3…).",
    { x: 0.9, y: 4.95, w: 5.5, h: 1.8, fontSize: 13, color: C.ink },
  );
  card(s, 6.75, 4.3, 5.95, 2.6, { accent: C.violet });
  text(s, "What it shows", {
    x: 7.05,
    y: 4.45,
    w: 5.5,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: C.violet,
  });
  bullets(
    s,
    [
      "Request passes the auth and role checks first",
      "Service performs ONE atomic findOneAndUpdate",
      "Display polls the public endpoint separately",
      "Second diagram (dispensing) in the report",
    ],
    { x: 7.05, y: 4.95, w: 5.5, h: 1.9, fontSize: 13 },
  );
  notes(
    s,
    `A communication diagram shows the same kind of interaction as a sequence diagram, but focuses on which objects collaborate rather than on timing. The numbers give the order.
  Follow 1 to 10: the staff member clicks Call next; the request passes authentication and authorisation; the controller calls the queue service, which performs one atomic update on the visits collection; the result returns to the screen. Message 11 is the public display polling for tickets.`,
  );
}

/* ================================================================== */
/* 17. CASE tools                                                      */
/* ================================================================== */
{
  const s = base("CASE tools", { kicker: "Guideline 4 · CASE tools" });
  const T = [
    [
      "Planning",
      "PROJECT_STATUS.md + Git",
      "Tracked increments, tasks and bugs",
      "file",
      C.slate,
    ],
    [
      "Design",
      "PlantUML",
      "All UML diagrams as version-controlled code",
      "layers",
      C.violet,
    ],
    [
      "Coding",
      "Visual Studio Code (IDE)",
      "Code and design implementations in JS",
      "bot",
      C.indigo,
    ],
    [
      "Database",
      "MongoDB Atlas",
      "Hosted replica set, collections, indexes",
      "database",
      C.emerald,
    ],
    [
      "Build",
      "npm · Tailwind CLI",
      "Dependencies and CSS build",
      "package",
      C.orange,
    ],
    [
      "Version control",
      "Git & GitHub",
      "History, increment tags, collaboration",
      "git",
      C.rose,
    ],
    [
      "Testing",
      "node:test + Supertest",
      "46 automated API tests",
      "test",
      C.brand,
    ],
    [
      "Documents",
      "pptxgenjs · docx",
      "This deck and the report generated from scripts",
      "file",
      C.sky,
    ],
  ];
  T.forEach(([cat, name, d, ic, col], i) => {
    const x = 0.6 + (i % 4) * 3.07;
    const y = 1.5 + Math.floor(i / 4) * 2.75;
    card(s, x, y, 2.9, 2.5);
    iconCircle(s, x + 0.25, y + 0.25, 0.75, ic, col);
    text(s, cat.toUpperCase(), {
      x: x + 1.15,
      y: y + 0.35,
      w: 1.7,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: col,
      charSpacing: 1,
    });
    text(s, name, {
      x: x + 0.25,
      y: y + 1.1,
      w: 2.5,
      h: 0.6,
      fontSize: 14,
      bold: true,
      color: C.ink,
      valign: "top",
    });
    text(s, d, {
      x: x + 0.25,
      y: y + 1.75,
      w: 2.5,
      h: 0.7,
      fontSize: 11,
      color: C.muted,
    });
  });
  notes(
    s,
    `Only tools we can show evidence for are listed. For each: what it is, what we used it for, and the evidence.
  Git and GitHub: commit history and increment tags. PlantUML: the .puml files in docs/diagrams. MongoDB Atlas: the hosted database. node:test and Supertest: 46 automated API tests (show the test run). Claude Code: AI assistance, honestly logged in CLAUDE-ASSISTANCE.md.
  If group members also used VS Code or MongoDB Compass, add them here with a screenshot as evidence; otherwise do not claim them.`,
  );
}

/* ================================================================== */
/* 18. Implemented modules                                             */
/* ================================================================== */
{
  const s = base("Implemented modules", { kicker: "Implementation" });
  const M = [
    ["Login & role-based access", "lock", C.indigo],
    ["Staff accounts & schedules", "users", C.slate],
    ["Patient registration", "user", C.sky],
    ["Appointment booking", "calendar", C.orange],
    ["Check-in & queues", "queue", C.amber],
    ["“Who’s Next” display", "monitor", C.brand],
    ["Nurse triage & vitals", "heart", C.rose],
    ["Consultation", "stethoscope", C.brand],
    ["Laboratory", "flask", C.violet],
    ["Pharmacy & stock", "pill", C.amber],
    ["Patient portal", "smartphone", C.sky],
    ["Messaging", "message", C.pink],
    ["Reports", "chart", C.emerald],
    ["Activity log", "file", C.slate],
  ];
  M.forEach(([t, ic, col], i) => {
    const x = 0.6 + (i % 7) * 1.75;
    const y = 1.4 + Math.floor(i / 7) * 1.35;
    card(s, x, y, 1.62, 1.2);
    iconCircle(s, x + 0.14, y + 0.14, 0.5, ic, col);
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 1.24,
      y: y + 0.1,
      w: 0.28,
      h: 0.28,
      fill: { color: C.emerald },
      line: { color: C.emerald },
    });
    s.addImage({
      data: icon("check"),
      x: x + 1.29,
      y: y + 0.15,
      w: 0.18,
      h: 0.18,
    });
    text(s, t, {
      x: x + 0.14,
      y: y + 0.7,
      w: 1.42,
      h: 0.45,
      fontSize: 10,
      bold: true,
      color: C.ink,
    });
  });
  // Live figures from the Reports module (synthetic demo data, last 14 days).
  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Visits",
        labels: report.daily.map(
          (d) => d.date.slice(8) + "/" + d.date.slice(5, 7),
        ),
        values: report.daily.map((d) => d.visits),
      },
    ],
    {
      x: 0.5,
      y: 4.2,
      w: 6.3,
      h: 2.75,
      chartColors: [C.brand],
      showValue: true,
      dataLabelFontSize: 9,
      catAxisLabelFontSize: 9,
      valAxisHidden: true,
      valGridLine: { style: "none" },
      showLegend: false,
      showTitle: true,
      title: "Visits per day (Reports module, synthetic data)",
      titleFontSize: 12,
    },
  );
  const stg = ["triage", "consultation", "lab", "pharmacy"];
  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Avg. wait (min)",
        labels: ["Triage", "Consultation", "Laboratory", "Pharmacy"],
        values: stg.map((k) => report.stages[k]?.avgWait || 0),
      },
      {
        name: "Avg. service (min)",
        labels: ["Triage", "Consultation", "Laboratory", "Pharmacy"],
        values: stg.map((k) => report.stages[k]?.avgService || 0),
      },
    ],
    {
      x: 6.95,
      y: 4.2,
      w: 5.9,
      h: 2.75,
      chartColors: [C.amber, C.violet],
      showValue: true,
      dataLabelFontSize: 9,
      catAxisLabelFontSize: 10,
      valAxisHidden: true,
      valGridLine: { style: "none" },
      showLegend: true,
      legendPos: "b",
      legendFontSize: 10,
      showTitle: true,
      title: "Waiting vs service time per department",
      titleFontSize: 12,
    },
  );
  text(
    s,
    "14 modules · 13 collections · ~8,200 lines of code · 46 tests. Not yet built: one-step reschedule, CSV export, lab-request cancel, note addenda, SMS",
    {
      x: 0.6,
      y: 6.98,
      w: 9.4,
      h: 0.3,
      fontSize: 10,
      color: C.muted,
      align: "left",
    },
  );
  notes(
    s,
    `Every module shown with a green tick is implemented and working; you will see them in the demo.
  Be honest about what is not implemented: one-step rescheduling, CSV export of reports, cancelling a lab request, addenda to finalised notes, and SMS notifications are future work. The phone-size layout was designed to be responsive but has not been formally tested on a phone. Lecturers reward accuracy.`,
  );
}

/* ================================================================== */
/* 19-20. Screenshots                                                  */
/* ================================================================== */
{
  const s = base("Screenshots: front desk", { kicker: "Implementation" });
  const g = [
    ["01-reception-dashboard", "Reception dashboard"],
    ["02-booking-slots", "Booking with a free-slot grid"],
    ["03-queue-board", "Live queue board"],
    ["04-whos-next-display", "“Who’s Next” display (tickets only)"],
  ];
  g.forEach(([f, cap], i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 1.4 + Math.floor(i / 2) * 2.95;
    image(s, shot(f), { x, y, w: 5.95, h: 2.45 });
    caption(s, cap, x, y + 2.5, 5.95);
  });
  notes(
    s,
    `One sentence per screenshot. Reception sees today's appointments and live queues at a glance. Booking shows only free slots; taken or past slots are crossed out. The queue board refreshes every 5 seconds. The public display shows ticket numbers only, for privacy.`,
  );
}
{
  const s = base("Screenshots: clinical departments", {
    kicker: "Implementation",
  });
  const g = [
    ["06-triage-vitals-flags", "Nurse: vitals with abnormal flags"],
    ["09-consultation-results-ready", "Doctor: lab results returned"],
    ["08-lab-results-entry", "Lab: results entry"],
    ["11-pharmacy-dispensing", "Pharmacy: dispensing with stock"],
  ];
  g.forEach(([f, cap], i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 1.4 + Math.floor(i / 2) * 2.95;
    image(s, shot(f), { x, y, w: 5.95, h: 2.45 });
    caption(s, cap, x, y + 2.5, 5.95);
  });
  notes(
    s,
    `Each role has its own workspace and sees only its own tools.
  The nurse's vitals are checked (impossible values rejected) and abnormal values are flagged in red. The doctor sees the lab results when the patient returns. The lab technician enters results with flags. The pharmacist sees stock levels before dispensing.`,
  );
}

/* ================================================================== */
/* 21. Code snippet                                                    */
/* ================================================================== */
{
  const s = base("Code snippet: “Call next patient”", {
    kicker: "Guideline 5 · Code",
  });
  const code = [
    ["// src/services/queue.service.js — Queue Management module", "94A3B8"],
    ["export async function callNext(stage, actor) {", "E2E8F0"],
    [
      "  const filter = { stage, queueStatus: 'waiting', isActive: true };",
      "5EEAD4",
    ],
    ["  if (stage === 'consultation')", "E2E8F0"],
    ["    filter.assignedTo = { $in: [actor._id, null] };", "5EEAD4"],
    ["", "E2E8F0"],
    ["  const visit = await Visit.findOneAndUpdate(", "E2E8F0"],
    ["    filter,", "E2E8F0"],
    ["    { $set: { queueStatus: 'called', calledBy: actor._id,", "FCD34D"],
    [
      "              calledAt: new Date(), room: actor.staffProfile?.room } },",
      "FCD34D",
    ],
    ["    { sort: { priorityRank: 1, queueTime: 1 },", "C4B5FD"],
    ["      returnDocument: 'after' },", "E2E8F0"],
    ["  );", "E2E8F0"],
    ["  return visit;   // null = nobody waiting", "E2E8F0"],
    ["}", "E2E8F0"],
  ];
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 1.45,
    w: 7.9,
    h: 5.25,
    fill: { color: "0F172A" },
    line: { color: "0F172A" },
    rectRadius: 0.08,
  });
  s.addText(
    code.map(([t, col]) => ({
      text: t || " ",
      options: { color: col, breakLine: true },
    })),
    {
      x: 0.85,
      y: 1.7,
      w: 7.5,
      h: 4.9,
      fontFace: "Consolas",
      fontSize: 15,
      valign: "top",
      margin: 0,
      lineSpacingMultiple: 1.1,
    },
  );
  const marks = [
    [
      "1",
      "Filter",
      "Only patients still WAITING at this stage (for consultation: assigned to me, or the general pool)",
      C.brand,
      2.25,
    ],
    [
      "2",
      "Atomic update",
      "Match + change happen as ONE operation on ONE document, so two staff can never get the same patient",
      C.amber,
      3.95,
    ],
    [
      "3",
      "Sort",
      "Emergency → urgent → normal, then queue time: triage rules in one line",
      C.violet,
      5.35,
    ],
  ];
  marks.forEach(([n, t, d, col, y]) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: 8.75,
      y,
      w: 0.55,
      h: 0.55,
      fill: { color: col },
      line: { color: col },
    });
    text(s, n, {
      x: 8.75,
      y: y + 0.1,
      w: 0.55,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: C.white,
      align: "center",
    });
    text(s, t, {
      x: 9.45,
      y: y - 0.02,
      w: 3.3,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: col,
    });
    text(s, d, {
      x: 9.45,
      y: y + 0.35,
      w: 3.3,
      h: 0.95,
      fontSize: 12,
      color: C.ink,
    });
  });
  text(
    s,
    "Simplified for the slide (busy-check and stage-history timestamp omitted); full version in the report.",
    {
      x: 0.6,
      y: 6.9,
      w: 12,
      h: 0.3,
      fontSize: 10,
      italic: true,
      color: C.muted,
    },
  );
  notes(
    s,
    `This function belongs to the Queue Management module and is the heart of the system.
  1. The filter selects only patients still waiting at this stage. 2. findOneAndUpdate is atomic: finding the patient and marking them "called by me" is one operation on one document, so if two doctors click "Call next" at the same moment, each gets a different patient (we test this). 3. The sort implements triage priority: emergencies first, then by queue time.
  If the queue is empty it returns null, and the screen says "No patients are waiting" instead of crashing.`,
  );
}

/* ================================================================== */
/* 22. Possible errors                                                 */
/* ================================================================== */
{
  const s = base("Possible errors and how we handle them", {
    kicker: "Guideline 5 · Errors",
  });
  const rows = [
    ["Type", "Example in our system", "Detection / prevention"],
    [
      "Syntax",
      "Missing bracket in a service file",
      "Server fails to start; node --check before running",
    ],
    [
      "Runtime",
      "Empty queue → visit is null",
      "Null check → “No patients are waiting”",
    ],
    [
      "Logical",
      "Sort by newest first → latest patient served first",
      "Automated priority-order test",
    ],
    [
      "Database",
      "Duplicate key when a patient is checked in twice",
      "Unique index → friendly 409 message",
    ],
    [
      "Integration",
      "Booking grid showed the wrong day (race condition)",
      "Found in testing: ignore stale responses",
    ],
    [
      "Validation",
      "Blood pressure 1200 entered",
      "Server range rules → 422 with field error",
    ],
    [
      "Security",
      "Pharmacist opens a consultation; NoSQL injection at login",
      "Role check → 403; $-keys rejected → 400",
    ],
  ];
  const tone = [
    C.slate,
    C.sky,
    C.rose,
    C.amber,
    C.violet,
    C.orange,
    C.brand,
    C.indigo,
  ];
  s.addTable(
    rows.map((r, i) =>
      r.map((c, j) => ({
        text: c,
        options: {
          bold: i === 0 || j === 0,
          fontSize: 13,
          fontFace: FONT,
          color: i === 0 || j === 0 ? C.white : C.ink,
          fill: {
            color:
              i === 0 ? C.ink : j === 0 ? tone[i] : i % 2 ? C.white : "F8FAFC",
          },
        },
      })),
    ),
    {
      x: 0.6,
      y: 1.45,
      w: 12.1,
      colW: [1.7, 5.2, 5.2],
      rowH: 0.62,
      border: { type: "solid", color: C.line, pt: 1 },
    },
  );
  notes(
    s,
    `Pick two errors and tell them as short stories.
  Integration: during our browser walkthrough the booking dialog showed slots for Wednesday while the date box said Tuesday. Changing the doctor and then the date quickly fired two requests, and the older one arrived last. We fixed it by ignoring responses that are no longer the latest. This is a real race condition we found and fixed.
  Database: checking in a patient who is already in the queue hits the unique index; the server translates the duplicate-key error into a clear 409 message instead of a crash.`,
  );
}

/* ================================================================== */
/* 23. Testing                                                         */
/* ================================================================== */
{
  const s = base("Testing & results", { kicker: "Testing" });
  const big = [
    ["46 / 46", "automated API tests pass", C.emerald],
    ["4", "test suites, each on a fresh test database", C.sky],
    ["1", "full multi-role browser walkthrough", C.violet],
  ];
  big.forEach(([n, d, col], i) => {
    const y = 1.45 + i * 1.55;
    card(s, 0.6, y, 4.2, 1.35, { accent: col });
    text(s, n, {
      x: 0.9,
      y: y + 0.15,
      w: 3.8,
      h: 0.65,
      fontSize: 32,
      bold: true,
      color: col,
    });
    text(s, d, {
      x: 0.9,
      y: y + 0.82,
      w: 3.8,
      h: 0.4,
      fontSize: 13,
      color: C.ink,
    });
  });
  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Tests",
        labels: [
          "Auth, patients & appointments",
          "Check-in & queue",
          "Consultation, lab & pharmacy",
          "Portal, messages & reports",
        ],
        values: [16, 11, 10, 9],
      },
    ],
    {
      x: 5.1,
      y: 1.4,
      w: 7.7,
      h: 2.8,
      barDir: "bar",
      chartColors: [C.sky, C.amber, C.violet, C.brand],
      showValue: true,
      dataLabelFontSize: 11,
      catAxisLabelFontSize: 11,
      valAxisHidden: true,
      valGridLine: { style: "none" },
      catAxisOrientation: "maxMin",
      showLegend: false,
      showTitle: true,
      title: "Automated tests per area",
      titleFontSize: 12,
    },
  );
  const cases = [
    "Two bookings for the same slot at the same moment → exactly one succeeds",
    "Two nurses press “Call next” together → different patients",
    "Wrong role → 403 on every protected route",
    "Over-dispensing and insufficient stock → whole transaction rolled back",
    "Lab results return the patient to the same clinician",
  ];
  card(s, 5.1, 4.4, 7.7, 2.5);
  text(s, "Key test cases", {
    x: 5.35,
    y: 4.5,
    w: 7,
    h: 0.35,
    fontSize: 15,
    bold: true,
    color: C.ink,
  });
  bullets(s, cases, { x: 5.35, y: 4.9, w: 7.3, h: 2, fontSize: 12 });
  notes(
    s,
    `Report only real numbers. We have 46 automated API tests in four suites, written with Node's built-in test runner and Supertest. Each suite starts from a freshly seeded test database. All 46 pass.
  They cover the hard cases: simultaneous double-booking, two staff calling at the same time, role permissions, and transactions rolling back. We also did a full walkthrough in the browser for every role, which found and fixed five interface bugs.
  Known limitation: the phone-size layout has not been formally tested.`,
  );
}

/* ================================================================== */
/* 24. Conclusion                                                      */
/* ================================================================== */
{
  const s = base("Conclusion & recommendations", { kicker: "Conclusion" });
  const cols = [
    [
      "Achieved",
      C.emerald,
      "check",
      [
        "All 6 objectives implemented and tested",
        "Every patient tracked across 5 departments",
        "Concurrency-safe queues and bookings",
        "Privacy by role, as the Data Protection Act requires",
        "Reports on waiting time per department",
      ],
    ],
    [
      "Limitations",
      C.amber,
      "alert",
      [
        "Single clinic, single branch",
        "In-app messages only (no SMS)",
        "Screens refresh by polling (4–5 s)",
        "No billing / insurance",
        "Phone layout not formally tested",
      ],
    ],
    [
      "Future work",
      C.violet,
      "zap",
      [
        "SMS / WhatsApp “you are next” alerts",
        "WebSockets for instant updates",
        "Billing and SHA insurance integration",
        "Multi-branch support",
        "HL7 / FHIR data exchange",
      ],
    ],
  ];
  cols.forEach(([t, col, ic, items], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.45, 3.9, 5.45);
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 1.45,
      w: 3.9,
      h: 1.0,
      fill: { color: col },
      line: { color: col },
    });
    iconCircle(s, x + 0.25, y0(1.45) + 0.15, 0.7, ic, C.ink);
    text(s, t, {
      x: x + 1.1,
      y: 1.72,
      w: 2.7,
      h: 0.45,
      fontSize: 20,
      bold: true,
      color: C.white,
    });
    bullets(s, items, { x: x + 0.25, y: 2.65, w: 3.5, h: 4.1, fontSize: 14 });
  });
  notes(
    s,
    `Tie each achievement back to a problem from slide 3: waiting times are now visible and measured, double-booking is impossible, patients are tracked across departments, and lab results and prescriptions travel digitally.
  Be clear about the limitations, then recommend future work: SMS notifications, WebSockets for real-time updates, billing and SHA integration, multi-branch support, and HL7/FHIR interoperability.`,
  );
}
function y0(v) {
  return v;
}

/* ================================================================== */
/* 25. Live demo                                                       */
/* ================================================================== */
{
  const s = base("Live demonstration", { kicker: "Demo" });
  const steps = [
    [
      "Reception checks in a booked patient",
      "Ticket appears on “Who’s Next”",
      "users",
      C.sky,
    ],
    [
      "Nurse calls & records vitals",
      "Abnormal values flagged",
      "heart",
      C.rose,
    ],
    [
      "Doctor requests lab tests",
      "Patient moves to the lab queue",
      "stethoscope",
      C.brand,
    ],
    [
      "Lab technician releases results",
      "Back to the same doctor",
      "flask",
      C.violet,
    ],
    ["Doctor prescribes", "Allergy check, sent to pharmacy", "file", C.orange],
    ["Pharmacist dispenses", "Stock reduced, visit complete", "pill", C.amber],
    [
      "Patient portal & reports",
      "Queue position, waiting times",
      "chart",
      C.emerald,
    ],
  ];
  steps.forEach(([t, d, ic, col], i) => {
    const x = 0.6 + (i % 4) * 3.07;
    const y = 1.5 + Math.floor(i / 4) * 2.7;
    card(s, x, y, 2.9, 2.4);
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.2,
      y: y + 0.2,
      w: 0.5,
      h: 0.5,
      fill: { color: C.ink },
      line: { color: C.ink },
    });
    text(s, String(i + 1), {
      x: x + 0.2,
      y: y + 0.28,
      w: 0.5,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: C.white,
      align: "center",
    });
    iconCircle(s, x + 2.0, y + 0.2, 0.7, ic, col);
    text(s, t, {
      x: x + 0.2,
      y: y + 1.0,
      w: 2.55,
      h: 0.75,
      fontSize: 14,
      bold: true,
      color: C.ink,
    });
    text(s, d, {
      x: x + 0.2,
      y: y + 1.75,
      w: 2.55,
      h: 0.5,
      fontSize: 12,
      color: C.muted,
    });
  });
  text(s, "Synthetic demo data · one browser profile per role", {
    x: 9.85,
    y: 5.4,
    w: 2.9,
    h: 1.0,
    fontSize: 13,
    italic: true,
    color: C.brandDark,
    valign: "middle",
  });
  notes(
    s,
    `Before the presentation: run "npm run seed" for fresh synthetic data, start the server, and open one browser profile (or window) per role, already logged in, plus the Who's Next display on a second screen if possible.
  Follow the seven steps on the slide. Rehearse at least twice, and keep a recorded backup video in case of network or database problems.`,
  );
}

/* ================================================================== */
/* 26-27. Thank you + Q&A                                              */
/* ================================================================== */
{
  const s = base("", { dark: true });
  s.addShape(pptx.ShapeType.ellipse, {
    x: 8.5,
    y: -2,
    w: 7,
    h: 7,
    fill: { color: C.brand, transparency: 50 },
    line: { color: C.brand, transparency: 50 },
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: -2,
    y: 4.5,
    w: 5,
    h: 5,
    fill: { color: C.brandDark },
    line: { color: C.brandDark },
  });
  iconCircle(s, 0.9, 1.4, 1.1, "heart", C.brand);
  text(s, "Thank you", {
    x: 0.9,
    y: 2.8,
    w: 10,
    h: 1.2,
    fontSize: 54,
    bold: true,
    color: C.white,
  });
  text(s, "CareQueue Clinic: Clinic Queue & Appointment Management System", {
    x: 0.9,
    y: 4.0,
    w: 10,
    h: 0.5,
    fontSize: 18,
    color: C.mint2,
  });
  text(s, "github.com/charbelngeti/clinic-queue-management-system", {
    x: 0.9,
    y: 4.7,
    w: 10,
    h: 0.4,
    fontSize: 15,
    color: C.white,
  });
  notes(s, "Thank the lecturer and the audience.");
}
{
  const s = base("", { dark: true });
  s.addShape(pptx.ShapeType.ellipse, {
    x: 4.4,
    y: 1.2,
    w: 4.5,
    h: 4.5,
    fill: { color: C.brand },
    line: { color: C.brand },
  });
  text(s, "?", {
    x: 4.4,
    y: 1.75,
    w: 4.5,
    h: 3.2,
    fontSize: 160,
    bold: true,
    color: C.white,
    align: "center",
  });
  text(s, "Questions & answers", {
    x: 0,
    y: 5.95,
    w: W,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: C.white,
    align: "center",
  });
  notes(
    s,
    `The moderator routes each question to the section owner. Likely questions:
  1. Why MongoDB and not MySQL? Clinical data is nested (vitals, results, prescription items). MongoDB still gives integrity through unique indexes, schema validators and ACID transactions; we designed around access patterns.
  2. How do you stop two doctors calling the same patient? An atomic findOneAndUpdate that only matches a patient still "waiting".
  3. How do you prevent double-booking? A unique partial index on doctor + start time for active appointments; the database rejects the second booking.
  4. What if the server crashes mid-dispensing? It is one transaction: stock, prescription and visit all commit or none do.
  5. Why Incremental and not Scrum? Stable requirements and a very short timeframe.
  6. Functional vs non-functional vs domain requirements? What the system does / how well it does it / constraints from healthcare itself.
  7. Why can't the admin read clinical notes? Need-to-know under the Kenya Data Protection Act 2019.
  8. Doctor vs clinician? Same module; doctors also have bookable schedules and unrestricted prescribing (generalisation).
  9. Sequence vs communication diagram? Both interaction diagrams: time order vs object links.
  10. How are passwords stored? bcrypt hashes; the session is an httpOnly cookie.
  11. How do the diagrams match the code? Drawn from the implemented code using the real endpoints and functions.
  12. Is it real-time? Near real-time polling every 4–5 s; WebSockets are future work.
  13. Did you use AI? Yes, Claude Code, documented in CLAUDE-ASSISTANCE.md; the group reviewed, tested and is accountable for the work.`,
  );
}

await pptx.writeFile({ fileName: OUT });
console.log(
  `Wrote ${path.relative(ROOT, OUT)} (${slideNo} slides). Report data: ${report.visits.total} visits in 14 days.`,
);
