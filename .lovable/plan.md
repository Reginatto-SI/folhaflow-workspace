

# Evolução Visual do FolhaFlow — Layout Profissional

## Resumo

Refatorar o layout global do sistema (AppLayout) e a tela de Funcionários como piloto, sem alterar lógica de negócio ou CRUD existente. Resultado: sistema com aparência de software administrativo maduro.

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AppLayout.tsx` | Reescrever: novo header + sidebar colapsável via shadcn Sidebar |
| `src/pages/Employees.tsx` | Adicionar KPIs compactos + melhorar hierarquia visual da página |
| `src/pages/Index.tsx` | Ajustar hierarquia visual (título/subtítulo) para seguir novo padrão |
| `src/index.css` | Pequenos ajustes de variáveis CSS para tabelas e headers |
| `src/App.tsx` | Envolver com `SidebarProvider` |

## Parte 1 — Novo Header Global

Substituir o header atual em `AppLayout.tsx` por uma estrutura de 3 zonas:

- **Esquerda**: `SidebarTrigger` (hamburguer) + título dinâmico da página atual (derivado da rota via `useLocation`)
- **Centro**: seletores de empresa e competência (já existentes, reposicionados)
- **Direita**: ícone Bell (placeholder notificações) + Avatar com `DropdownMenu` contendo "Meu perfil" e "Sair"

Header fixo com `h-14`, borda inferior, fundo `bg-card`.

## Parte 2 — Sidebar Colapsável

Migrar de sidebar manual para o componente `shadcn Sidebar` com `collapsible="icon"`:

- Modo expandido: ícone + texto (como atual)
- Modo colapsado: apenas ícones com tooltips automáticos do componente
- `SidebarTrigger` no header (sempre visível)
- Logo "FolhaFlow" no topo da sidebar, colapsa para ícone "F"
- Footer com versão
- Estado persistido via `SidebarProvider` (localStorage automático)

Usar `NavLink` para highlight de rota ativa.

## Parte 3 — KPIs Compactos (Funcionários como piloto)

Adicionar uma faixa de 4 mini-cards no topo da página de Funcionários, calculados a partir do array `employees`:

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Total: 12   │ │  Ativos: 10  │ │ Afastados: 1 │ │ Mensalist: 8 │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

- Cards com `border`, ícone pequeno, label + número
- Cores: ícone azul para total, verde para ativos, amarelo para afastados, cinza para mensalistas
- Altura compacta (~64px), layout `grid grid-cols-2 md:grid-cols-4 gap-3`

## Parte 4 — Hierarquia Visual das Páginas

Estabelecer padrão de cabeçalho de página:

- Título `text-2xl font-bold` (mais forte que o atual `text-xl font-semibold`)
- Subtítulo `text-sm text-muted-foreground`
- Separação visual clara entre header da página, KPIs e conteúdo
- Espaçamento consistente: `mb-6` entre blocos

## Parte 5 — Refinamento Visual Global

Na tabela de Funcionários:
- Cabeçalho com `bg-muted` mais forte e `font-semibold`
- Linhas com `hover:bg-muted/40` e melhor padding
- Botão "Novo Funcionário" com ícone `Plus` (já tem) — manter

Cards gerais:
- Garantir `rounded-lg border shadow-sm` como padrão
- Padding `p-4` consistente

## Parte 6 — Preservação

- Nenhuma alteração em modais, formulários, validações ou lógica de CRUD
- `PayrollContext` intocado
- Apenas layout wrapper e apresentação visual das páginas

## Detalhes Técnicos

- `SidebarProvider` será adicionado em `App.tsx` envolvendo `AppLayout`
- O título dinâmico no header usa um mapa rota→label derivado de `navItems`
- O `DropdownMenu` do avatar usa dados placeholder (nome "Usuário", email hardcoded) — será conectado à autenticação futuramente
- Componentes shadcn já disponíveis: `Sidebar`, `DropdownMenu`, `Avatar`, `Tooltip` — nenhuma instalação necessária

