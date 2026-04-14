-- Fase estrutural: separação definitiva entre cadastro de funcionários e lançamentos de folha.
-- A Central de Folha passa a listar registros persistidos por empresa/competência/funcionário.

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year integer not null check (year >= 2000),
  base_salary numeric(12,2) not null default 0,
  earnings jsonb not null default '{}'::jsonb,
  deductions jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_entries_company_month_year_employee_unique unique (company_id, month, year, employee_id)
);

create index if not exists payroll_entries_company_month_year_idx
  on public.payroll_entries (company_id, month, year);

create index if not exists payroll_entries_employee_id_idx
  on public.payroll_entries (employee_id);

drop trigger if exists set_payroll_entries_updated_at on public.payroll_entries;
create trigger set_payroll_entries_updated_at
before update on public.payroll_entries
for each row execute function public.set_updated_at();

alter table public.payroll_entries enable row level security;

drop policy if exists payroll_entries_select_all on public.payroll_entries;
create policy payroll_entries_select_all on public.payroll_entries
for select using (true);

drop policy if exists payroll_entries_insert_all on public.payroll_entries;
create policy payroll_entries_insert_all on public.payroll_entries
for insert with check (true);

drop policy if exists payroll_entries_update_all on public.payroll_entries;
create policy payroll_entries_update_all on public.payroll_entries
for update using (true) with check (true);

drop policy if exists payroll_entries_delete_all on public.payroll_entries;
create policy payroll_entries_delete_all on public.payroll_entries
for delete using (true);

-- Limpeza de legado em desenvolvimento: remove entradas sintéticas antigas em cache front-end.
-- Não há migração de dados porque o modelo anterior era derivado em memória.
