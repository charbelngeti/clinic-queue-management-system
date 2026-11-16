# PROJECT STATUS

**Deadline:** Fri 20 Nov 2026, for the code, the report (Word, ~15 pages, max 20, appendices excluded) and the presentation (PowerPoint; ~30 min talk + 10 min demo + 20 min Q&A)
**Last updated:** Mon 16 Nov 2026 (afternoon)
**Current phase:** Implementation. Increments 1–4 are done and verified; Increment 5 (hardening) and the academic deliverables are next.

## Group (9 members)
| Name | Adm. No. |
|---|---|
| Charbel Ngeti | 221441 |
| Adelight Naino | 220702 |
| Abigael Wambui | 193891 |
| Alvin Otanga | 220267 |
| Ajani M'maitsi | 186452 |
| Nathaniel Lado | 178626 |
| Evans Kima | 212539 |
| Faith Wanjira | 220506 |
| Matthew Mwachi | 189603 |

## Workstream A: Application Development

| Increment | Scope | Status |
|---|---|---|
| 1 Foundation | Scaffold, Tailwind, Mongoose models (13 collections), `$jsonSchema` validators, indexes, seed data, auth (JWT cookie), RBAC, app shell, admin staff accounts | ✅ Done, tested |
| 2 Front desk | Patients (register, search, duplicate warning, edit, portal accounts), doctor schedules (admin), appointments (slot booking, cancel, no-show), check-in (triage or straight to consultation), queue engine (call next / skip / recall / re-queue / move between stages), queue board, "Who's Next" display, nurse triage (vitals, flags, priority, send to consultation) | ✅ Done; API tested; browser-checked: dashboard, check-in, queue board, triage, display |
| 3 Clinical flow | Consultation workspace (doctor + clinician: note, vitals, history, results), lab requests → lab workspace (sample, results, release → back to the same clinician), prescriptions with allergy warning and clinician restrictions, referral, discharge, pharmacy dispensing with transactional stock control, medications & stock (receive stock; admin formulary), lab/prescription daily records | ✅ Done; API tested; full walk-through checked in a browser |
| 4 Portal, messaging & insight | Patient portal (live ticket and position, journey steps, book, cancel ≥ 2 h before, appointment history), messaging with reception as shared desk (unread badges), admin reports (visits per day, wait/service time per department, no-show rate, lab turnaround, top medications), activity (audit) log viewer, personal stats strip in every department workspace, seed with 14 days of synthetic history | ✅ Done; API tested; checked in a browser (reports, portal, messages) |
| 5 Hardening | Browser walkthrough of every role (screenshots taken); fixed: booking slot race condition, lab table overflow, cramped consultation layout, fading TV display highlight, misleading dashboard label | 🔶 In progress. **Not verified:** phone-width layout (browser window could not be resized) |

### Automated tests
`npm test`: 46 API tests, **all passing** (16 Nov). They cover the patient portal (own queue position, staff-only endpoints blocked, 2-hour cancellation rule), messaging rules (shared reception desk, no cross-reading, admin excluded), reports and audit access, the clinical round trip (consultation → lab → same clinician → pharmacy), allergy acknowledgement, clinician prescribing limits, referral, the dispensing transaction rolling back on insufficient stock, over-dispensing, auth, RBAC (403s), NoSQL injection, duplicate patients, double-booking including a simultaneous race, patient IDOR, cancel rules, duplicate queue entries, concurrent "call next", priority ordering, vitals validation and flags, and privacy of the board and display.

### Known issues
- None open. Fixed during development:
  - Tailwind v4 `@apply` of a custom class.
  - Mongoose auto-creating collections before validators were set (Atlas `readWrite` role can't run `collMod`).
  - Global `sanitizeFilter` would have broken legitimate `$in` queries.
  - BOM added to `package.json` by PowerShell.
  - Triage header not refreshing after vitals were saved.
  - Department workspace not drawing its empty state on first load.
  - Nav highlighting two items on nested routes.
  - Lab test lookup returning at most 25 rows broke one test (test fixed).
  - Report no-show hint used the wrong denominator.
  - Stale dev-server processes kept serving old code on port 3000 (stopped).
  - **Race condition in booking dialog:** changing doctor then date quickly fired two slot requests; the older response arrived last and showed slots for the wrong day. Fixed by ignoring stale responses (good real example for the error-analysis section).
  - Lab results table overflowed the page horizontally (CSS grid min-width); fixed with min-w-0.

## Workstream B: Academic Deliverables
### Completed
- **PowerPoint:** `docs/presentation/CareQueue-Presentation.pptx`, 27 slides with icons, native charts (live report data), diagrams, screenshots and speaker notes; regenerate with `npm run docs:slides`. Fill in course name/code and lecturer on slide 1.
- **Word report:** `docs/report/CareQueue-Project-Report.docx`, 32 pages (main body pp. 4–18, then appendices A–E); regenerate with `npm run docs:report` (then update the table of contents in Word: right-click → Update field). Fill in course name/code and lecturer on the title page.
- UML diagrams (PlantUML sources in `docs/diagrams/`, PNGs in `docs/diagrams/rendered/`, `npm run diagrams`): use-case; 5 sequence diagrams (registration & booking, check-in & queue, triage, consultation & lab, prescription & dispensing); 2 communication diagrams (call next, dispense); state machines (visit, appointment, lab request); data model; architecture
- 18 application screenshots in `docs/screenshots/`
- Blueprint v0.3 (`docs/BLUEPRINT.md`)
- Slide outline v0.2 (`docs/presentation/SLIDE_OUTLINE.md`): 9 presenters, timings, Q&A. **Awaiting group review.**

### Outstanding
- CASE tools evidence (screenshots: Atlas/Compass collections and indexes, GitHub history, test output)
- Code snippet & error analysis write-up
- PowerPoint (after outline approval and once screenshots exist)

## Next priorities
1. Group review of the slides and report; fill in course details.
2. Rehearse the live demo (see slide 25 notes), record a backup video.
3. Check the patient portal on a real phone.
