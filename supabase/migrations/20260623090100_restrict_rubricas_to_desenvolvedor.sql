-- Correção segura da segregação de acesso a Rubricas.
-- Não limpa roles de usuários: edimarreginato@gmail.com apenas acumula admin + desenvolvedor.

alter type public.app_role add value if not exists 'desenvolvedor';

-- Admin mantém as permissões normais do sistema, sem rubricas.manage.
insert into public.role_permissions (role, permission) values
  ('admin'::public.app_role, 'empresas.view'::public.app_permission),
  ('admin'::public.app_role, 'funcionarios.view'::public.app_permission),
  ('admin'::public.app_role, 'estrutura.view'::public.app_permission),
  ('admin'::public.app_role, 'folha.operar'::public.app_permission),
  ('admin'::public.app_role, 'relatorios.view'::public.app_permission),
  ('admin'::public.app_role, 'usuarios.manage'::public.app_permission),
  ('admin'::public.app_role, 'configuracoes.manage'::public.app_permission),
  ('desenvolvedor'::public.app_role, 'rubricas.manage'::public.app_permission)
on conflict (role, permission) do nothing;

-- Rubricas fica exclusiva para usuários que tenham a role desenvolvedor.
delete from public.role_permissions
where role in ('admin'::public.app_role, 'operacional'::public.app_role, 'consulta'::public.app_role)
  and permission = 'rubricas.manage'::public.app_permission;

-- Insert incremental e idempotente: preserva qualquer outra role já existente do usuário.
insert into public.user_roles (user_id, role)
select id, role_value
from auth.users
cross join (values
  ('admin'::public.app_role),
  ('desenvolvedor'::public.app_role)
) as required_roles(role_value)
where email = 'edimarreginato@gmail.com'
on conflict (user_id, role) do nothing;
