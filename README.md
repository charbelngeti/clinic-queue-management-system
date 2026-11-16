# CareQueue Clinic: Clinic Queue & Appointment Management System

University group project. Node.js + Express + MongoDB + Tailwind CSS (vanilla JS frontend).
All patient data in this project is **synthetic**.

## Run locally
1. Install Node.js 22+.
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI` (MongoDB Atlas or a local replica set; transactions require a replica set) and `JWT_SECRET`.
4. `npm run seed` resets the database: it creates collections, validators and indexes, then loads demo data.
5. `npm run css:build` (only after changing styles)
6. `npm start`, then open http://localhost:3000. The public queue display is at http://localhost:3000/display

## Demo accounts (password `Clinic@2026`)
| Role | Email |
|---|---|
| Administrator | admin@clinic.test |
| Receptionist | reception@clinic.test |
| Doctor | dr.otieno@clinic.test, dr.mwangi@clinic.test, dr.hassan@clinic.test |
| Clinician | co.njoroge@clinic.test, co.wekesa@clinic.test |
| Nurse | nurse.akinyi@clinic.test, nurse.mutua@clinic.test |
| Lab technician | lab.kamau@clinic.test, lab.chebet@clinic.test |
| Pharmacist | pharm.omondi@clinic.test, pharm.nduta@clinic.test |
| Patient (portal) | patient@clinic.test, patient2@clinic.test |

## Tests
`npm test` runs the automated API tests against a separate database (`clinic_qms_test`).

## Documentation
- `docs/BLUEPRINT.md`: methodology, requirements, architecture, data model
- `docs/presentation/SLIDE_OUTLINE.md`: presentation plan
- `PROJECT_STATUS.md`: progress tracker
- `CLAUDE-ASSISTANCE.md`: log of AI-assisted work
