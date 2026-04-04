-- Fase 8: cadastros oficiais de setores e funções/cargos seguindo padrão piloto administrativo.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_company_name_unique unique (company_id, name)
);

create index if not exists departments_company_id_idx on public.departments (company_id);
create index if not exists departments_is_active_idx on public.departments (is_active);

create table if not exists public.job_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_roles_company_name_unique unique (company_id, name)
);

create index if not exists job_roles_company_id_idx on public.job_roles (company_id);
create index if not exists job_roles_is_active_idx on public.job_roles (is_active);

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists set_job_roles_updated_at on public.job_roles;
create trigger set_job_roles_updated_at
before update on public.job_roles
for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
alter table public.job_roles enable row level security;

-- Comentário: manutenção da mesma política atual do projeto (sem autenticação multi-tenant ativa ainda)
-- para menor mudança segura e sem quebra de fluxo de operação.
drop policy if exists departments_select_all on public.departments;
create policy departments_select_all on public.departments
for select using (true);

drop policy if exists departments_insert_all on public.departments;
create policy departments_insert_all on public.departments
for insert with check (true);

drop policy if exists departments_update_all on public.departments;
create policy departments_update_all on public.departments
for update using (true) with check (true);

drop policy if exists departments_delete_all on public.departments;
create policy departments_delete_all on public.departments
for delete using (true);

drop policy if exists job_roles_select_all on public.job_roles;
create policy job_roles_select_all on public.job_roles
for select using (true);

drop policy if exists job_roles_insert_all on public.job_roles;
create policy job_roles_insert_all on public.job_roles
for insert with check (true);

drop policy if exists job_roles_update_all on public.job_roles;
create policy job_roles_update_all on public.job_roles
for update using (true) with check (true);

drop policy if exists job_roles_delete_all on public.job_roles;
create policy job_roles_delete_all on public.job_roles
for delete using (true);
