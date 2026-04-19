# Análise 3 — Ajuste do motor de fórmulas sem dupla contagem

## Resumo do ajuste

Foi feito ajuste cirúrgico no patch do executor para corrigir inflação de totais:

- Rubricas derivadas continuam sendo calculadas e materializadas no payload (`earnings`/`deductions`) para consumo da UI/documentos.
- `earnings_total` e `deductions_total` passam a somar somente rubricas operacionais (`nature = base`), evitando re-somar derivados.
- Parsing numérico foi endurecido para não converter valor inválido em `0` silenciosamente.

---

## Problema exato corrigido

### 1) Dupla contagem
Antes, o total somava todo o JSON (`jsonb_each`) e, portanto, incluía derivados já calculados, inflando totais e líquido em cenários com rubricas como `salario_real`, `g2_complemento`, `salario_liquido`.

### 2) Falha silenciosa de dado inválido
Antes, `payroll_parse_jsonb_numeric` convertia entradas inválidas para `0`, mascarando erro relevante.

---

## Como os totais passam a ser compostos

Agora os totais são compostos por loop explícito sobre catálogo ativo com `nature = base`:

- `earnings_total`: soma apenas rubricas-base do tipo `provento`.
- `deductions_total`: soma apenas rubricas-base do tipo `desconto`.

Rubricas derivadas calculadas (`nature = calculada`) não entram na soma operacional.

---

## Como os derivados permanecem disponíveis

A materialização de derivados foi preservada:

- durante o recálculo, rubricas calculadas continuam sendo escritas em `earnings`/`deductions` por `rubrica.id`;
- portanto, Central/drawer/recibos/relatórios continuam podendo consumir esses valores do backend.

A mudança foi apenas na etapa de composição dos totais operacionais.

---

## Fonte real da fórmula executada

Nesta versão, a fonte oficial executada é **estruturada por itens**:

- tabela `rubrica_formula_items`
- operadores por item: `add` e `subtract`
- ordem por `item_order`

Não há, no cadastro atual, campo textual oficial de fórmula livre.

---

## Operadores realmente suportados nesta versão

### No cadastro oficial atual
- `+` e `-` (via `operation` em `rubrica_formula_items`)

### No avaliador interno
- o avaliador suporta `+ - * / ( )`, mas a expressão efetivamente enviada hoje é gerada a partir de itens `add/subtract`.
- Ou seja: suporte pleno de parênteses na prática depende da evolução do contrato de cadastro (não foi inventada “fórmula textual” nesta etapa).

---

## Arquivos alterados

- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
- `public/Analises/analise-3-ajuste-motor-formulas-sem-dupla-contagem.md`

---

## Riscos residuais

1. Se existir dado legado com tipo JSON inválido em campos de valor, o recálculo agora falha explicitamente (comportamento intencional de segurança).
2. Como a fonte oficial de fórmula ainda é por itens, limitações estruturais do cadastro permanecem até evolução específica do PRD-02 no UI/contrato.
3. Compatibilidade por fallback de código (`rubrica.code`) continua transitória para não quebrar legado.

---

## Como validar manualmente

1. Configurar rubricas derivadas (`salario_real`, `g2_complemento`, `salario_liquido`) com itens válidos.
2. Recalcular batch.
3. Confirmar:
   - derivados existem em `earnings`/`deductions`;
   - `earnings_total`/`deductions_total` não sobem por causa dos derivados.
4. Inserir valor inválido (string não numérica) em payload operacional e recalcular.
5. Confirmar erro explícito de valor inválido (sem fallback silencioso para zero).

SQL de inspeção sugerido:

```sql
select id, earnings, deductions, earnings_total, deductions_total, net_salary
from public.payroll_entries
where payroll_batch_id = :batch_id
order by created_at desc;
```
