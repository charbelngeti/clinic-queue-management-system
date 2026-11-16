# Claude Code Assistance Log

This is a short log of the work done with the help of Claude Code (an AI coding assistant by Anthropic). The group reviews all output and remains responsible for it.

## Mon 16 Nov 2026

**Session 1: Blueprint**
- Read the project brief and inspected the repository (README and .gitignore only; no MongoDB installed locally).
- Drafted `docs/BLUEPRINT.md` covering methodology, requirements, roles and permissions, architecture, MongoDB data model, UML plan, CASE tools, code-snippet topic, roadmap, report structure and presentation outline.
- Created `PROJECT_STATUS.md`.

**Session 2: Decisions & presentation outline**
- Incorporated the group's answers to Q1–Q12 into the blueprint (v0.2). Changes:
  - Admin and Receptionist split into separate roles.
  - New in-app messaging module.
  - Patient registration at reception only.
  - Triage made optional.
  - Kenya Data Protection Act 2019 cited.
  - Report limited to 10 pages.
- Drafted `docs/presentation/SLIDE_OUTLINE.md`: 27 slides, presenters assigned across all 10 members, speaker notes, and likely lecturer questions with answers.
- No application code written yet. Waiting for the go-ahead and MongoDB Atlas setup.

**Session 3: Increments 1–2 (implementation)**
- Updated the docs with the group's answers:
  - 9 members.
  - Report ~15 pages (max 20), appendices excluded.
  - Presentation 30 + 10 + 20 min.
  - Interaction diagrams = sequence + communication diagrams.
- Set up the project and connected to MongoDB Atlas (8.0 replica set; transactions available). Added `JWT_SECRET` and other settings to `.env`.
- Built the backend:
  - Express 5 + Mongoose 9 layered API (routes → controllers → services → models).
  - 13 collections, `$jsonSchema` validators and indexes, including unique partial indexes for no double-booking and no duplicate queue entries.
  - JWT httpOnly-cookie authentication, server-side RBAC permission map and audit logging.
- Built the queue engine: atomic "call next", state machines for appointments, queues and stages, and transactions for check-in and stage moves.
- Built the frontend:
  - Tailwind v4 design system and app shell with role-based navigation.
  - Pages: login, admin staff accounts and doctor schedules; reception dashboard, patients, patient record, appointments with slot booking, check-in and queue board.
  - Nurse triage workspace and the public "Who's Next" display.
- Wrote 27 automated API tests (`node:test` + supertest). All 27 pass (one test-data issue fixed along the way). Checked the main flows in a browser.

**Session 4: Increment 3 (clinical flow)**
- Committed and pushed Session 3 (`84fd4a6`) and tagged it `inc-2`. Added Office lock files to `.gitignore`.
- Created `docs/Demo-Accounts.docx` (demo login sheet) without adding new dependencies.
- Backend:
  - Consultation service shared by doctors and clinicians: draft notes, lab requests, prescriptions with allergy acknowledgement, clinician prescribing limits, referral and discharge.
  - Lab service: sample collection, results, and release back to the requesting clinician.
  - Pharmacy service: dispensing as a single transaction with a conditional stock decrement, plus inventory and formulary.
- Frontend: consultation workspace, lab workspace, pharmacy workspace, medications & stock, and daily lab/prescription records.
- Bugs found in the browser and fixed: workspace empty state not drawn on first load, nav highlighting on nested routes, narrow lab result field.
- Tests: 10 new clinical tests; the full suite (37) passes. The full patient journey was checked in a browser across reception, doctor, lab and pharmacy.
