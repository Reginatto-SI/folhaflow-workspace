

## Diagnóstico — Central de Folha vs PRDs

### Status geral: **parcialmente aderente**
A base estrutural está sólida (RLS `folha.operar`, `payroll_batches`, recálculo backend). Existem **5 inconsistências reais** que justificam ajustes pontuais — nenhuma exige reestruturação.

### Pontos corretos (não tocar)
- RLS `folha.operar` em batches/entries (PRD-10).
- Cálculo final é backend-first via `recalculate_payroll_batch` (PRD-01).
- `PayrollTable` e `TotalsBar` consomem `earningsTotal/deductionsTotal/inssAmount/netSalary` do backend, sem fallback de cálculo local.
- `EmployeeDrawer` já filtra `nature=calculada` das seções operacionais (PRD-02).
- Criação automática de batch via `ensureCurrentBatch` (PRD-03 §16, transição preservada).
- Permissão checada em `PermissionRoute` antes de montar a tela.

### Problemas reais encontrados

| # | Problema | Impacto | PRD violado |
|---|---|---|---|
| 1 | Após salvar no `EmployeeDrawer`, **não há recálculo automático** — totais da tabela ficam desatualizados até clicar "Recalcular" | UX: usuário vê dados velhos sem aviso, contradiz "feedback imediato" | PRD-03 §2 |
| 2 | `EmployeeDrawer` exibe `Líquido = gross − deductionTotal` calculado **na UI**, divergente do backend (que aplica INSS sobre base fiscal) | Divergência de cálculo entre drawer e tabela. UI calculando = violação direta | PRD-01 §10, PRD-03 §2.1 |
| 3 | Header da Central **não exibe status da folha** (draft) — PRD-03 §4 exige | Falta de contexto operacional | PRD-03 §4 |
| 4 | `EmployeeRowExpansion.tsx` é **código morto** (nenhum import o usa) e ainda calcula valores localmente | Risco de regressão futura, ruído | Higiene de código |
| 5 | Botão "Gerar relatório" no header está `disabled` sem tooltip explicando — confunde usuário | UX confuso | PRD-03 §14 |

### Ajustes propostos (mínimos, cirúrgicos)

**1. Recálculo automático após salvar lançamento** (`src/pages/Index.tsx`)
- Em `handleSave`, após `updatePayrollEntry` retornar, chamar `recalculatePayrollBatch()` silenciosamente. Toast já existe no drawer; backend vira fonte única de totais sem clique extra.
- Também aplicar em `handleCreatePayrollEntry` após criar.

**2. Drawer mostra resumo do backend (não calcula)** (`src/components/payroll/EmployeeDrawer.tsx`)
- Manter `totals.gross`/`totals.deductionTotal` apenas como **prévia local em tempo real durante edição** (necessário para UX planilha — sem isso o usuário digita às cegas).
- **Adicionar** abaixo do "Resumo" um bloco "Valores calculados (após salvar)" exibindo `entry.earningsTotal`, `entry.deductionsTotal`, `entry.inssAmount`, `entry.netSalary` quando existirem.
- Renomear "Líquido" da prévia para "Líquido (prévia, sem encargos)" para não enganar.

**3. Badge dinâmica de status no header** (`src/components/payroll/PayrollHeader.tsx`)
- Hoje está hardcoded `<Badge>Em edição</Badge>`. Trocar por leitura de `currentBatch?.status` via `usePayroll()`. Como hoje só existe `draft`, mantém "Em edição" mas vira reativo (preparação para futuros status sem refactor).
- Expor `currentBatch` no contexto (já calculado, só falta exportar).

**4. Remover código morto**
- Deletar `src/components/payroll/EmployeeRowExpansion.tsx`. Não é importado em lugar nenhum.

**5. Tooltip nos botões disabled** (`PayrollHeader.tsx`)
- Envolver "Gerar relatório" e "Gerar recibo" (drawer) em tooltip "Disponível em sprint futura (PRD-07/PRD-08)".

### Ajustes do contexto necessários
- `PayrollContext.tsx`: expor `currentBatch` no tipo público (já existe internamente). Não muda comportamento.

### O que NÃO será feito (com justificativa)
- **Duplicação de folha (PRD-03 §5.2 / PRD-09)**: usuário pediu explicitamente "não implementar duplicação". Será listado em "ajustes sugeridos" do relatório.
- **Mexer em `payroll_batches` / `recalculate_payroll_batch`**: explicitamente proibido.
- **Tocar agrupamento por classification**: depende do motor (sprint futura).
- **Remover `getLegacyValue` do drawer**: ainda há entries antigas no banco com chaves legadas; remoção causaria perda de dados na leitura.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Index.tsx` | Chamar `recalculatePayrollBatch` após save/create (silencioso) |
| `src/components/payroll/EmployeeDrawer.tsx` | Renomear "Líquido" → "Líquido (prévia)", adicionar bloco "Valores calculados (backend)", tooltip no "Gerar recibo" |
| `src/components/payroll/PayrollHeader.tsx` | Badge reativa via `currentBatch.status`, tooltip no "Gerar relatório" |
| `src/contexts/PayrollContext.tsx` | Expor `currentBatch` no tipo público (~3 linhas) |
| `src/components/payroll/EmployeeRowExpansion.tsx` | **Deletar** (código morto) |
| `public/Analises/analise-7-revisao-central-folha.md` | Relatório completo conforme estrutura pedida |

### Resultado esperado
- **PRD-01**: UI deixa de competir com backend como fonte de verdade (drawer separa prévia × calculado).
- **PRD-03 §2**: feedback imediato — totais da tabela atualizam após cada save sem clique manual.
- **PRD-03 §4**: status da folha visível no header.
- **PRD-10**: nada muda (já correto).
- Higiene: -77 linhas de código morto.

### Critério final
Central fica **pronta para uso operacional diário**. Pendências para sprints futuras: duplicação (PRD-09), motor real de rubricas com classification (PRD-01 etapas 3-6), recibos (PRD-07), relatórios (PRD-08).

