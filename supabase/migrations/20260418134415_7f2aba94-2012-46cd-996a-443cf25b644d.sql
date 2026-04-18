-- ========== ENUMS ==========
create type public.app_role as enum ('admin', 'operacional', 'consulta');

create type public.app_permission as enum (
  'empresas.view',
  'funcionarios.view',
  'estrutura.view',
  'rubricas.manage',
  'folha.operar',
  'relatorios.view',
  'usuarios.manage',
  'configuracoes.manage'
);

-- ========== TABELAS ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission public.app_permission not null,
  created_at timestamptz not null default now(),
  unique (role, permission)
);

create index idx_user_roles_user_id on public.user_roles(user_id);
create index idx_role_permissions_role on public.role_permissions(role);

-- ========== FUNÇÕES SECURITY DEFINER ==========
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'admin'::public.app_role)
$$;

create or replace function public.has_permission(_user_id uuid, _permission public.app_permission)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = _user_id
      and rp.permission = _permission
  )
$$;

-- ========== SEED role_permissions ==========
insert into public.role_permissions (role, permission) values
  ('admin', 'empresas.view'),
  ('admin', 'funcionarios.view'),
  ('admin', 'estrutura.view'),
  ('admin', 'rubricas.manage'),
  ('admin', 'folha.operar'),
  ('admin', 'relatorios.view'),
  ('admin', 'usuarios.manage'),
  ('admin', 'configuracoes.manage'),
  ('operacional', 'empresas.view'),
  ('operacional', 'funcionarios.view'),
  ('operacional', 'estrutura.view'),
  ('operacional', 'folha.operar'),
  ('operacional', 'relatorios.view'),
  ('consulta', 'empresas.view'),
  ('consulta', 'funcionarios.view'),
  ('consulta', 'relatorios.view');

-- ========== RLS ==========
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;

-- user_roles: usuário lê as próprias; admin lê e gerencia tudo
create policy "users can view own role"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "admins can insert roles"
  on public.user_roles for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "admins can update roles"
  on public.user_roles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "admins can delete roles"
  on public.user_roles for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- role_permissions: leitura para autenticados; modificação só admin
create policy "authenticated can view role permissions"
  on public.role_permissions for select
  to authenticated
  using (true);

create policy "admins can modify role permissions"
  on public.role_permissions for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ========== Endurecimento RLS profiles ==========
drop policy if exists profiles_insert_all on public.profiles;
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_update_all on public.profiles;

-- SELECT: usuário lê o próprio; admin lê todos
create policy "profiles select own or admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

-- INSERT: trigger handle_new_user roda como SECURITY DEFINER e bypassa RLS,
-- mas mantemos uma policy permissiva mínima para compatibilidade caso outro caminho insira.
create policy "profiles insert self or admin"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin(auth.uid()));

-- UPDATE: usuário pode atualizar só o próprio nome (não is_active);
-- admin pode atualizar tudo. Como não temos column-level RLS facilmente sem trigger,
-- restringimos: usuário comum só consegue update se id=auth.uid(); a edge function admin
-- usa service_role e bypassa RLS. Para evitar self-activation, bloqueamos mudanças em is_active
-- via trigger.
create policy "profiles update own or admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

-- Trigger: usuário comum não pode mudar is_active no próprio perfil
create or replace function public.prevent_self_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from old.is_active then
    if not public.is_admin(auth.uid()) then
      raise exception 'Apenas administradores podem alterar o status ativo/inativo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_activation on public.profiles;
create trigger trg_prevent_self_activation
  before update on public.profiles
  for each row execute function public.prevent_self_activation();

-- ========== Bootstrap admin: usuário existente vira admin ==========
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'edimarreginato@gmail.com'
on conflict (user_id, role) do nothing;

-- ========== Atualiza handle_new_user: 1º usuário do sistema vira admin automático ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_any boolean;
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email
  );

  -- Se ainda não há nenhuma role atribuída no sistema, este usuário vira admin (bootstrap).
  select exists(select 1 from public.user_roles) into has_any;
  if not has_any then
    insert into public.user_roles (user_id, role) values (new.id, 'admin'::public.app_role);
  end if;

  return new;
end;
$$;