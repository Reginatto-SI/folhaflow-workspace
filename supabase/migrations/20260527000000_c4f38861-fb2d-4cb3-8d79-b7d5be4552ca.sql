DROP INDEX IF EXISTS public.employees_cpf_unique_global;
CREATE UNIQUE INDEX IF NOT EXISTS employees_cpf_company_unique ON public.employees USING btree (cpf, company_id);