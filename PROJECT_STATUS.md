# PROJECT STATUS

**Deadline:** Fri 20 Nov 2026, for the code, the report (Word, ~15 pages, max 20, appendices excluded) and the presentation (PowerPoint; ~30 min talk + 10 min demo + 20 min Q&A)
**Last updated:** Mon 16 Nov 2026 (afternoon)
**Current phase:** Implementation. Increments 1–3 are done and verified; Increment 4 is next.

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
| 4 Portal, messaging & insight | Patient portal, messaging, role dashboards, reports, audit log viewer | ⏳ Next |
| 5 Hardening | Full multi-role E2E test, bug fixes | Not started |

### Automated tests
`npm test`: 37 API tests, **all passing** (16 Nov). They cover the clinical round trip (consultation → lab → same clinician → pharmacy), allergy acknowledgement, clinician prescribing limits, referral, the dispensing transaction rolling back on insufficient stock, over-dispensing, auth, RBAC (403s), NoSQL injection, duplicate patients, double-booking including a simultaneous race, patient IDOR, cancel rules, duplicate queue entries, concurrent "call next", priority ordering, vitals validation and flags, and privacy of the board and display.

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

## Workstream B: Academic Deliverables
### Completed
- Blueprint v0.3 (`docs/BLUEPRINT.md`)
- Slide outline v0.2 (`docs/presentation/SLIDE_OUTLINE.md`): 9 presenters, timings, Q&A. **Awaiting group review.**

### Outstanding
- PlantUML diagrams (use-case, sequence, communication, state, data model, architecture)
- CASE tools evidence (screenshots: Atlas/Compass collections and indexes, GitHub history, test output)
- Code snippet & error analysis write-up
- Word report
- PowerPoint (after outline approval and once screenshots exist)

## Next priorities
1. Increment 4: patient portal (book, cancel, queue position), messaging (reception hub), role dashboards & reports, audit log viewer.
2. Diagrams drawn from the implemented code.
3. Report and PowerPoint.
