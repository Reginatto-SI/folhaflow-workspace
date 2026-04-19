# Diagnóstico do estado atual — `/central-de-folha` sem commit

## 1. Resumo executivo

- **Estado do workspace (forense):** no momento desta análise, o repositório está **limpo**, sem alterações locais não commitadas (`git status` sem modified/untracked).
- **Conclusão principal:** não há vestígio de “fase 1 parcialmente implementada sem commit” no estado atual do disco. O que existe já está commitado no branch atual.
- **Sobre a fase 1 da Central:** existe implementação de base para lançamentos por competência via `payroll_entries`, porém **sem batch formal**, **sem vínculo entry→batch**, **sem recálculo backend** e com **cálculo líquido/bruto ainda feito na UI**.
- **Risco macro:** arquitetura está funcional para operação básica, mas ainda em estado **híbrido/transitório** frente aos PRDs (especialmente PRD-01/03/09/10), com pontos de segurança ainda permissivos em `employees` e `payroll_entries`.

---

## 2. Arquivos alterados encontrados

### Resultado da inspeção do workspace

- `git status` retornou: **nothing to commit, working tree clean**.
- Portanto, **não foram encontrados arquivos modificados sem commit** no momento da auditoria.

### Arquivos relevantes para Central de Folha (estado atual do código, não “dirty”)

Mesmo sem alterações locais pendentes, os artefatos centrais existentes hoje são:

- Frontend Central:
  - `src/pages/Index.tsx`
  - `src/components/payroll/PayrollHeader.tsx`
  - `src/components/payroll/PayrollTable.tsx`
  - `src/components/payroll/TotalsBar.tsx`
  - `src/components/payroll/EmployeeDrawer.tsx`
- Contexto e contratos:
  - `src/contexts/PayrollContext.tsx`
  - `src/types/payroll.ts`
  - `src/integrations/supabase/types.ts`
- Banco/migrations relacionadas:
  - `supabase/migrations/20260413110000_create_payroll_entries.sql`
  - `supabase/migrations/20260418170000_employee_cpf_global_and_no_salary.sql`
  - `supabase/migrations/20260418172233_f6b94bb6-d49f-4ac5-805f-2f520a98fb0c.sql`
  - `supabase/migrations/20260418193000_harden_structure_rls_and_integrity.sql`

---

## 3. Mudanças de banco encontradas

### 3.1 `payroll_batches` ou equivalente

- **Não encontrado**.
- Não existe migration criando `payroll_batches` (ou nome equivalente de lote/folha formal).

### 3.2 `payroll_entries` e modelagem

- Existe tabela `public.payroll_entries` com:
  - `company_id`, `employee_id`, `month`, `year`, `base_salary`, `earnings` (jsonb), `deductions` (jsonb), `notes`.
  - `UNIQUE (company_id, month, year, employee_id)`.
  - índices por `(company_id, month, year)` e `employee_id`.
- **Não existe** coluna `payroll_batch_id`.
- Modelo atual é “entry por competência”, não “entry vinculada a batch formal”.

### 3.3 Backfill

- Para `payroll_entries`, a migration explicita que **não houve migração de dados legados** (modelo anterior era em memória/UI).
- Não foi encontrada rotina de backfill para vínculo com batch (porque batch não existe).

### 3.4 Constraints e índices

- Constraints/índices relevantes em `payroll_entries` estão presentes e coerentes para o modelo atual.
- Em rubricas houve endurecimento adicional de constraints (nature/method/classification), mas isso é eixo PRD-02, não resolve batch da Central.

### 3.5 Alteração parcial perigosa no banco

- **Risco principal encontrado:** `payroll_entries` foi criado com policies permissivas (`using (true)` / `with check (true)`), sem endurecimento posterior específico para `folha.operar`.
- `employees` também mantém política inicial permissiva (`*_all`) no que foi encontrado nas migrations.

---

## 4. Mudanças de RLS / segurança encontradas

## 4.1 `employees`

- Não foi encontrada migration posterior substituindo as policies abertas originais de `employees` por `has_permission(...)`.
- Situação prática: backend ainda depende de políticas amplas na tabela de funcionários (do que consta nas migrations analisadas).

### 4.2 `payroll_entries`

- Policies de `payroll_entries` continuam abertas (`select/insert/update/delete` com `true`) na migration de criação.
- Não foi encontrada migration de endurecimento desta tabela para `folha.operar` ou restrição por tenant/empresa.

### 4.3 Endurecimento real existente

- Existe endurecimento em:
  - `companies` (permissão real + sem delete físico).
  - `rubricas` e `rubrica_formula_items` (permissão `rubricas.manage`).
  - `departments/job_roles` (permissão `estrutura.view` + bloqueio de delete).
- **Não cobre o núcleo sensível da Central (`employees` + `payroll_entries`) de forma equivalente.**

### 4.4 Risco

- **Risco de acesso indevido real** no backend caso usuário autenticado consiga consultar/alterar `payroll_entries` e `employees` por ausência de restrições fortes nessas tabelas.
- A UI possui controle de rota por permissão, mas PRD-10 exige backend como segurança real (UI não basta).

---

## 5. Mudanças de backend encontradas

### 5.1 Serviços/funções para batch formal

- **Não encontrado** serviço/edge function/helper para “batch formal” da folha.
- Não há contrato de API específico para criar/abrir/fechar lote de folha.

### 5.2 Recalculo backend v1

