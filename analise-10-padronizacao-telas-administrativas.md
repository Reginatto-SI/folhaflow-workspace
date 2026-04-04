# Análise 10 — Padronização das telas administrativas

## Escopo executado
Padronização visual e comportamental das telas:
- `/setores`
- `/funcoes-cargos`
- `/empresas`

Referência aplicada: padrão da tela piloto `/funcionarios`.

## O que foi ajustado por tela

### 1) Setores (`/setores`)
- Header padronizado com título, subtítulo contextual e contagem filtrada vs total.
- Ações globais no topo, na ordem definida:
  1. Exportar (dropdown com Excel/PDF)
  2. Importar (modal padrão)
  3. Novo Setor (abre modal de cadastro)
- KPIs compactos adicionados:
  - Total de setores
  - Ativos
  - Inativos
- Card de filtros no padrão obrigatório:
  - título interno `Filtrar por:`
  - botão `Limpar filtros`
  - grid responsivo
  - labels com ícone + texto
  - padding `pt-6 pb-8 px-8`
  - estado progressivo (compacto + `Ver mais filtros`)
- Tabela padronizada com:
  - cabeçalho destacado
  - badge de status
  - ações por menu `...` (popover)
- Modal de cadastro com header/body/footer fixos e botões com ícones.
- Modal de importação com botão baixar modelo, drag and drop, seleção de arquivo e footer padrão.

### 2) Funções/Cargos (`/funcoes-cargos`)
- Header padronizado e ações globais no mesmo padrão visual/ordem.
- KPIs compactos:
  - Total
  - Ativos
  - Inativos
- Card de filtros progressivo seguindo o padrão da tela piloto.
- Tabela alinhada com badge de status e ações via botão `...`.
- Modal de cadastro padronizado com estrutura fixa e botões com ícones.
- Modal de importação e exportação (dropdown) no padrão unificado.

### 3) Empresas (`/empresas`)
- Tela convertida de cards para tabela, alinhando com o padrão da tela piloto.
- Header padronizado com ações globais na ordem definida.
- KPIs compactos adicionados:
  - Total
  - Ativas
  - Inativas
- Card de filtros progressivo padronizado (busca, status e filtro avançado por endereço).
- Ações por linha migradas para menu `...`.
- Modal de cadastro padronizado (header/body/footer fixos e ícones nos botões).
- Modal de importação + exportação dropdown adicionados.

## Padrões aplicados
- Hierarquia visual consistente entre as três telas.
- Espaçamento e densidade equivalentes ao padrão oficial.
- Reuso de componentes existentes do design system (`Button`, `Dialog`, `DropdownMenu`, `Badge`, `Input`, `Select`, `Label`).
- Padrão de ícones aplicado:
  - Novo (plus)
  - Importar (upload)
  - Exportar (download)
  - Salvar (save)
  - Cancelar (x)

## Componentes reutilizados
- `@/components/ui/button`
- `@/components/ui/dialog`
- `@/components/ui/dropdown-menu`
- `@/components/ui/input`
- `@/components/ui/select`
- `@/components/ui/label`
- `@/components/ui/badge`

## Diferenças mantidas (intencionais)
- Empresas não possui campo de status persistido no modelo atual.
  - Mantido comportamento sem alterar regra de negócio/back-end.
  - Status visual exibido como ativo (padrão atual), com KPI de inativas em zero.

## Pontos que podem evoluir no futuro
1. Implementar status persistido para empresas (`isActive`) com migração de banco e reflexo no contexto.
2. Conectar importação/exportação a endpoints reais (atualmente em modo visual/simulação).
3. Extrair um componente reutilizável de filtros administrativos para reduzir duplicação mantendo padrão.
