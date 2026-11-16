# PROJECT STATUS

**Deadline:** Fri 20 Nov 2026, for code, report (≤ 10 pages, Word) and presentation (PowerPoint)
**Last updated:** Mon 16 Nov 2026
**Current phase:** Requirements & architecture. Blueprint v0.2 has the group's decisions incorporated. Coding has **not started**; it is waiting on the go-ahead and MongoDB setup.

## Group

| Name           | Adm. No. |
| -------------- | -------- |
| Charbel Ngeti  | 221441   |
| Adelight Naino | 220702   |
| Abigael Wambui | 193891   |
| Alvin Otanga   | 220267   |
| Ajani M'maitsi | 186452   |
| Nathaniel Lado | 178626   |
| Evans Kima     | 212539   |
| Faith Wanjira  | 220506   |
| Matthew Mwachi | 189603   |

## MongoDB setup needed (one group member, ~10 minutes)

1. Create a free account at https://cloud.mongodb.com.
2. **Create a cluster → M0 (Free)**. Choose the nearest region offered, and name it e.g. `clinic-cluster`.
3. **Security → Database Access → Add user.** Use username `clinic_app`, an auto-generated password, and the role _Read and write to any database_. Save the password somewhere private.
4. **Security → Network Access → Add IP.** Add your current IP. Other members who will run the app add theirs too. For the demo you may temporarily allow `0.0.0.0/0`: acceptable here because all data is synthetic, but remove it afterwards.
5. **Connect → Drivers.** Copy the `mongodb+srv://...` connection string.
6. In the project root, create a file named `.env` (git-ignored) containing:
   ```
   MONGODB_URI=mongodb+srv://clinic_app:<password>@<cluster-host>/clinic_qms?retryWrites=true&w=majority
   ```
   **Do not paste the password into chat or commit it.** Just tell Claude "the .env is ready".
7. (Recommended, for CASE-tool evidence) Install **MongoDB Compass** and connect with the same string.

## Workstream A: Application Development

### Completed

- Repository initialised.

### Outstanding

| Increment                     | Scope                                                                                                                      | Status      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1 Foundation                  | Scaffold, Tailwind, models, indexes, seed, auth, RBAC, UI shell                                                            | Not started |
| 2 Front desk                  | Patients + portal accounts, availability, appointments, check-in (triage or consultation), queue, Who's Next, nurse triage | Not started |
| 3 Clinical flow               | Consultation, lab, prescriptions, pharmacy + stock                                                                         | Not started |
| 4 Portal, messaging & insight | Patient portal, messaging, dashboards, reports, audit                                                                      | Not started |
| 5 Hardening                   | Automated + multi-role E2E tests, bug fixes                                                                                | Not started |

### Known bugs

- None (no code yet).

## Workstream B: Academic Deliverables

### Completed

- Project blueprint v0.2: `docs/BLUEPRINT.md`
- Presentation outline draft: `docs/presentation/SLIDE_OUTLINE.md` (awaiting review)

### Outstanding

- Slide outline approval → PowerPoint generation
- Use-case diagram
- Sequence diagrams
- Communication diagrams (Q6 confirmation)
- Data model diagram
- Architecture diagram
- CASE tools evidence
- Code snippet & error analysis
- Testing results
- Word report (≤ 10 pages)

## Open items

- Go-ahead to start coding.
- Lecturer's meaning of "interaction diagram" (see BLUEPRINT §14, Q6).
- Presentation time limit.
- Whether appendices count toward the 10-page limit.
- Correct admission numbers for the two Nathaniels.

## Next priorities

1. Go-ahead + `.env` ready → start Increment 1.
2. Review the slide outline.
