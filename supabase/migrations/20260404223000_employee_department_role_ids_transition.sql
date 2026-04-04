-- Fase 9: transição gradual do funcionário para vínculo estruturado de setor/função por ID.
-- Estratégia: manter os campos legados de texto (department/role) enquanto department_id/job_role_id
-- é adotado progressivamente pela UI e pelos fluxos de atualização.

alter table public.employees
  add column if not exists department_id uuid references public.departments(id) on delete restrict,
  add column if not exists job_role_id uuid references public.job_roles(id) on delete restrict;

create index if not exists employees_department_id_idx on public.employees (department_id);
create index if not exists employees_job_role_id_idx on public.employees (job_role_id);

comment on column public.employees.department_id is
  'Vínculo estruturado com setor por ID (transição gradual; campo department legado ainda coexistente temporariamente).';

comment on column public.employees.job_role_id is
  'Vínculo estruturado com função/cargo por ID (transição gradual; campo role legado ainda coexistente temporariamente).';

-- Validação mínima de integridade multiempresa:
-- se houver vínculo por ID, ele precisa pertencer à mesma empresa registrada (company_id) do funcionário.
create or replace function public.validate_employee_catalog_company_match()
returns trigger
language plpgsql
as $$
begin
  if new.department_id is not null then
    if not exists (
      select 1
      from public.departments d
      where d.id = new.department_id
        and d.company_id = new.company_id
    ) then
      raise exception 'department_id inválido para a empresa registrada do funcionário';
    end if;
  end if;

  if new.job_role_id is not null then
    if not exists (
      select 1
      from public.job_roles jr
      where jr.id = new.job_role_id
        and jr.company_id = new.company_id
    ) then
      raise exception 'job_role_id inválido para a empresa registrada do funcionário';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_employee_catalog_company_match on public.employees;
create trigger validate_employee_catalog_company_match
before insert or update on public.employees
for each row execute function public.validate_employee_catalog_company_match();
