

## Diagnóstico

O console mostra "Carregando..." infinito. Olhando o `AuthContext.tsx` atual, vejo o problema clássico de race/deadlock:

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (_event, session) => {
    await handleSession(session);  // ← await + query Supabase dentro do listener
  }
);
supabase.auth.getSession().then(({ data: { session } }) => {
  handleSession(session);  // ← roda em paralelo com o listener
});
```

Dois problemas confirmados:

1. **Deadlock no listener**: `handleSession` faz `await fetchProfile()` (query Supabase) dentro do callback de `onAuthStateChange`. Isso pode travar o cliente Supabase, e `loading` nunca vira `false`.
2. **Race condition**: `onAuthStateChange` e `getSession()` chamam `handleSession` em paralelo, podendo sobrescrever estado um do outro.

Os erros do console (`postMessage` e `setTitle`) são da extensão Lovable e do Chrome — não afetam o app.

## Correção

Refatorar **apenas** o `useEffect` do `AuthContext.tsx` seguindo o padrão oficial Supabase:

- `onAuthStateChange` **sem `await`** — usar `.then()` (fire-and-forget)
- `getSession()` faz só a hidratação inicial
- Flag `isMounted` para evitar updates após unmount
- Manter toda a lógica de perfil ativo/inativo intacta

## Mudança (1 arquivo, ~40 linhas)

### `src/contexts/AuthContext.tsx`
Substituir o `useEffect` e ajustar `handleSession` para versão síncrona (recebe perfil já buscado), mantendo `signIn`/`signOut`/tipos inalterados.

```typescript
useEffect(() => {
  let isMounted = true;

  const applySession = (session, prof) => {
    if (!isMounted) return;
    if (prof && !prof.is_active) {
      supabase.auth.signOut();
      setUser(null); setProfile(null); setLoading(false);
      toast.error("Usuário inativo. Contate o administrador.");
      return;
    }
    setUser(session?.user ?? null);
    setProfile(prof);
    setLoading(false);
  };

  // Listener: SEM await — fire-and-forget
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!isMounted) return;
    if (!session?.user) { setUser(null); setProfile(null); setLoading(false); return; }
    fetchProfile(session.user.id).then((prof) => applySession(session, prof));
  });

  // Hidratação inicial
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!isMounted) return;
    if (!session?.user) { setLoading(false); return; }
    fetchProfile(session.user.id).then((prof) => applySession(session, prof));
  });

  return () => { isMounted = false; subscription.unsubscribe(); };
}, []);
```

## Resultado
- Sem deadlock no listener Supabase
- Sem race entre `getSession` e `onAuthStateChange`
- `loading` sempre transita para `false`
- Sem necessidade de limpar cache
- Roteamento `/central-de-folha` permanece como está (já corrigido)

