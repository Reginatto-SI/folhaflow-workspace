# Ajuste do bloco 3 — Alinhamento do recálculo ao PRD-01

## 1. Objetivo

Realizar ajuste cirúrgico no recálculo backend mínimo já existente para alinhar a ordem lógica ao PRD-01, preservando blocos 1/2/3 e o modelo incremental atual.

## 2. Problema encontrado

- O bloco 3 original calculava INSS diretamente sobre `base_salary`, sem consolidar antes uma base fiscal transitória.
- A separação entre base fiscal e base gerencial estava implícita/fraca.
- A UI ainda tinha fallback de cálculo local em alguns componentes, mantendo comportamento “quase motor”.

## 3. Ajuste realizado

- Função backend **existente** `public.recalculate_payroll_batch(p_batch_id uuid)` foi ajustada (não foi criada função paralela).
- Nova ordem mínima implementada com contrato transitório por chaves técnicas do JSONB:
  - `salario_fiscal` > `salario_ctps` > `base_salary` (fallback) para base fiscal.
- Frontend recebeu ajuste mínimo para reduzir fallback local:
  - `TotalsBar`, `PayrollTable` e `EmployeeRowExpansion` passaram a usar backend-first com fallback zero (não recalculam mais líquido localmente).

## 4. Nova lógica aplicada

1. **Base fiscal**
   - lê `earnings['salario_fiscal']` quando existir;
   - senão, `earnings['salario_ctps']`;
   - senão, `base_salary` como fallback transitório documentado.
2. **Encargos**
   - `inss_amount` calculado exclusivamente sobre a base fiscal.
3. **Base gerencial**
   - `earnings_total` = soma determinística dos valores numéricos de `earnings`.
4. **Descontos**
   - `deductions_total` = soma determinística dos valores numéricos de `deductions`.
5. **Líquido**
   - `net_salary = earnings_total - deductions_total - inss_amount`.

## 5. Compatibilidade preservada

- Mantidos `payroll_batches`, `payroll_batch_id` e fluxo de recálculo por batch.
- Mantidos os campos materializados já criados no bloco 3:
  - `earnings_total`, `deductions_total`, `inss_amount`, `net_salary`.
- Mantido botão “Recalcular” e integração da Central com RPC.

## 6. Limitações intencionais

- Ainda não é motor completo do PRD-01.
- Não há fórmula dinâmica, dependência entre rubricas ou classificação no cálculo.
- Contrato por chave técnica JSONB (`salario_fiscal`, `salario_ctps`) é transitório até evolução do motor completo.

## 7. Riscos ou pendências

- Se chaves técnicas não estiverem presentes/normalizadas, base fiscal pode cair no fallback `base_salary`.
- INSS ainda simplificado (8%) e não cobre regime progressivo.
- Não há auditoria detalhada por etapa de cálculo nesta fase.

## 8. Próxima etapa recomendada

Evoluir o cálculo backend mantendo abordagem incremental, com validação mais forte do contrato técnico das rubricas e redução progressiva dos fallbacks transitórios.
