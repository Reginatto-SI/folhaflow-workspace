

# Plano: Cadastro de Usuários com Login

## Resumo

Implementar autenticação simples com: login por e-mail/senha, tela administrativa de usuários, e controle de ativo/inativo. Sem roles, sem multi-tenant, sem recuperação de senha.

---

## Arquitetura

- **Autenticação**: Supabase Auth (email+senha)
- **Tabela `profiles`**: armazena nome, status ativo/inativo, vinculada a `auth.users`
- **Criação de usuários**: via Edge Function usando `service_role` (admin cria com senha definida)
- **Controle de acesso**: verificação de `is_active` no login e via listener de sessão
- **Auto-confirm habilitado**: como o admin cria os usuários, não faz sentido exigir confirmação por e-mail

---

## Etapas

### 1. Banco de dados — tabela `profiles`

Criar migration:

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas abertas (sem roles por enquanto, sistema interno)
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_all" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_insert_all" ON public.profiles FOR INSERT WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Edge Function — `admin-create-user`

Cria usuário via `supabase.auth.admin.createUser()` com senha definida e `email_confirm: true`. Recebe `{ name, email, password }`. Retorna o perfil criado.

### 3. Habilitar auto-confirm de e-mail

Usar `cloud--configure_auth` para habilitar auto-confirm, já que usuários são criados pelo admin.

### 4. Contexto de autenticação — `src/contexts/AuthContext.tsx`

- Estado: `user`, `profile`, `loading`, `isAuthenticated`
- `onAuthStateChange` para gerenciar sessão
- Ao fazer login, busca `profiles` e verifica `is_active`
- Se inativo: faz `signOut` e mostra erro
- Funções: `signIn`, `signOut`

### 5. Tela de Login — `src/pages/Login.tsx`

- Formulário simples: e-mail + senha + botão "Entrar"
- Visual limpo, centralizado, com logo "FolhaFlow"
- Redireciona para `/` após login

### 6. Proteção de rotas — `src/components/auth/ProtectedRoute.tsx`

- Wrapper que verifica `isAuthenticated`
- Se não autenticado, redireciona para `/login`
- Loading state enquanto verifica sessão

### 7. Atualizar `App.tsx`

- Adicionar `AuthProvider` envolvendo tudo
- Rota `/login` pública
- Todas as outras rotas protegidas via `ProtectedRoute`

### 8. Tela de Usuários — `src/pages/UsersAdmin.tsx`

Seguindo o padrão existente (igual a Departments):
- Header com título + botão "Novo Usuário"
- KPIs: total, ativos, inativos
- Tabela: nome, e-mail, status (badge), menu de ações (...)
- Modal de cadastro: nome, e-mail, senha
- Modal de edição: nome, e-mail (senha opcional para redefinir)
- Ação de ativar/inativar via menu de contexto

### 9. Atualizar sidebar e rotas

- Adicionar rota `/usuarios` no `App.tsx`
- Adicionar item "Usuários" no menu de Cadastros do `AppLayout.tsx`
- Atualizar avatar no header com dados reais do perfil logado
- Botão "Sair" funcional

### 10. Edge Function — `admin-update-user`

Para redefinir senha de um usuário existente (via `supabase.auth.admin.updateUserById`).

---

## Detalhes técnicos

- A criação de usuários precisa de Edge Function porque `auth.admin` exige `service_role_key` (não exposta no client)
- O `SUPABASE_SERVICE_ROLE_KEY` já está disponível como secret
- A verificação de `is_active` acontece no client após login — se inativo, força logout imediato
- Sem roles nesta fase: qualquer usuário logado pode acessar a tela de usuários

---

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/contexts/AuthContext.tsx` | Provider de autenticação |
| `src/pages/Login.tsx` | Tela de login |
| `src/pages/UsersAdmin.tsx` | Tela administrativa de usuários |
| `src/components/auth/ProtectedRoute.tsx` | Wrapper de rota protegida |
| `supabase/functions/admin-create-user/index.ts` | Edge Function para criar usuário |
| `supabase/functions/admin-update-user/index.ts` | Edge Function para atualizar usuário |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | AuthProvider, rota /login, ProtectedRoute, rota /usuarios |
| `src/components/layout/AppLayout.tsx` | Item "Usuários" no menu, avatar real, logout funcional |

