-- 1) Adicionar coluna is_active
alter table public.companies 
  add column if not exists is_active boolean not null default true;

-- 2) Normalizar CNPJ para apenas dígitos
update public.companies 
  set cnpj = regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')
  where cnpj is not null;

-- 3) Índice único de CNPJ
create unique index if not exists companies_cnpj_unique on public.companies (cnpj);

-- 4) Endereço obrigatório
update public.companies 
  set address = '—' 
  where address is null or trim(address) = '';
alter table public.companies alter column address set not null;

-- 5) RLS: substituir policies abertas por permissão real
drop policy if exists companies_select_all on public.companies;
drop policy if exists companies_insert_all on public.companies;
drop policy if exists companies_update_all on public.companies;
drop policy if exists companies_delete_all on public.companies;

create policy "empresas view"
  on public.companies for select
  to authenticated
  using (public.has_permission(auth.uid(), 'empresas.view'));

create policy "empresas insert admin"
  on public.companies for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "empresas update admin"
  on public.companies for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- DELETE: nenhuma policy (PRD-05 — sem exclusão física)

-- 6) Trigger de updated_at (se ainda não existir)
drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();