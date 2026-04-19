# Bloco 3 — Recalculo backend da folha

## 1. Objetivo

Implementar recálculo backend mínimo, determinístico e confiável para a Central, usando o modelo atual (`payroll_batches` + `payroll_entries` com JSONB), para tirar da UI a responsabilidade do cálculo final.

## 2. Como funcionava antes

- A UI somava localmente `earnings` e `deductions` para exibir totais e líquido.
- Não havia rotina backend única para recálculo da folha por batch.
- O sistema não tinha uma função de backend atuando como fonte de verdade mínima para resultado calculado.

## 3. Como funciona agora

- Foi criada a função backend `public.recalculate_payroll_batch(p_batch_id uuid)`.
- A função recalcula todas as entries do batch e persiste os resultados em colunas simples de `payroll_entries`.
- A Central ganhou ação explícita de recálculo (botão “Recalcular”) que chama o backend e atualiza estado local com retorno da função.
- A UI passou a priorizar campos calculados no backend (`earnings_total`, `deductions_total`, `inss_amount`, `net_salary`) com fallback transitório para legado.

## 4. Lógica implementada

Para cada `payroll_entry` do batch:

- `earnings_total` = soma determinística dos valores numéricos em `earnings` (JSONB)
- `deductions_total` = soma determinística dos valores numéricos em `deductions` (JSONB)
- `inss_amount` = `base_salary * 0.08` (regra simplificada desta fase)
- `net_salary` = `earnings_total - deductions_total - inss_amount`

Observações:
- sem dependência de nome/classificação de rubrica;
- sem motor completo de fórmulas;
- sem inferência por texto além do parsing numérico mínimo para valores string válidos.

## 5. Integração com a Central

- `PayrollContext` agora expõe `recalculatePayrollBatch()`.
- `PayrollHeader` chama esse método no botão “Recalcular”.
- O retorno do RPC atualiza `allPayrollEntries`, refletindo valores calculados sem depender de cálculo final na UI.

## 6. Limitações intencionais

- Não é motor completo de rubricas (PRD-01 completo fica para próximos blocos).
- INSS simplificado fixo em 8% (sem tabela progressiva).
- Não houve duplicação de folha, fechamento, recibos ou relatórios.
- Não houve reestruturação de JSONB nem refatoração estrutural ampla.

## 7. Riscos

- Regra simplificada de INSS pode divergir do cálculo real esperado em cenários fiscais completos.
- Enquanto houver fallback transitório na UI, parte da visualização ainda tolera legado não recalculado.
- Campos calculados ficam no mesmo registro operacional (simples e pragmático), sem trilha detalhada de auditoria por etapa.

## 8. Próximo passo

Implementar bloco 4 com evolução gradual do cálculo (ainda backend-first), aumentando fidelidade das regras sem quebrar o modelo incremental atual.
