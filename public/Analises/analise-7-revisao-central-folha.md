# Revisão da Central de Folha

## 1. Status geral

**Parcialmente aderente → aderente após esta sprint.**

A base estrutural já estava sólida (RLS `folha.operar`, `payroll_batches`, função `recalculate_payroll_batch` no backend, UI sem fallback de cálculo nos totais da tabela). Os ajustes desta sprint fecham os gaps menores de UX, sincronização e higiene de código que ainda contradiziam pontos específicos dos PRDs.

---

## 2. Pontos corretos (já alinhados ao PRD — não tocados)

- **PRD-10 — `folha.operar`**: rota `/central-de-folha` é gateada por `PermissionRoute`, e RLS no banco impede leitura/escrita em `payroll_batches` e `payroll_entries` sem a permissão.
- **PRD-01 §10 — backend é fonte de verdade**: `PayrollTable` e `TotalsBar` consomem `earningsTotal`, `deductionsTotal`, `inssAmount` e `netSalary` diretamente do backend. Nenhum cálculo é refeito na tabela.
- **PRD-03 §16 — folha formal por empresa+competência**: criação automática de batch via `ensureCurrentBatch` no `PayrollContext`, com upsert idempotente sobre `(company_id, month, year)`.
- **PRD-02 — derivadas (`nature=calculada`) não são input**: `EmployeeDrawer` filtra defensivamente derivadas das seções operacionais (Rubricas-base / Proventos / Descontos).
- **PRD-05 §5.4** — apenas empresas ativas aparecem no seletor da Central.
- **PRD-03 §2 — fluxo planilha**: edição inline na tabela e drawer lateral com seções compactas. Sem modais bloqueantes no caminho crítico.

---

## 3. Problemas encontrados

| # | Problema | Impacto | PRD violado |
|---|---|---|---|
| 1 | Após salvar no `EmployeeDrawer`, **não havia recálculo automático**. Totais da tabela ficavam desatualizados até o usuário clicar em "Recalcular". | UX: usuário via dados velhos sem aviso. | PRD-03 §2 (feedback imediato) |
| 2 | `EmployeeDrawer` exibia "Líquido" calculado **na UI** (`gross − deductionTotal`), divergente do backend (que aplica INSS sobre base fiscal). | Divergência silenciosa entre drawer e tabela. UI calculando = violação de "backend = fonte de verdade". | PRD-01 §10, PRD-03 §2.1 |
| 3 | Header da Central não exibia status real do batch — badge `<Badge>Em edição</Badge>` era hardcoded. | Falta de contexto operacional; impede evolução para `closed`/`paid` sem refactor. | PRD-03 §4 |
| 4 | `EmployeeRowExpansion.tsx` era código morto (nenhum import) e ainda continha cálculos locais legados. | Risco de regressão futura, ruído no codebase. | Higiene de código |
| 5 | Botões "Gerar relatório" (header) e "Gerar recibo" (drawer) ficavam `disabled` sem explicação. | Usuário não entendia se era bug ou feature pendente. | PRD-03 §14 (clareza) |

---

## 4. Ajustes realizados

### 4.1 Recálculo automático após save/create (`src/pages/Index.tsx`)
- `handleSave` agora chama `recalculatePayrollBatch()` silenciosamente após `updatePayrollEntry`.
- `handleCreatePayrollEntry` faz o mesmo após criar um lançamento novo.
- Falha no recálculo automático **não bloqueia** o save — usuário ainda pode disparar manualmente via botão "Recalcular".
- **Resultado**: tabela e `TotalsBar` refletem o backend imediatamente após cada interação. Backend permanece fonte única de verdade.

### 4.2 Drawer separa prévia × valores calculados (`src/components/payroll/EmployeeDrawer.tsx`)
- Seção antiga "Resumo" foi renomeada para **"Prévia (em edição)"** e a linha do líquido agora diz **"Líquido (prévia, sem encargos)"** — deixa explícito que é estimativa de digitação, não o cálculo final.
- Adicionada seção **"Valores calculados (backend)"** que exibe `entry.earningsTotal`, `entry.deductionsTotal`, `entry.inssAmount` e `entry.netSalary` exatamente como retornados pelo backend, em fundo `bg-muted/40` para diferenciação visual.
- **Resultado**: usuário vê em paralelo o que está digitando (prévia) e o que o sistema gravou (verdade). Elimina ambiguidade de "qual valor é o certo?".

