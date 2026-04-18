-- Endurecimento mínimo pós-auditoria para PRD-06/PRD-10:
-- 1) remove exclusão física de setores/cargos
-- 2) aplica permissão real no backend via has_permission(..., 'estrutura.view')
-- 3) bloqueia troca de empresa em setor/cargo já vinculado a funcionários

-- =========================
-- Departments policies
-- =========================
drop policy if exists departments_select_all on public.departments;
drop policy if exists departments_insert_all on public.departments;
drop policy if exists departments_update_all on public.departments;
drop policy if exists departments_delete_all on public.departments;

drop policy if exists "estrutura departments select" on public.departments;
drop policy if exists "estrutura departments insert" on public.departments;
drop policy if exists "estrutura departments update" on public.departments;

create policy "estrutura departments select"
  on public.departments for select
  to authenticated
  using (public.has_permission(auth.uid(), 'estrutura.view'));

create policy "estrutura departments insert"
  on public.departments for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'estrutura.view'));

create policy "estrutura departments update"
  on public.departments for update
  to authenticated
  using (public.has_permission(auth.uid(), 'estrutura.view'))
  with check (public.has_permission(auth.uid(), 'estrutura.view'));

-- DELETE: sem policy para impedir exclusão física (PRD-06)

-- =========================
-- Job roles policies
-- =========================
drop policy if exists job_roles_select_all on public.job_roles;
drop policy if exists job_roles_insert_all on public.job_roles;
drop policy if exists job_roles_update_all on public.job_roles;
drop policy if exists job_roles_delete_all on public.job_roles;

drop policy if exists "estrutura job_roles select" on public.job_roles;
drop policy if exists "estrutura job_roles insert" on public.job_roles;
drop policy if exists "estrutura job_roles update" on public.job_roles;

create policy "estrutura job_roles select"
  on public.job_roles for select
  to authenticated
  using (public.has_permission(auth.uid(), 'estrutura.view'));

create policy "estrutura job_roles insert"
  on public.job_roles for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'estrutura.view'));

create policy "estrutura job_roles update"
  on public.job_roles for update
  to authenticated
  using (public.has_permission(auth.uid(), 'estrutura.view'))
  with check (public.has_permission(auth.uid(), 'estrutura.view'));

-- DELETE: sem policy para impedir exclusão física (PRD-06)

-- =========================
-- Integridade cross-company
-- =========================
create or replace function public.prevent_catalog_company_change_with_employee_links()
returns trigger
language plpgsql
as $$
begin
  -- Comentário: evita inconsistência de empresa quando já há funcionário vinculado ao setor/cargo.
  if tg_table_name = 'departments' and new.company_id is distinct from old.company_id then
    if exists (select 1 from public.employees e where e.department_id = old.id) then
      raise exception 'Não é permitido alterar a empresa de um setor com funcionários vinculados';
    end if;
  end if;

  if tg_table_name = 'job_roles' and new.company_id is distinct from old.company_id then
    if exists (select 1 from public.employees e where e.job_role_id = old.id) then
      raise exception 'Não é permitido alterar a empresa de uma função/cargo com funcionários vinculados';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_department_company_change_with_links on public.departments;
create trigger trg_prevent_department_company_change_with_links
before update on public.departments
for each row execute function public.prevent_catalog_company_change_with_employee_links();

drop trigger if exists trg_prevent_job_role_company_change_with_links on public.job_roles;
create trigger trg_prevent_job_role_company_change_with_links
before update on public.job_roles
for each row execute function public.prevent_catalog_company_change_with_employee_links();
