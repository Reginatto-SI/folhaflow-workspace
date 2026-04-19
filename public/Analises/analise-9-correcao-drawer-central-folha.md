# 1. Resumo da correção aplicada

- Corrigido o contrato de persistência do drawer para que **rubricas-base também sejam salvas em `earnings` por `rubric.id`**, além do `baseSalary` agregado já existente.
- Removida a reconstrução heurística de reidratação que colocava `baseSalary` apenas na primeira rubrica-base.
- Ajustado o parse monetário pt-BR para remover todos os separadores de milhar antes de converter decimal.
- Ajustado minimamente o rótulo da prévia para reduzir ambiguidade sem mudar layout/fluxo.

**Por que foi alterado:**
- O bug vinha do desalinhamento entre o que era digitado, o que era salvo e o que era reexibido no drawer (especialmente rubricas-base).
- A correção mantém o fluxo atual e apenas alinha persistência + reidratação ao mesmo contrato.

---

# 2. Arquivos modificados

1. `src/components/payroll/EmployeeDrawer.tsx`
2. `src/components/payroll/EmployeeDrawer.test.tsx`

---

# 3. Problema raiz corrigido

- A raiz corrigida foi a divergência de contrato das rubricas-base:
  - antes: base era colapsada em `baseSalary` e depois “reexpandida” com fallback heurístico;
  - agora: base também é persistida por `rubric.id` em `earnings`, igual às demais rubricas operacionais, e reidratada sem reconstrução paralela.

---

# 4. O que foi preservado

- **Motor / backend de derivados preservado** (continua sendo fonte de verdade de `earnings_total`, `deductions_total`, `net_salary`, etc.).
- **Arquitetura preservada** (sem novos componentes, sem nova rota, sem novo modelo de banco).
- **Fluxos não alterados**:
  - salvar no drawer continua chamando o mesmo `onSave`;
  - recálculo automático pós-save continua no `Index`;
  - ação de recibo permanece desabilitada como já estava.

---

# 5. Testes executados

## Cenário 1 — rubrica-base com valor simples
- Validado no teste: `persiste e reidrata rubrica-base pelo mesmo contrato de earnings por rubric.id`.
- Resultado observado:
  - valor digitado (`1500,00`) vira `1500` no payload;
  - valor salvo em `earnings[rub-base]`;
  - valor reidratado no input permanece `1500.00`.

## Cenário 2 — valor com milhar e decimal pt-BR
- Validado no teste: `parseia valor pt-BR com milhar e decimal sem zerar indevidamente`.
- Resultado observado:
  - entrada `1.234.567,89` converte para `1234567.89`;
  - payload preserva o valor numérico correto.

## Cenário 3 — derivados continuam backend/output
- Validado no teste: `mantém rubricas derivadas fora dos inputs editáveis...`.
- Resultado observado:
  - rubrica `nature=calculada` não aparece como campo de input manual.

## Cenário 4 — salvar/recalcular/recibo não quebrados
- Validado de forma automatizada:
  - botão `Salvar` permanece habilitado no drawer em edição;
  - botão `Gerar recibo` permanece desabilitado (comportamento existente preservado).
- Validado de integração build:
  - projeto compila com `npm run build` sem erro.

---

# 6. Riscos remanescentes

- O backend ainda mantém compatibilidade legada de chaves textuais (`salario_fiscal` / `salario_ctps`) para base fiscal no recálculo.
- Esta correção resolve a previsibilidade do drawer no fluxo atual, mas o alinhamento completo de contrato canônico front↔backend ainda pode exigir ajuste específico do RPC em etapa futura dedicada.

---

# 7. Checklist final

- [x] valor digitado = valor salvo
- [x] valor salvo = valor reexibido
- [x] parse monetário validado
- [x] derivados continuam no backend
- [x] sem refatoração desnecessária
