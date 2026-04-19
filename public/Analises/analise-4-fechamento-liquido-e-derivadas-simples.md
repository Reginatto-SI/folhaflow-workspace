# Análise 4 — Fechamento de líquido e derivadas simples

## Resumo do ajuste

Ajuste final e pontual no executor SQL para fechar dois gaps remanescentes:

1. `net_salary` agora usa a rubrica derivada oficial de líquido quando ela existir.
2. Rubricas calculadas de método `valor_fixo` e `percentual` passam a ser materializadas no payload final (`earnings`/`deductions`), não só no mapa interno de cálculo.

---

## Como `net_salary` passa a ser definido

Ordem aplicada:

1. Busca rubrica calculada ativa com código técnico canônico `salario_liquido`.
2. Se existir, `net_salary` recebe o valor materializado dessa rubrica no payload (por `rubrica.id`).
3. Se não existir, aplica fallback de segurança: `earnings_total - deductions_total`.

Além disso, se a rubrica `salario_liquido` existir mas não estiver materializada no payload, o backend falha com erro explícito (evita resultado silencioso incorreto).

---

## Como derivadas simples passam a ser materializadas

Durante o loop de cálculo por rubrica:

- quando `nature = calculada` e `calculation_method in ('valor_fixo', 'percentual')`,
- o valor calculado é gravado no payload final:
  - `earnings[rubrica.id]` para proventos;
  - `deductions[rubrica.id]` para descontos.

Com isso, UI e documentos continuam recebendo derivadas por fórmula **e** derivadas simples de forma uniforme.

---

## Critério técnico usado para identificar a rubrica do líquido

Critério aplicado nesta versão:

- `rubricas.code = 'salario_liquido'`
- `nature = 'calculada'`

Justificativa técnica:

- no modelo atual, rubricas derivadas não possuem classificação (por PRD);
- portanto o `code` canônico da rubrica é o identificador técnico estável disponível para mapear o líquido sem heurística por nome de exibição.

---

## Arquivos alterados

- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
- `public/Analises/analise-4-fechamento-liquido-e-derivadas-simples.md`

---

## Riscos residuais

1. Caso existam ambientes sem rubrica `salario_liquido`, o fallback permanece ativo por compatibilidade.
2. Se cadastro/configuração de `salario_liquido` estiver inconsistente (existe mas não materializa), o recálculo falha explicitamente (comportamento intencional).
3. A identificação por `code` depende de manter o código técnico canônico conforme PRD.

---

## Como validar manualmente

1. Cenário com rubrica derivada `salario_liquido` ativa:
   - recalcular batch;
   - confirmar que `net_salary` == valor da rubrica `salario_liquido` materializada.

2. Cenário sem rubrica `salario_liquido`:
   - recalcular batch;
   - confirmar fallback `net_salary = earnings_total - deductions_total`.

3. Rubrica calculada `valor_fixo`:
   - cadastrar e recalcular;
   - confirmar presença no payload por `rubrica.id` (`earnings` ou `deductions`).

4. Rubrica calculada `percentual`:
   - cadastrar base + percentual e recalcular;
   - confirmar presença no payload por `rubrica.id`.

5. Sanidade de totais:
   - garantir que `earnings_total`/`deductions_total` continuam somando apenas rubricas-base.
