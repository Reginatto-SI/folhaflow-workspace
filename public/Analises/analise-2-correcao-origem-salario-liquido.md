# Análise 2 — correção da origem do Salário Líquido

## 1. Diagnóstico final

A divergência do recibo não estava no layout nem em uma soma local do PDF. O recibo continua exibindo `data.netSalary`, e `data.netSalary` prioriza `entry.netSalary` quando o lançamento já está salvo.

A origem funcional do problema tem dois pontos complementares:

1. A resolução por `code` canônico estava comparando código normalizado da rubrica com a string canônica não normalizada. Como o normalizador troca `_` por espaço, `salario_liquido` podia cair indevidamente em fallback legado por nome, mascarando configurações canônicas erradas.
2. A fórmula declarativa da rubrica canônica `salario_liquido` estava compatível com uma configuração incompleta. O motor frontend (`calculatePayroll` / `computeSpreadsheetEntry`) não possui fórmula hardcoded para essa canônica: ele executa os `formulaItems` cadastrados para a rubrica calculada resolvida como `salario_liquido`.

No cenário observado, o resultado da canônica estava igual ao `salario_fiscal` (**R$ 1.762,20**) mesmo existindo rubricas operacionais de horas extras, INSS, vales e faltas. Isso é compatível com uma fórmula legada incompleta equivalente a:

```text
salario_liquido = salario_fiscal
```

A correção mínima foi preparar uma migration de configuração para ajustar a fórmula **somente quando** o cadastro estiver exatamente nesse estado legado: `salario_liquido` com um único item `add` apontando para `salario_fiscal`.

## 2. Arquivos analisados

### PRDs obrigatórios

- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`

Conclusão dos PRDs: cálculo no frontend, recibo apenas exibe, e `salario_real`, `g2_complemento`, `salario_liquido` precisam permanecer consistentes entre Central, Recibos e Relatórios.

### Código da Central e cálculo

- `src/lib/payrollSpreadsheet.ts`
  - `computeSpreadsheetEntry`
  - `resolveFormulaRubric`
  - `resolveCanonicalDerivedRubricIds`
  - `diagnoseCanonicalRubric`
  - `calculatePayroll`
  - `calculatePayrollFromEntry`

- `src/components/payroll/EmployeeDrawer.tsx`
  - calcula a prévia com `calculatePayroll`;
  - salva `netSalary` como `spreadsheetPreview.salarioLiquido` quando a canônica está resolvida.

- `src/components/payroll/PayrollTable.tsx`
  - exibe a Central recalculando a linha com `calculatePayrollFromEntry`.

### Recibo

- `src/lib/receiptData.ts`
  - monta dados do recibo e usa `entry.netSalary` como prioridade para o líquido salvo.

- `src/components/payroll/Receipt.tsx`
  - renderiza `data.netSalary` em “VALOR RECEBIDO” e a linha final em `data.lines`.

### Persistência / Supabase

- `src/contexts/PayrollContext.tsx`
  - carrega `rubrica_formula_items` junto com `rubricas`;
  - persiste alterações em rubricas/fórmulas;
  - atualiza `net_salary` ao salvar lançamento pelo drawer;
  - comentário atual indica que a Central não chama recálculo operacional backend.

- `supabase/migrations/20260405001000_create_rubricas_module.sql`
  - cria `rubricas` e `rubrica_formula_items`.

- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
  - contém motor backend legado de fórmula, mas o fluxo atual da Central usa cálculo frontend.

- `supabase/migrations/20260528120000_fix_salario_liquido_canonical_formula.sql`
  - migration adicionada nesta correção.

## 3. Fórmula atual encontrada para `salario_liquido`

No repositório, não existe seed/migration antiga criando explicitamente os itens da fórmula de `salario_liquido`; o cadastro é persistido em `rubrica_formula_items` e carregado pelo app.

A tentativa de consultar o Supabase remoto a partir do ambiente de execução continuou bloqueada por rede/proxy, portanto a linha real do banco não pôde ser inspecionada diretamente daqui. A evidência operacional informada pelo print e pela análise anterior mostra a canônica retornando exatamente o mesmo valor de `salario_fiscal`:

```text
salario_liquido = 1.762,20
salario_fiscal = 1.762,20
```

Isso é compatível com a fórmula atual/incompleta:

```text
salario_liquido = salario_fiscal
```

A migration foi escrita de forma defensiva para corrigir somente esse caso confirmado pelo sintoma:

```text
existe salario_liquido ativo/calculado
existe salario_fiscal ativo/base/provento identificado por código técnico
salario_liquido possui exatamente 1 item de fórmula
esse item é add(salario_fiscal)
```

Se a fórmula já estiver customizada ou corrigida, a migration não altera nada.

## 4. Fórmula corrigida proposta

A fórmula corrigida passa a ser declarativa em `rubrica_formula_items`:

```text
salario_liquido =
  salario_fiscal
  + proventos operacionais manuais aplicáveis
  - descontos operacionais manuais aplicáveis
