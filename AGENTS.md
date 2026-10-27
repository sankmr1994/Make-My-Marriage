# Make My Marriage development instructions

- Read the approved PRD, system architecture, database design, and API design in `docs/` before implementing product features.
- Preserve the agreed V1 scope and role permissions. Report conflicts between code and the approved documents instead of silently changing business requirements.
- Use TypeScript strict mode. Validate API inputs with Zod and database documents with Mongoose.
- Keep database access on the server. Never expose provider credentials or other secrets to the browser.
- Store expense values as whole integer INR rupees.
- Model family guest records with `primaryContactName` and `familyCount`.
- Prefer small, reviewable changes. Run relevant lint, typecheck, and tests after changes.
- Use `docs/PROJECT_STATUS.md` as the project progress tracker. Keep it current when a feature or milestone is completed, and record what is implemented, what remains, and the latest relevant verification.
- Treat the approved PRD, architecture, database, and API documents as the source of product requirements; the status file records progress and must not redefine scope.
- Distinguish UI demonstrations and sample data from implemented backend behavior. Do not mark a feature complete until its stated scope is implemented and relevant checks pass.
