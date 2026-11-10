# AGENTS.md

- 13th-salary payrolls are identified by `payroll_batches.batch_type` (`13_primeira`/`13_segunda`) with `month` NULL; entries inherit the type via `payroll_batch_id` only. In the frontend they are represented by internal codes 13/14 (see `src/lib/competence.ts`) that must never be written to the database — why: reuse every existing month/year comparison without a refactor while keeping the DB free of fictitious months.
