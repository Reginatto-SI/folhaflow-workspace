-- Fase 1: base oficial para cadastro de empresas e funcionários.
create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companies_cnpj_key on public.companies (cnpj);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cpf text not null,
  admission_date date not null,
  registration text,
  notes text,
  department text,
  role text,
  is_monthly boolean not null default false,
  is_on_leave boolean not null default false,
  is_active boolean not null default true,
  bank_name text,
  bank_branch text,
  bank_account text,
  base_salary numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_company_cpf_unique unique (company_id, cpf)
);

create index if not exists employees_company_id_idx on public.employees (company_id);
create index if not exists employees_is_active_idx on public.employees (is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.employees enable row level security;

-- Comentário: como ainda não existe camada de autenticação/tenant no app,
-- iniciamos com política permissiva para não quebrar o uso atual.
drop policy if exists companies_select_all on public.companies;
create policy companies_select_all on public.companies
for select using (true);

drop policy if exists companies_insert_all on public.companies;
create policy companies_insert_all on public.companies
for insert with check (true);

drop policy if exists companies_update_all on public.companies;
create policy companies_update_all on public.companies
for update using (true) with check (true);

drop policy if exists companies_delete_all on public.companies;
create policy companies_delete_all on public.companies
for delete using (true);

drop policy if exists employees_select_all on public.employees;
create policy employees_select_all on public.employees
for select using (true);

drop policy if exists employees_insert_all on public.employees;
create policy employees_insert_all on public.employees
for insert with check (true);

drop policy if exists employees_update_all on public.employees;
create policy employees_update_all on public.employees
for update using (true) with check (true);

drop policy if exists employees_delete_all on public.employees;
create policy employees_delete_all on public.employees
for delete using (true);
