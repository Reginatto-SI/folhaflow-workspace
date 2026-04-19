# 1. Resumo da correção aplicada

Foi aplicada uma correção mínima e localizada em três frentes:

- **Backend (RPC de recálculo)**: removido cálculo automático de INSS e removida subtração extra de INSS no líquido.
- **Central (drawer)**: removida comunicação visual de INSS como “valor calculado backend”.
- **Rubricas**: adicionada validação explícita para garantir que `classification = inss` só seja aceita como `desconto + base + manual`.

Motivo da mudança: alinhar o sistema aos PRDs atualizados (INSS manual, operacional, sem sobrescrita pelo motor).

---

# 2. Arquivos modificados

- `supabase/migrations/20260419170000_fix_inss_manual_rule.sql`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Rubrics.tsx`

---

# 3. Problema raiz corrigido

## Backend

- `recalculate_payroll_batch` não calcula mais INSS por percentual.
- `inss_amount` permanece por compatibilidade, mas agora é apenas espelho agregado do valor manual já persistido em `deductions` (por `rubric.id` classificada como `inss`, com fallback legado por chave `inss`).
- `net_salary` passa a ser calculado como `earnings_total - deductions_total`, evitando dupla incidência de INSS.

## Central

- No drawer, o bloco backend foi mantido para totais consolidados, mas o campo de INSS calculado foi removido.
- Ajuste semântico mínimo para não comunicar INSS como valor manual e calculado ao mesmo tempo.

## Rubricas

- Frontend agora bloqueia combinação incompatível quando `classification = inss`.
- Validação no contexto (`validateRubricPayload`) reforça mesma regra.
- Constraint SQL (`rubricas_inss_manual_rule`) adicionada como defesa em profundidade.

---

# 4. O que foi preservado

- Arquitetura geral da aplicação.
- Fluxo existente de save + recalculate.
- Demais derivados fora do escopo (não alterados).
- Compatibilidade com campo `inss_amount` (mantido).
- Recibos, relatórios e duplicação não foram reescritos/refatorados.

---

# 5. Testes executados

## Cenário 1 — INSS manual
- Cobertura indireta pelo ajuste de recálculo: valor de INSS vem de `deductions` persistido, sem recomputação automática.
- Resultado esperado no código: recálculo não altera input manual de INSS.

## Cenário 2 — sem cálculo automático
- Verificado no SQL: não existe mais fórmula de INSS por percentual no recálculo.
- Resultado esperado no código: sem INSS informado, não surge INSS calculado automaticamente.

## Cenário 3 — Central coerente
- Verificado no drawer: removida linha de INSS do bloco backend.
- Resultado esperado: UI não mostra INSS manual e INSS “calculado backend” em duplicidade.

## Cenário 4 — líquido
- Verificado no SQL: `net_salary = earnings_total - deductions_total`.
- Resultado esperado: líquido coerente com descontos operacionais persistidos.

## Cenário 5 — rubrica INSS
- Verificado no front/contexto + constraint SQL: `classification=inss` exige `desconto + base + manual`.
- Resultado esperado: configuração incompatível é bloqueada.

## Execução técnica

- `npm run test -- --run` ✅ (passou)
- `npm run lint` ⚠️ (falhou por erros preexistentes fora do escopo)

---

# 6. Riscos remanescentes

- A constraint `rubricas_inss_manual_rule` foi criada como `NOT VALID` para manter rollout seguro sem travar legado; ainda depende de validação posterior dos dados históricos.
- O fallback por chave textual `inss` no recálculo existe para compatibilidade transitória e pode ser removido após saneamento completo de dados legados.

---

# 7. Checklist final

- [x] INSS não é mais calculado automaticamente
- [x] INSS manual não é sobrescrito
- [x] Central não comunica INSS como cálculo backend
- [x] rubrica INSS ficou coerente com o PRD
- [x] sem refatoração desnecessária
