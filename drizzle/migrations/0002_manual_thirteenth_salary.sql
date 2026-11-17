ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS thirteenth_salary_reference numeric(14, 2)
  CHECK (thirteenth_salary_reference >= 0 AND month IS NULL AND payroll_batch_id IS NOT NULL);
