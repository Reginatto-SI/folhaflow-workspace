# Análise técnica e funcional — botão **Recalcular** na Central de Folha

## Escopo e fonte de verdade
Análise realizada exclusivamente com evidência de código e PRDs obrigatórios:

- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-09 — Duplicação de Folha de Pagamento.txt`

---

## 1) Onde o botão `Recalcular` está implementado

O botão está no header da Central:

- **Arquivo**: `src/components/payroll/PayrollHeader.tsx`
- **Implementação**: botão `Recalcular` chama `handleRecalculate`, que dispara `recalculatePayrollBatch()` do contexto e mostra toast de sucesso/erro.

Resumo do fluxo do botão:
1. usuário clica em **Recalcular**;
2. `handleRecalculate` ativa loading local (`isRecalculating`);
3. chama `recalculatePayrollBatch()`;
4. exibe toast;
5. desativa loading.

---

## 2) Qual função ele chama hoje

Função acionada:

- `recalculatePayrollBatch` em `src/contexts/PayrollContext.tsx`.

Implementação atual:
- garante batch atual com `ensureCurrentBatch()`;
- chama RPC Supabase: `supabase.rpc("recalculate_payroll_batch", { p_batch_id: batch.id })`;
- mapeia o retorno da RPC;
- substitui os lançamentos desse batch no estado `allPayrollEntries`.

---

## 3) O que essa função faz de fato

A função **não** recalcula no frontend; ela dispara recálculo no backend e traz dados já recalculados.

### No backend (`recalculate_payroll_batch`)
A função SQL:
- resolve rubricas ativas e dependências de fórmula;
- calcula rubricas derivadas (fixo, percentual e fórmula);
- materializa valores derivados no JSON de `earnings`/`deductions`;
- recalcula `earnings_total`, `deductions_total`, `inss_amount`, `net_salary`;
- persiste tudo em `payroll_entries`;
- retorna os registros do batch.

Logo, o botão atualmente representa **reprocessamento persistido de batch**, não “preview de cálculo de tela”.

---

## 4) Verificação do comportamento por critério solicitado

### 4.1 Recalcula estado local?
**Parcialmente**. Ele atualiza estado local **com retorno do backend**; não é cálculo local em tempo real.

### 4.2 Recarrega do backend?
**Sim**. Via RPC `recalculate_payroll_batch`.

### 4.3 Reconstrói linhas/totais?
- **Persistência backend**: sim (totais e derivados são recalculados e gravados).
- **UI da Central (tabela/cards/drawer)**: em geral **não depende** disso para exibir resultado, pois calcula localmente por `computeSpreadsheetEntry`.

### 4.4 Sincroniza drawer/tabela/cards?
A sincronização visual principal já ocorre pelo cálculo local compartilhado:
- Drawer: `computeSpreadsheetEntry` em preview local;
- Tabela: `computeSpreadsheetEntry` por linha;
- Totais: `computeSpreadsheetEntry` para consolidado.

Portanto, o botão não é pré-requisito da sincronização visual da Central.

### 4.5 Corrige inconsistências após salvar?
- Para a experiência visual da Central: **não é necessário**.
- Para materialização backend de derivados/totais persistidos: **sim**, porque `updatePayrollEntry` só atualiza base/manual/notes e não executa recálculo automático de batch.

### 4.6 É necessária após duplicação?
**Tecnicamente, sim para persistência final**, porque a duplicação backend (`duplicate_payroll_batch`) cria destino com totais zerados e remove rubricas derivadas canônicas, esperando recálculo posterior.

### 4.7 É redundante com cálculo automático do frontend?
Para feedback operacional da Central: **sim, é redundante**.
Para reprocessamento persistido do backend: **não**.

---

## 5) Cenários reais em que o usuário ainda precisa clicar

### Cenários em que **NÃO precisa** para a Central “ficar certa na tela”
1. edição no drawer (preview local recalcula sem salvar);
2. leitura da tabela;
3. barra de totais;
4. salvar edição manual;
5. trocar competência e reabrir folha para continuar edição visual.

### Cenários em que o clique **ainda tem papel técnico real**
1. quando se deseja **materializar no banco** os derivados e totais do batch após mudanças;
2. após duplicação de folha (quando usada), para deixar a nova folha com valores persistidos recalculados no backend.

---

## 6) Dependências ocultas por fluxo solicitado

### Edição inline / drawer
Não há dependência funcional do botão para cálculo visual correto.

### Salvar
`updatePayrollEntry` persiste valores manuais e não dispara recálculo de batch automaticamente.
Se o processo exigir derivados/totais persistidos atualizados imediatamente no banco, o botão (ou outro gatilho backend) é necessário.

### Troca de competência
Não depende do botão para renderizar valores na UI.

### Duplicação de folha
Há dependência técnica de recálculo posterior para consolidar persistência, já que a cópia sanitiza derivadas e inicia totais zerados.

### Reabertura da folha
Para operação visual da Central, não depende do botão; para consistência de campos persistidos derivados/totais, pode depender.

---

## 7) Alinhamento com PRDs

### Pontos que empurram para “redundante na UX da Central”
- PRD-01 define comportamento de planilha: cálculo imediato no frontend e usuário sem depender de salvar/RPC para ver resultado.
- PRD-01 exige sincronia entre drawer/tabela/totais pela mesma lógica local.

### Pontos que preservam papel de “reprocessar”
- PRD-00 e PRD-03 ainda listam `recalcular` como ação principal da Central.
- PRD-09 exige revisão + recálculo após duplicação e reforça que duplicação não é cálculo definitivo.

Conclusão de alinhamento: os PRDs estão parcialmente tensionados entre “planilha com cálculo local imediato” e “ação explícita de recálculo para consolidação”. O código atual materializa exatamente essa dualidade.

---

## 8) Conclusão final

## **Opção C — Deve manter, mas com outro nome/papel**

### Diagnóstico objetivo
- Se o objetivo do botão for “fazer a Central calcular e sincronizar a tela”, ele está **comunicando papel errado** (porque isso já acontece automaticamente no frontend).
- Se o objetivo for “reprocessar e consolidar a folha no backend/persistência”, então ele tem função técnica real e válida.

### Decisão
**Manter a ação por enquanto, mas tratar semanticamente como reprocessamento backend (não como cálculo de tela).**

Nome/papel mais preciso (conceitualmente):
- `Reprocessar folha` / `Consolidar no backend`.

Isso evita remover uma função que hoje ainda é útil para consistência persistida (especialmente pós-duplicação), sem confundir o usuário sobre o cálculo imediato da interface.

---

## 9) Arquivos investigados

### Código
- `src/components/payroll/PayrollHeader.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/lib/payrollSpreadsheet.ts`
- `src/components/payroll/PayrollTable.tsx`
- `src/components/payroll/TotalsBar.tsx`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/components/payroll/EmployeeDrawer.test.tsx`
- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
- `supabase/migrations/20260419203000_guard_duplicate_derived_rubrics.sql`

### PRDs
- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-09 — Duplicação de Folha de Pagamento.txt`
