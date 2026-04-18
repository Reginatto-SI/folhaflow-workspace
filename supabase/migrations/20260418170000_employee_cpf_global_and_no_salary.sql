-- Correção crítica: cadastro de funcionário não deve armazenar valores de folha.
-- Salário mensal pertence exclusivamente aos lançamentos da Central de Folha.
alter table public.employees
  drop column if exists base_salary;

-- Correção crítica: CPF identifica pessoa física no cadastro geral do grupo,
-- portanto deve ser único globalmente (não por empresa registrante).
alter table public.employees
  drop constraint if exists employees_company_cpf_unique;

create unique index if not exists employees_cpf_unique_global
  on public.employees (cpf);