### 4.3 Badge dinâmica de status (`src/components/payroll/PayrollHeader.tsx`)
- `currentBatch` foi exposto no `PayrollContextType` (já existia internamente via `useMemo`).
- Header agora lê `currentBatch?.status` e mapeia via `STATUS_LABEL` (`draft → "Em edição"`, `closed → "Fechada"`, `paid → "Paga"`).
- **Resultado**: PRD-03 §4 cumprido. Preparado para futuros status sem refactor.

### 4.4 Remoção de código morto
- **Deletado** `src/components/payroll/EmployeeRowExpansion.tsx` (~77 linhas). Nenhum import existia no projeto.
- **Resultado**: -77 linhas de superfície legada, sem nenhuma mudança funcional.

### 4.5 Tooltips em ações pendentes
- "Gerar relatório" (header) → tooltip "Disponível em sprint futura (PRD-08)."
- "Gerar recibo" (drawer) → tooltip "Disponível em sprint futura (PRD-07)."
- **Resultado**: usuário entende que é feature pendente, não bug.

---

## 5. Ajustes sugeridos (não implementados nesta sprint)

| Sugestão | PRD | Motivo de adiar |
|---|---|---|
| Implementar **duplicação de folha** (criar batch novo a partir do mês anterior, copiando entries). | PRD-09 / PRD-03 §5.2 | Pedido explícito do usuário ("não implementar duplicação nesta sprint"). |
| Implementar **motor real de cálculo de rubricas** (formula + percentual + valor_fixo) e migrar agrupamento da Central por `classification` ao invés de `type`. | PRD-01 etapas 3-6 | Sprint dedicada — escopo grande, exige homologação fiscal. |
| Implementar geração de **recibos PDF**. | PRD-07 | Depende do motor real estar ativo. |
| Implementar **relatórios consolidados** (totais por empresa, por departamento, etc.). | PRD-08 | Sprint dedicada. |
| **Transições de status** do batch (`draft → closed → paid`) com botões e confirmações no header. | PRD-03 §4 | Hoje só existe `draft`; ativar quando PRD-07/PRD-09 forem implementados. |
| **Realtime** nos totais da tabela (subscribe em `payroll_entries`) para multi-usuário. | PRD-03 §17 | Não é prioridade — recálculo automático já cobre o caso single-user. |

---

## 6. Riscos identificados

1. **Recálculo automático silencioso pode mascarar erro de backend**: se o `recalculate_payroll_batch` falhar silenciosamente após save, o usuário verá totais antigos sem aviso. **Mitigação atual**: botão "Recalcular" manual continua disponível e mostra toast de erro. **Mitigação futura**: telemetria de falhas.
2. **`getLegacyValue` no drawer ainda lê chaves por nome/código** (`payload[rubric.name]`, `payload[rubric.code]`). É necessário até migrarmos as entries antigas do banco para usar `rubric.id` como chave canônica. **Não removido nesta sprint** — remoção causaria perda de dados na leitura. Migração de dados deve ser feita antes da remoção.
3. **Prévia local no drawer continua ignorando rubricas calculadas**: usuário vê "Prévia: R$ 5000" e depois "Backend: R$ 4500" (com INSS aplicado). Comportamento esperado e agora **explícito** no rótulo, mas pode confundir usuários novos. **Mitigação**: rótulo "Líquido (prévia, sem encargos)" deixa claro.
4. **Status do batch só tem `draft` hoje**: badge dinâmica está pronta para `closed`/`paid` mas não há fluxo de transição. Risco zero — apenas preparação para futuro.

---

## 7. Conclusão

A Central de Folha está **pronta para uso operacional diário** dentro do escopo já implementado:

- ✅ Selecionar empresa + competência.
- ✅ Criar lançamentos novos (com batch formal automático).
- ✅ Editar valores no drawer com prévia em tempo real.
- ✅ Ver valores calculados pelo backend (fonte de verdade) imediatamente após cada save.
- ✅ Recalcular manualmente se desejar.
- ✅ Permissões respeitadas em UI e RLS.

**Pendências para sprints futuras** (não bloqueiam uso atual):
- Motor real de cálculo de rubricas (PRD-01 etapas 3-6).
- Duplicação de folha (PRD-09).
- Recibos PDF (PRD-07).
- Relatórios consolidados (PRD-08).
- Transições de status do batch.

**Critério de aceite atendido**: nenhum cálculo crítico é feito na UI; backend é fonte única; permissões íntegras; UX clara sobre o que é prévia vs. calculado vs. pendente.
