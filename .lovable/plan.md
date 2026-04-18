

## Diagnóstico da análise

A análise está **direcionalmente correta** mas mistura saneamento de cadastro com **motor de cálculo** — que esta sprint explicitamente **não deve tocar** (definido nas sprints anteriores).

### O que faz sentido (e está alinhado a sprints anteriores):
- Reconhecer formalmente que **Salário Real, G2, Salário Líquido, Salário Fiscal** são **derivadas** (output), não inputs operacionais.
- Bloquear edição manual delas na Central de Folha.
- Não exigir `classification` para `nature = calculada` (já é o caso na prática — pendentes são todas calculadas exceto Salário Fiscal).
- Reforçar regra: **nome nunca define comportamento**.

### O que NÃO devo fazer agora (e por quê):
- **Implementar fórmulas de salario_real / salario_liquido**: o motor de cálculo (PRD-01) está fora de escopo declarado de todas as sprints anteriores. Hoje a Central de Folha agrupa por nome via `EmployeeDrawer.groupedRubrics` (legado) — mexer em fórmula sem migrar a Central primeiro produz inconsistência.
- **Criar fórmula automaticamente** para as 3 rubricas calculadas: já existem com `calculation_method=formula` mas com `formulaItems` vazio. Preencher fórmula é decisão funcional, não estrutural — admin deve montar pela UI quando o motor estiver pronto.
- **"salario_fiscal" como derivada**: hoje está cadastrada como `nature=base` (input manual). Mudar para `calculada` sem regra de cálculo a quebra como input. Análise diz "não recalcular agora, manter como placeholder" — então **deixar exatamente como está** (base, manual, classificação pendente). Vou apenas documentar.

---

## Plano: ajuste estrutural mínimo (sem motor)

### 1. Schema — relaxar regra de classificação para rubricas calculadas

Hoje o CHECK constraint `rubricas_active_requires_classification` exige classificação em qualquer rubrica ativa. PRD-02 + análise dizem: **calculadas (derivadas) não devem ter classificação**.

Migration:
- Atualizar CHECK: `is_active = false OR nature = 'calculada' OR classification IS NOT NULL`.
- Adicionar CHECK novo: `nature <> 'calculada' OR classification IS NULL` (proíbe classificação em derivada).

### 2. `validateRubricPayload` (PayrollContext) — espelhar regras

- Se `nature = calculada` → `classification` deve ser `null` (rejeita se preenchido).
- Se `nature = base` e `isActive` → `classification` continua obrigatória (já é).
- Se `nature = calculada` → forçar `allowManualOverride = false` (derivada não é editável manual; é output).

### 3. UI `/rubricas` — refletir natureza derivada

- Aba **Classificação**: quando `nature = calculada`, esconder seletor e mostrar texto: "Rubricas calculadas são saídas do sistema — não recebem classificação técnica."
- Aba **Dados**: ao alternar `nature` para `calculada`, limpar `classification` no form e desabilitar checkbox "Permitir edição manual".
- Tabela: badge **"Derivada"** (cor neutra) na coluna Classificação para `nature = calculada`, em vez de "Pendente" vermelho.
- Banner de pendência: contar apenas rubricas **`nature = base` ativas sem classificação** (hoje conta as 4; passa a contar só Salário Fiscal = 1, que é pendente real).

### 4. `EmployeeDrawer` (Central de Folha) — bloqueio defensivo de edição

Mudança mínima e cirúrgica (não toca agrupamento):
- Já filtra `isBaseRubric` para "Rubricas-base"; mas nas seções "Proventos" e "Descontos" entram derivadas (`nature=calculada`).
- Filtrar derivadas dessas seções: derivada **não é input**, então não aparece como campo editável.
- Não criar seção "Saídas calculadas" agora (depende do motor) — derivadas simplesmente somem do drawer até o motor existir. Funcionalmente: hoje elas já estão sempre em zero, então remover não muda nada operacional.

### 5. Documentação no código

Comentário de bloco no topo de `Rubrics.tsx` e `EmployeeDrawer.tsx`:
- "Rubricas com `nature=calculada` são DERIVADAS (output do motor de cálculo, PRD-01). Não recebem classificação, não são editáveis manualmente, não aparecem como input na Central de Folha. O cálculo real será implementado quando o motor for ativado em sprint futura."

---

## O que **NÃO** será feito (com justificativa)

| Item da análise | Por que não agora |
|---|---|
| Implementar fórmula `salario_real = soma(7 classificações)` | Motor de cálculo (PRD-01) fora de escopo. Central de Folha ainda agrupa por nome legado — implementar fórmula sem migrar agrupamento gera divergência. |
| Implementar `salario_liquido = salario_real - descontos + g2` | Idem. |
| Mudar `Salário Fiscal` (#3) de base → calculada | Análise mesma diz "não recalcular agora, manter placeholder". Hoje é base manual; permanece como pendência de classificação real (admin decide depois). |
| Criar `formulaItems` automaticamente para Salário Real/G2/Líquido | Decisão funcional do admin via UI quando motor existir. Não inventar. |
| Migrar Central de Folha para agrupar por `classification` | Sprint futura — depende de o admin classificar Salário Fiscal e do motor. |

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Relaxa CHECK para permitir calculada sem classificação; novo CHECK proíbe classificação em calculada |
| `src/contexts/PayrollContext.tsx` | `validateRubricPayload`: regras para `nature=calculada` (sem classificação, sem manual override) |
| `src/pages/Rubrics.tsx` | UI: esconde classificação para calculada, badge "Derivada", banner conta só base ativas sem classificação |
| `src/components/payroll/EmployeeDrawer.tsx` | Filtra `nature=calculada` das seções Proventos/Descontos (não são inputs) |

---

## Resultado esperado

- **Contrato técnico** alinhado: `nature=calculada` ⇒ output, sem classificação, sem edição manual.
- **3 rubricas derivadas** (Salário Real, G2, Líquido) saem do banner de pendência (são derivadas, não pendentes).
- **1 rubrica realmente pendente**: Salário Fiscal (#3) — admin classifica quando decidir o papel dela.
- **Central de Folha** deixa de mostrar derivadas como campo editável (defesa).
- **Motor de cálculo continua não implementado** — derivadas existem como cadastro, valor permanece zero até o motor ser ativado em sprint dedicada.

### Critério final
Base de rubricas **estruturalmente pronta**. Falta apenas:
1. Admin classificar Salário Fiscal (1 ação manual).
2. Sprint futura: implementar motor + migrar agrupamento da Central de Folha por `classification`.

