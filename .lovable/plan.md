

## Diagnóstico

O `BUILD_DATETIME = "13/04/2026 20:05"` no `AppLayout.tsx` é uma **string hardcoded**. Nunca muda. Por isso o rodapé mostra sempre a mesma data, mesmo após edições.

Não temos acesso a git hash em runtime no Lovable, mas podemos usar **timestamp do build** (gerado automaticamente pelo Vite a cada build) como identificador único de versão — o equivalente prático a um "commit".

## Solução (3 partes)

### 1. Build identifier automático (`vite.config.ts`)
Injetar 2 constantes globais em tempo de build:
- `__BUILD_TIME__`: ISO timestamp do momento do build
- `__BUILD_ID__`: hash curto derivado do timestamp (ex: `a3f9c2`)

```ts
define: {
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  __BUILD_ID__: JSON.stringify(Date.now().toString(36).slice(-6)),
}
```

Tipos em `src/vite-env.d.ts`.

### 2. Rodapé do sidebar mais completo (`AppLayout.tsx`)
Substituir a string fixa por:
```
v1.0 (a3f9c2)
18/04/2026 14:32
```
Linha 1: versão + build ID. Linha 2: data/hora formatada PT-BR. Tooltip com ISO completo ao passar o mouse.

### 3. Detector de nova versão + toast (`src/hooks/useVersionCheck.ts` + `public/version.json`)
- Vite gera `public/version.json` a cada build via plugin inline com `{ buildId, buildTime }`.
- Hook `useVersionCheck` faz fetch de `/version.json?t=${Date.now()}` a cada **60 segundos**.
- Compara com o `__BUILD_ID__` carregado em memória.
- Se diferente → dispara `toast` (sonner) **persistente** com 2 ações:
  - **"Atualizar agora"** → limpa `caches` (Cache API), `localStorage` flag de versão, e faz `window.location.reload()`.
  - **"Depois"** → fecha o toast; reaparece em 10 minutos.
- Hook montado uma vez no `AppLayout` (só para usuários autenticados).

### Fluxo final
```
Build N    → version.json { id: "a3f9c2", time: "..." }
Usuário carrega app → memoria guarda "a3f9c2"
Build N+1  → version.json { id: "b7e1d4", time: "..." }
Após 60s   → hook detecta divergência
           → toast: "Nova versão disponível [Atualizar agora] [Depois]"
Click "Atualizar agora" → caches.delete() + reload(true)
```

## Arquivos

| Arquivo | Mudança |
|---|---|
| `vite.config.ts` | +`define` com BUILD_TIME e BUILD_ID, +plugin inline para gerar `public/version.json` |
| `src/vite-env.d.ts` | +declare const `__BUILD_TIME__`, `__BUILD_ID__` |
| `src/hooks/useVersionCheck.ts` | **novo** — polling + toast com ações |
| `src/components/layout/AppLayout.tsx` | rodapé usa `__BUILD_TIME__`/`__BUILD_ID__`, monta `useVersionCheck()` |

## Resultado

- Rodapé mostra automaticamente data/hora real do build + ID curto
- A cada novo deploy, usuários abertos recebem toast em até 60s
- Click em "Atualizar agora" limpa caches e recarrega — sem precisar limpar manualmente
- Zero impacto em outras telas, autenticação ou rotas

