# Análise 2 — Implementação mínima do executor de fórmulas no backend

## Resumo do que foi alterado

Foi implementada uma evolução pontual do recálculo oficial da folha no backend para que rubricas com `nature = calculada` e `calculation_method = formula` sejam efetivamente executadas no servidor, sem hardcode por nome.

Mudanças principais:

1. **Funções auxiliares SQL de motor**
   - `payroll_parse_jsonb_numeric`: normalização segura de números no payload JSONB.
   - `payroll_extract_payload_value`: leitura de valor por chave técnica (`rubrica.id`) com fallback de compatibilidade por `rubrica.code`.
   - `payroll_eval_formula_expression`: avaliador matemático seguro com suporte a `+`, `-`, `*`, `/` e parênteses, bloqueando caracteres inválidos e referências inexistentes.

2. **Evolução de `recalculate_payroll_batch`**
   - carrega rubricas ativas;
   - valida referências de fórmula inexistentes;
   - monta grafo de dependência entre rubricas calculadas por fórmula;
   - executa ordenação topológica;
   - interrompe com erro em caso de ciclo;
   - executa fórmulas e materializa resultados derivados em `earnings`/`deductions` por `rubrica.id`;
   - recalcula totais finais e retorna para a Central.

---

## Arquivos modificados

- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
- `public/Analises/analise-2-implementacao-motor-formulas.md`

---

## Fluxo novo do cálculo

1. Usuário dispara recálculo da folha (fluxo já existente).
2. Backend valida permissão `folha.operar`.
3. Backend carrega rubricas ativas e tokens técnicos por rubrica.
4. Backend valida se há fórmula com referência inexistente no cadastro.
5. Backend monta dependências entre rubricas calculadas por fórmula e resolve ordem topológica.
6. Para cada `payroll_entry` do batch:
   - hidrata valores operacionais existentes;
   - executa derivadas simples (`valor_fixo`, `percentual`) quando aplicável;
   - executa fórmulas (`formula`) em ordem de dependência;
   - materializa derivadas no payload;
   - recalcula totais (`earnings_total`, `deductions_total`, `inss_amount`, `net_salary`).
7. Central continua só consumindo o retorno do backend.

---

## O que foi reaproveitado

- Tabela `rubricas` (contrato técnico existente).
- Tabela `rubrica_formula_items` (estrutura de composição já existente).
- RPC oficial `recalculate_payroll_batch` (mesmo ponto único de execução).
- Estrutura de `payroll_entries` (`earnings`, `deductions`, totais materializados).
- Fluxo de consumo já existente na Central (sem mudança de layout/UI).

---

## O que ainda ficou pendente

1. **UI de Rubricas ainda modela fórmula por itens**
   - O backend agora tem avaliador com suporte a parênteses, mas a UI atual ainda não expõe digitação de expressão textual com parênteses.

2. **Sem suíte automatizada integrada ao banco no repositório atual**
   - Foram definidas validações manuais/SQL abaixo para os casos obrigatórios.

3. **Compatibilidade legada por código**
   - Mantido fallback por `rubrica.code` para não quebrar dados antigos; alvo futuro é operar 100% por `rubrica.id`.

---

## Riscos residuais

1. Dados legados com códigos fora do padrão esperado podem exigir saneamento.
2. Fórmulas historicamente cadastradas sem itens válidos agora passam a falhar explicitamente.
3. Rubricas percentuais com base ausente também passam a falhar explicitamente.
4. Performance deve ser monitorada em lotes grandes (o fluxo priorizou segurança e rastreabilidade).

---

## Como validar manualmente

> Observação: executar em ambiente de homologação com dados controlados.

### Caso 1 — Fórmula simples

- Configurar rubrica calculada com fórmula equivalente a: `salario_real = salario_g - inss`.
- Garantir que os itens da fórmula apontem para rubricas corretas.
- Recalcular batch.
- Esperado: valor de `salario_real` materializado no payload e refletido nos totais.

### Caso 2 — Múltiplas dependências

- Configurar rubrica `salario_liquido` com itens equivalentes a:
  `salario_g + outros_rendimentos + horas_extras - inss - vales - faltas`.
- Recalcular batch.
- Esperado: resultado exatamente igual à composição cadastrada.

### Caso 3 — Dependência entre calculadas

- Configurar `g2_complemento` referenciando rubrica calculada anterior + rubricas base.
- Recalcular batch.
- Esperado: execução em cascata respeitando ordem topológica.

### Caso 4 — Dependência circular

- Criar ciclo entre duas rubricas calculadas por fórmula.
- Recalcular batch.
- Esperado: erro explícito `dependência circular detectada` e sem resultado silencioso incorreto.

### Caso 5 — Referência inexistente

- Inserir item de fórmula apontando para rubrica inexistente/inativa.
- Recalcular batch.
- Esperado: erro explícito de referência inexistente e interrupção do cálculo.

---

## SQL de apoio para inspeção

```sql
-- Ver rubricas calculadas de fórmula ativas
select id, code, type, nature, calculation_method
from public.rubricas
where is_active = true
  and nature = 'calculada'
  and calculation_method = 'formula'
order by code;

-- Ver composição cadastrada por rubrica
select r.code as formula_code, fi.item_order, fi.operation, src.code as source_code
from public.rubrica_formula_items fi
join public.rubricas r on r.id = fi.rubrica_id
join public.rubricas src on src.id = fi.source_rubrica_id
order by r.code, fi.item_order;

-- Após recálculo: inspecionar payload materializado
select id, earnings, deductions, earnings_total, deductions_total, net_salary
from public.payroll_entries
where payroll_batch_id = :batch_id;
```
