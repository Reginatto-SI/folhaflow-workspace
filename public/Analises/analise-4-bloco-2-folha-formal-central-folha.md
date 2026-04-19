# Bloco 2 — Folha formal da Central de Folha

## 1. Objetivo

Implementar a estrutura formal mínima de folha por empresa+competência com `payroll_batches`, vincular `payroll_entries` a essa entidade e ajustar a Central com a menor mudança segura possível.

## 2. Diagnóstico estrutural

- Antes deste bloco, a Central agrupava implicitamente por `company_id + month + year` dentro de `payroll_entries`, sem entidade de cabeçalho formal da folha.
- Isso dificultava evolução incremental para duplicação/fechamento e deixava o conceito de folha formal ausente na modelagem.

## 3. Mudanças de banco

- Tabela criada: `public.payroll_batches`.
  - Campos: `id`, `company_id`, `month`, `year`, `status`, `created_at`, `updated_at`.
  - `status` inicial simples com foco em `draft`.
  - Unique por `(company_id, month, year)`.
- Coluna criada em `public.payroll_entries`:
  - `payroll_batch_id` (FK para `payroll_batches(id)`).
- Constraint/FK/índices:
  - índice de busca por batch em `payroll_entries_payroll_batch_id_idx`.
  - FK `payroll_entries_payroll_batch_id_fkey`.
- Backfill conservador:
  - `INSERT ... SELECT DISTINCT` cria batches por agrupamento existente (`company_id, month, year`) com `ON CONFLICT DO NOTHING`.
  - `UPDATE ... FROM payroll_batches` vincula cada `payroll_entry` ao batch correspondente.
  - Constraints antigas e colunas antigas (`company_id`, `month`, `year`) foram preservadas nesta etapa.

## 4. Mudanças de frontend/backend

- Arquivos alterados:
  - `src/contexts/PayrollContext.tsx`
  - `src/types/payroll.ts`
  - `src/integrations/supabase/types.ts`
- A Central passou a localizar/criar batch mínimo por empresa+competência via `upsert` em `payroll_batches`.
- A leitura de entries prioriza vínculo por `payroll_batch_id`, mantendo fallback transitório para entries legadas sem vínculo preenchido.
- Novos lançamentos são salvos com `payroll_batch_id` vinculado ao batch corrente.

## 5. Compatibilidade preservada

- Modelo atual foi mantido:
  - `payroll_entries` continua com `company_id`, `month`, `year`, `earnings`, `deductions` (JSONB).
  - filtros visuais por empresa/mês/ano permanecem.
- Não houve redesign de UI, nem mudança de navegação da Central.
- A unique existente em `payroll_entries` não foi removida/substituída neste bloco.

## 6. Limitações intencionais

- Sem recálculo backend.
- Sem duplicação de folha.
- Sem fechamento/status avançado de folha.
- Sem recibos/relatórios.
- Sem refatoração ampla da modelagem de rubricas ou da estrutura de entries.

## 7. Riscos ou pendências

- `payroll_batch_id` ainda não foi tornado `NOT NULL` para preservar transição segura com legado.
- Regras adicionais de integridade cruzada (garantir coerência entre batch e campos legados) podem ser endurecidas em bloco posterior.
- O status de batch está propositalmente minimalista (`draft`) nesta fase.
- Não foram localizados CSVs de esquema/RLS no workspace; validação estrutural foi feita por migrations e tipos existentes.

## 8. Próxima etapa recomendada

Implementar bloco 3 focando em recálculo backend mínimo, ainda sem duplicação e sem redesign, reaproveitando a folha formal já criada.