- **Não encontrado** recálculo backend.
- Fluxo atual persiste campos (`base_salary`, `earnings`, `deductions`) já prontos, sem motor backend determinístico.

### 5.3 Coerência da lógica com modelo atual

- Coerente com modelo atual de tabela simples por competência.
- Porém, do ponto de vista PRD-01/03, permanece incompleto: o motor não é fonte de verdade.

### 5.4 Lógica incompleta / abandonada

- Há vários comentários de transição (“compat legada”, “motor será sprint futura”), indicando estado intermediário planejado.
- Não caracteriza bug por si só, mas confirma que fase de motor/backend ainda não foi concluída.

---

## 6. Mudanças de frontend encontradas

### 6.1 Central já adaptada para batch?

- **Não.** A página `/central-de-folha` opera por `selectedCompany + month/year`, consultando e salvando `payroll_entries` diretamente.
- Não há seleção/identidade de batch formal.

### 6.2 UI ainda calcula localmente?

- **Sim.** Totais bruto/desconto/líquido são calculados na UI (`TotalsBar`, `PayrollTable`, `EmployeeDrawer`) por soma local dos campos.

### 6.3 Fluxo híbrido antigo + novo

- Existe persistência real no Supabase (não mock puro).
- Ainda há elementos de compatibilidade legada (leitura por nome/código de rubrica, campos transicionais), gerando estado híbrido de evolução.

### 6.4 Risco de tela quebrada/inconsistência

- Risco maior é **inconsistência de regra de negócio** (fonte de verdade na UI e não no motor), mais do que quebra visual imediata.
- Também há risco de divergência quando rubricas derivadas/motor forem introduzidos sem migração controlada.

---

## 7. Avaliação da fase 1 por item

| Item da fase 1 | Status | Evidência | Risco | Recomendação |
|---|---|---|---|---|
| segurança | **iniciado parcialmente** | Endurecimento em companies/rubricas/estrutura; não em employees/payroll_entries | Alto | Endurecer RLS de `employees` e `payroll_entries` com permissão explícita |
| batch formal | **não iniciado** | inexistência de tabela/contrato `payroll_batches` | Alto | criar modelo formal de batch/lote |
| vínculo de entries com batch | **não iniciado** | `payroll_entries` não possui `payroll_batch_id` | Alto | adicionar FK + migração/estratégia de transição |
| leitura/gravação por batch | **não iniciado** | filtros por `company_id + month + year`; sem batch id | Alto | migrar queries para batch |
| recálculo backend | **não iniciado** | ausência de função/serviço de cálculo backend | Alto | implementar recálculo mínimo servidor |
| remoção de cálculo local da UI | **implementado de forma problemática** | UI continua calculando bruto/líquido por soma local | Médio/Alto | UI deve exibir resultado calculado pelo backend |

---

## 8. Código morto / fragmentos / inconsistências

- `src/data/mock.ts` parece **sobra não usada no runtime** (não localizado import no app), com dados potencialmente incoerentes com regras atuais.
- Comentários de transição (“compat legada”, “motor futuro”) em múltiplos pontos indicam **implementação em etapas ainda incompleta**.
- Compatibilidade de leitura por chave legada (id/código/nome) em rubricas mantém risco de comportamento híbrido enquanto não houver saneamento definitivo.
- Não foram encontrados arquivos “novos e abandonados sem commit” porque o workspace está limpo.

---

## 9. O que pode ser reaproveitado

- Estrutura da Central já conectada ao backend (`payroll_entries`) para CRUD básico por competência.
- Migração de `payroll_entries` com constraints e índices úteis para base operacional inicial.
- Evolução de rubricas (nature/method/classification) como fundação do motor futuro.
- Infra de permissões (`has_permission`, roles, PermissionRoute) já disponível para endurecimento adicional.

---

## 10. O que deve ser descartado ou refeito

- **Não há artefato sem commit para descartar** (workspace limpo).
- Conceitualmente, deve ser **refeito/ajustado** para fase 1 real:
  - Dependência de cálculo local da UI como fonte de verdade.
  - Falta de batch formal e vínculo de entries.
  - RLS permissivo em `employees` e `payroll_entries`.
- `src/data/mock.ts` pode ser candidato a remoção/isolamento melhor quando confirmado que não é necessário em testes.

---

## 11. Recomendação final

### Vale continuar por cima do estado atual?

- **Sim, com limpeza parcial planejada**, não recomeço total.

### Vale ignorar parcialmente?

- **Sim.** Ignorar/encapsular partes transitórias de UI local-calc e compat legada à medida que batch+motor entrarem.

### Vale reiniciar logicamente do zero?

- **Não recomendado** neste momento: já existe base útil reaproveitável (CRUD, estrutura de dados, permissões base).

### Menor estratégia segura para próxima etapa

1. Endurecer RLS de `employees` e `payroll_entries` com `has_permission` + escopo de acesso apropriado.
2. Introduzir `payroll_batches` e `payroll_batch_id` em `payroll_entries` (com transição compatível).
3. Criar recálculo backend mínimo e trocar a UI para consumir resultado calculado (não calcular regra de negócio localmente).
4. Só então remover compatibilidades legadas e limpar sobras.

---

## Observações de incerteza explícita

- Não foram encontrados os CSVs citados (esquema e RLS) no workspace durante esta auditoria; a análise estrutural foi feita diretamente pelas migrations e tipos gerados do Supabase.
- Como não há alterações locais sem commit, a auditoria “forense sem commit” conclui ausência de pending changes no estado atual do branch analisado.
