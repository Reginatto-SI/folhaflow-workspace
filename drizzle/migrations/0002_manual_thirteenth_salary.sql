-- PRD-13: referência manual do 13º, independente da rubrica salario_g.
-- Folhas mensais e lançamentos históricos permanecem com NULL.
-- Validar mês/vínculo exclusivamente quando houver valor informado.
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS thirteenth_salary_reference numeric(14, 2)
  CONSTRAINT payroll_entries_thirteenth_salary_reference_check
  CHECK (
    thirteenth_salary_reference IS NULL
    OR (
      thirteenth_salary_reference >= 0
      AND month IS NULL
      AND payroll_batch_id IS NOT NULL
    )
  );
