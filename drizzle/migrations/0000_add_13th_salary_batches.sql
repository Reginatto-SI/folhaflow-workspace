-- Folhas de 13º salário: duas competências adicionais por empresa/exercício, sem mês associado.
ALTER TABLE public.payroll_batches
  ADD COLUMN IF NOT EXISTS batch_type text NOT NULL DEFAULT 'mensal';

ALTER TABLE public.payroll_batches
  ADD CONSTRAINT payroll_batches_batch_type_check
  CHECK (batch_type IN ('mensal', '13_primeira', '13_segunda'));

ALTER TABLE public.payroll_batches ALTER COLUMN month DROP NOT NULL;
ALTER TABLE public.payroll_entries ALTER COLUMN month DROP NOT NULL;

-- Mensal exige mês; 13º não possui mês.
ALTER TABLE public.payroll_batches
  ADD CONSTRAINT payroll_batches_month_by_type_check
  CHECK ((batch_type = 'mensal' AND month IS NOT NULL) OR (batch_type <> 'mensal' AND month IS NULL));

-- Unicidade de folha ativa: mensal por (empresa, ano, mês); 13º por (empresa, ano, parcela).
DROP INDEX IF EXISTS public.payroll_batches_company_month_year_active_unique;

CREATE UNIQUE INDEX payroll_batches_monthly_active_unique
  ON public.payroll_batches (company_id, year, month)
  WHERE is_archived = false AND batch_type = 'mensal';

CREATE UNIQUE INDEX payroll_batches_thirteenth_active_unique
  ON public.payroll_batches (company_id, year, batch_type)
  WHERE is_archived = false AND batch_type <> 'mensal';

COMMENT ON COLUMN public.payroll_batches.batch_type IS 'Tipo da folha: mensal | 13_primeira | 13_segunda. Folhas de 13º não possuem mês (month NULL).';