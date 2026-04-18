

## Plano: Fundação RBAC v1 (PRD-10)

### Diagnóstico
- `profiles` existe mas não tem role.
- RLS atual é `true` em todas as tabelas (sem enforcement).
- `ProtectedRoute` só verifica autenticação.
- Sidebar exibe todos os itens para todos.
- Edge Functions `admin-create-user`/`admin-update-user` não validam quem chama.

Vou seguir exatamente a recomendação oficial Lovable (memória `infinite-recursion-in-rls`): **roles em tabela separada** + função `SECURITY DEFINER` (`has_role`, `has_permission`).

---

### 1. Migração SQL (banco)

**Enums e tabelas:**
```sql
create type public.app_role as enum ('admin', 'operacional', 'consulta');
create type public.app_permission as enum (
  'empresas.view','funcionarios.view','estrutura.view',
  'rubricas.manage','folha.operar','relatorios.view',
  'usuarios.manage','configuracoes.manage'
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role app_role not null,
  permission app_permission not null,
  unique (role, permission)
);
```

**Seed** das permissões (admin = todas; operacional = empresas/funcionarios/estrutura/folha/relatorios; consulta = empresas/funcionarios/relatorios).

**Funções `SECURITY DEFINER`:**
- `has_role(_user_id, _role)` → boolean
- `has_permission(_user_id, _permission)` → boolean (verifica via `user_roles` + `role_permissions`)
- `is_admin(_user_id)` → boolean (atalho)

**RLS:**
- `user_roles` e `role_permissions`: SELECT autenticado, INSERT/UPDATE/DELETE só admin
- `profiles`: substituir UPDATE permissivo — usuário edita o próprio nome; admin edita tudo (inclusive `is_active`)
- Manter demais tabelas como estão (escopo desta v1 é RBAC, não revisão de RLS de dados — anotado como ponto fora de escopo)

**Bootstrap admin:** o primeiro usuário cadastrado vira admin (verificar se `user_roles` está vazia; se sim, atribuir admin via trigger no `handle_new_user` adaptado, OU script manual após migração para o usuário existente atual).

---

### 2. Edge Functions (backend enforcement)

Adicionar **em ambas** (`admin-create-user`, `admin-update-user`):
- Ler `Authorization: Bearer <token>` do request
- Validar via `supabaseAdmin.auth.getUser(token)`
- Verificar `has_role(uid, 'admin')` — senão 403
- `admin-create-user`: aceitar `role: app_role` no body, criar entrada em `user_roles` após criar usuário
- `admin-update-user`: aceitar `role` opcional, fazer upsert em `user_roles` (delete + insert da nova role)

Manter `verify_jwt = false` (validação manual em código, padrão do projeto).

---

### 3. Frontend

**`AuthContext.tsx`:**
- Buscar role + permissions junto com profile (single roundtrip): `supabase.from('user_roles').select('role').eq('user_id', uid)` + `role_permissions` ou criar view `user_permissions_view`
- Expor: `role: AppRole | null`, `permissions: Set<string>`, `hasPermission(code) => boolean`, `isAdmin: boolean`

**Novo `PermissionRoute.tsx`** (envolve `ProtectedRoute`):
```tsx
<PermissionRoute permission="usuarios.manage">
  <UsersAdmin />
</PermissionRoute>
```
- Sem permissão → renderiza `<Forbidden />` dentro do `AppLayout` (mensagem "Você não possui permissão para acessar esta área" + botão voltar)

**`App.tsx`:** envolver cada rota com a permissão correspondente:
| Rota | Permissão |
|---|---|
| `/central-de-folha` | `folha.operar` |
| `/empresas` | `empresas.view` |
| `/funcionarios` | `funcionarios.view` |
| `/setores`, `/funcoes-cargos` | `estrutura.view` |
| `/rubricas` | `rubricas.manage` |
| `/usuarios` | `usuarios.manage` |
| `/configuracoes` | `configuracoes.manage` |

**`AppLayout.tsx`:** filtrar `mainNavItems`, `cadastrosNavItems`, `secondaryNavItems` por `hasPermission()` antes de renderizar. Esconder grupo "Cadastros" se vazio.

**`UsersAdmin.tsx`** (mudança mínima):
- Listar `role` (badge colorida) na coluna após status
- No formulário: `<Select>` de role (admin/operacional/consulta), obrigatório na criação, editável na edição
- Buscar role atual junto com profiles via join ou query paralela
- Bloquear o admin de remover sua própria role admin (simples check no submit)

---

### 4. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | enums, tabelas, RLS, funções, seed, bootstrap admin |
| `supabase/functions/admin-create-user/index.ts` | validação caller-admin + criar user_role |
| `supabase/functions/admin-update-user/index.ts` | validação caller-admin + atualizar user_role |
| `src/contexts/AuthContext.tsx` | carregar role/permissions, expor `hasPermission` |
| `src/components/auth/PermissionRoute.tsx` | **novo** guard por permissão |
| `src/components/auth/Forbidden.tsx` | **novo** tela "sem permissão" |
| `src/App.tsx` | envolver rotas com `PermissionRoute` |
| `src/components/layout/AppLayout.tsx` | filtrar menus por permissão |
| `src/pages/UsersAdmin.tsx` | coluna role + select no form |

---

### Resultado
- 3 roles + 8 permissões fixas, persistidas
- Backend (RLS + edge) bloqueia operações não autorizadas
- Rotas protegidas individualmente; URL direta sem permissão → tela Forbidden
- Menu lateral mostra só itens permitidos
- `/usuarios`, `/rubricas`, `/configuracoes` exclusivos de admin
- Usuário inativo já bloqueado no login pelo `AuthContext` (mantido)

### Fora de escopo v1 (anotado)
- Revisão de RLS das tabelas de dados (companies, employees, etc.) — hoje permissivas
- Permissões customizadas por usuário
- Auditoria/logs