```

No cadastro atual, isso cobre:

### Base positiva obrigatória

- `salario_fiscal`, identificado por código técnico normalizado (`salario_fiscal` / `sal fiscal`).

### Proventos positivos por classificação técnica

- `outros_rendimentos`
- `horas_extras`
- `salario_familia`
- `ferias_terco`
- `insalubridade`

### Descontos negativos por classificação técnica

- `inss`
- `emprestimos`
- `adiantamentos`
- `vales`
- `faltas`

A fórmula não inclui `salario_ctps` nem `salario_g`, porque essas rubricas são bases técnicas exibidas na Central, mas não compõem a linha “Salário Bruto” do recibo observado. No cenário informado, a fórmula corrigida resulta em:

```text
1.762,20 + 66,84 - 199,69 - 527,22 - 77,73 = 1.024,40
```

## 5. Havia ou não dado persistido divergente?

Não foi aplicada migration para alterar `payroll_entries.net_salary` existente.

Há risco de dados já salvos permanecerem com `net_salary = 1.762,20` até o lançamento ser salvo novamente pelo drawer, porque o recibo prioriza `entry.netSalary` em lançamentos persistidos.

Porém, o fluxo atual já atualiza esse campo ao salvar novamente:

```text
netSalary = spreadsheetPreview.salarioLiquido
```

Portanto, após a fórmula da rubrica ser corrigida e o lançamento ser reaberto/salvo pelo drawer, `net_salary` deve passar a refletir o cálculo corrigido.

Não foi preparada migration de atualização massiva de `payroll_entries`, porque isso alteraria dados financeiros existentes sem listar previamente registros afetados e sem confirmar regra de negócio em produção. A correção segura neste passo é a fórmula de origem + ressalvamento operacional.

## 6. Correção aplicada

### Ajuste no resolvedor canônico

Arquivo:

- `src/lib/payrollSpreadsheet.ts`

O que foi ajustado:

1. `diagnoseCanonicalRubric` agora normaliza também a string canônica esperada antes de comparar por `code`.
2. Aliases técnicos legados também são normalizados antes da comparação.
3. Isso garante que `salario_liquido`, `salario_real` e `g2_complemento` sejam resolvidos por código quando o cadastro estiver correto, sem cair desnecessariamente em fallback por nome.

### Migration adicionada

Arquivo:

- `supabase/migrations/20260528120000_fix_salario_liquido_canonical_formula.sql`

O que ela faz:

1. Localiza a rubrica ativa calculada com `code = salario_liquido`.
2. Localiza a rubrica base/provento de salário fiscal por código técnico normalizado.
3. Verifica se a fórmula atual de `salario_liquido` possui exatamente um item: `add(salario_fiscal)`.
4. Se e somente se essa condição for verdadeira:
   - remove os itens antigos da fórmula;
   - recria a fórmula como `salario_fiscal + proventos operacionais - descontos operacionais`;
   - usa apenas `code`, `type`, `nature` e `classification`, sem heurística por nome.
5. Não altera recibo, relatórios, layout ou `payroll_entries`.

### Teste automatizado adicionado

Arquivo:

- `src/lib/payrollSpreadsheet.test.ts`

Foi adicionado um teste da fórmula corrigida com os valores do caso observado:

```text
salario_fiscal = 1.762,20
horas_extras = 66,84
inss = 199,69
vales = 527,22
faltas = 77,73
salario_liquido esperado = 1.024,40
```

O teste também mantém `salario_ctps` e `salario_g` no conjunto de rubricas para garantir que essas bases técnicas não entrem na canônica de líquido.

## 7. Riscos

### Risco 1 — resolução por código passa a prevalecer corretamente

Ambientes que antes dependiam silenciosamente de fallback por nome passarão a usar o código canônico quando ele existir. Isso é o comportamento esperado pelo PRD-12, mas pode revelar cadastros duplicados/ambíguos que estavam mascarados.

### Risco 2 — fórmula customizada não será alterada

A migration só corrige o caso específico `salario_liquido = salario_fiscal`. Se o banco tiver uma fórmula diferente, mesmo incorreta, ela não será sobrescrita automaticamente. Isso é intencional para evitar destruir configuração manual.

### Risco 3 — código técnico de salário fiscal diferente

A migration identifica salário fiscal por código técnico normalizado (`salario_fiscal` / `sal fiscal`). Se o ambiente produtivo tiver outro código técnico para essa rubrica, a migration não fará alteração. Isso preserva a regra de não inferir por nome/label.

### Risco 4 — `net_salary` salvo continua antigo até ressalvar

Como não houve atualização massiva de `payroll_entries`, recibos gerados antes de ressalvar o lançamento podem continuar exibindo `entry.netSalary` antigo. Caminho seguro: abrir o lançamento no drawer, conferir a prévia recalculada e salvar.

### Risco 5 — inclusão de rubricas operacionais por classificação

A fórmula passa a incluir todos os proventos/descontos operacionais ativos das classificações listadas. Isso é coerente com o recibo legado, mas exige que o cadastro de rubricas esteja classificado corretamente.

## 8. Checklist de testes manuais

1. [ ] Aplicar a migration em homologação.
2. [ ] Abrir a Central de Folha.
3. [ ] Selecionar empresa IMOBILIARIA.
4. [ ] Selecionar competência abril/2026.
5. [ ] Abrir Vitor da Cruz Gusmão.
6. [ ] Confirmar que `Salário Líquido` recalcula para R$ 1.024,40 quando os valores forem:
   - Salário Fiscal: R$ 1.762,20;
   - Horas Extras: R$ 66,84;
   - INSS: R$ 199,69;
   - Vales/Descontos: R$ 527,22;
   - Faltas/Descontos: R$ 77,73.
7. [ ] Alterar Horas Extras e verificar se Salário Líquido muda imediatamente.
8. [ ] Alterar INSS e verificar se Salário Líquido muda imediatamente.
9. [ ] Alterar Vales/Descontos e verificar se Salário Líquido muda imediatamente.
10. [ ] Alterar Faltas/Descontos e verificar se Salário Líquido muda imediatamente.
11. [ ] Salvar o lançamento.
12. [ ] Recarregar a tela.
13. [ ] Confirmar que Salário Líquido permanece correto.
14. [ ] Gerar recibo.
15. [ ] Confirmar que “Valor Recebido” e “Líquido a receber” batem com a Central.
16. [ ] Confirmar que o recibo não faz cálculo próprio e não teve layout alterado.
17. [ ] Gerar relatório por empresa e confirmar que `salario_liquido` bate com a Central.

## 9. Verificações executadas

```bash
sed -n '1,220p' "public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt"
sed -n '1,220p' "public/PRD/PRD-03 — Central de Folha.txt"
sed -n '1,220p' "public/PRD/PRD-07 — Recibos de Pagamento.txt"
sed -n '1,220p' "public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt"
rg -n "salario_liquido|Salário Líquido|salario_fiscal|Horas Extras|horas_extras|faltas|vales|rubrica_formula_items|insert into public.rubricas|upsert|seed|ensure|canonical" supabase src public --glob '!node_modules'
rg -n "insert into public.rubricas|update public.rubricas|salario_liquido|Salário Líquido|Salario Liquido|rubrica_formula_items" supabase/migrations --glob '*.sql'
npm run test -- src/lib/payrollSpreadsheet.test.ts src/lib/receiptData.test.ts src/components/payroll/PayrollCentralCanonical.test.tsx
npm run lint
```
