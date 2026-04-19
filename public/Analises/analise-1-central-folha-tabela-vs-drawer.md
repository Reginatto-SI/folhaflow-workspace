# Análise 1 — Central de Folha: inconsistência de cálculo entre tabela e drawer

## Diagnóstico

A tabela da `/central-de-folha` e o drawer **já compartilham a mesma função de cálculo** (`computeSpreadsheetEntry(...)`), portanto a divergência não está em “duas engines separadas”.

A divergência está no **valor final escolhido para exibição**:

- **Drawer (Resultados)**: exibe rubricas derivadas específicas (`salario_real`, `g2_complemento`, `salario_liquido`) via `spreadsheetPreview.valuesByRubricId[rubric.id]`.
- **Tabela (coluna Líquido)**: exibe `localComputed.netSalary`, que é calculado genericamente como `earningsTotal - deductionsTotal`.

Ou seja: mesmo com a mesma função de cálculo, a tabela e o drawer estão consumindo **saídas diferentes** do resultado computado.

Além disso, a tabela mostra agregados (`Salário Base`, `Proventos`, `Descontos`, `Líquido`) e **não** as rubricas derivadas do bloco de resultados do drawer, o que reforça a percepção de “números diferentes” quando o usuário compara `salario_liquido` do drawer com `Líquido` da grade.

## Evidência

### 1) Onde a tabela busca/monta os dados

Arquivo: `src/components/payroll/PayrollTable.tsx`

- Monta `localComputed` com:
  - `computeSpreadsheetEntry({ rubrics, manualValues: getEntryManualValues(entry, rubrics) })`
- Exibe:
  - `localComputed.baseSalary` (Salário Base)
  - `localComputed.earningsTotal` (Proventos)
  - `localComputed.deductionsTotal` (Descontos)
  - `localComputed.netSalary` (Líquido)

Conclusão: a tabela **não usa** `earnings_total/deductions_total/net_salary` persistidos do backend nesse render; usa preview local.

### 2) Se a tabela usa persistido / soma manual / classificação / computeSpreadsheetEntry

Arquivo: `src/lib/payrollSpreadsheet.ts`

- `getEntryManualValues(...)` lê de `entry.earnings` e `entry.deductions` por rubrica (com fallback legado por id/code/name).
- `computeSpreadsheetEntry(...)`:
  - resolve rubricas manuais e derivadas;
  - calcula `earningsTotal` somando rubricas `type === "provento"`;
  - calcula `deductionsTotal` somando rubricas `type === "desconto"`;
  - calcula `netSalary` como `earningsTotal - deductionsTotal`;
  - usa `classification === "inss"` apenas para `inssAmount`.

Conclusão:
- A tabela usa valores persistidos como **entrada manual** (`earnings`/`deductions`),
- usa agregação por `type` dentro da função,
- e usa `computeSpreadsheetEntry(...)` (não há cálculo paralelo manual no componente).

### 3) Divergência específica com o drawer

Arquivo: `src/components/payroll/EmployeeDrawer.tsx`

- O drawer também usa `computeSpreadsheetEntry(...)` (`spreadsheetPreview`).
- No bloco **Resultados**, o valor exibido é `spreadsheetPreview.valuesByRubricId[rubric.id]` para cada rubrica derivada ordenada (`salario_real`, `g2_complemento`, `salario_liquido`).

Ponto exato da divergência:
- **Tabela** lê o campo agregado `netSalary`.
- **Drawer** lê a rubrica derivada `salario_liquido` (via `valuesByRubricId`).

Se a rubrica derivada `salario_liquido` não for semanticamente idêntica a `earningsTotal - deductionsTotal`, os números divergem por definição de saída.

### 4) Arquivos responsáveis pela linha da tabela e função usada

- Linha da tabela: `src/components/payroll/PayrollTable.tsx`
- Função de cálculo usada na linha: `computeSpreadsheetEntry(...)` + `getEntryManualValues(...)` em `src/lib/payrollSpreadsheet.ts`
- Componente comparado (drawer): `src/components/payroll/EmployeeDrawer.tsx`

## Causa raiz

**Causa raiz funcional:** há desalinhamento de contrato de apresentação entre tabela e drawer.

Mesmo usando a mesma função de cálculo, cada bloco consome uma saída diferente:
- tabela: agregados (`baseSalary`, `earningsTotal`, `deductionsTotal`, `netSalary`)
- drawer: rubricas derivadas (`valuesByRubricId`), incluindo `salario_liquido`

Isso viola a expectativa operacional de equivalência visual entre “resultado do funcionário no drawer” e “resultado exibido na tabela”.

## Impacto

A mesma divergência de contrato afeta também a barra de totais:

- `src/components/payroll/TotalsBar.tsx` soma `computed.earningsTotal`, `computed.deductionsTotal` e `computed.netSalary`.

Logo, qualquer relatório/visão que espere coerência com rubricas derivadas (especialmente `salario_liquido`) pode apresentar diferença percebida:

- grade da Central,
- totais da competência,
- validação manual por usuário,
- e eventual conferência com relatórios que usem campos derivados.

## Próximo passo sugerido

Correção mínima recomendada (sem refatoração ampla):

1. Definir explicitamente o contrato da coluna **Líquido** da tabela:
   - opção A: continuar como agregado (`earningsTotal - deductionsTotal`) e ajustar labels/UX para não comparar com `salario_liquido` derivado;
   - opção B (mais aderente ao comportamento do drawer): exibir a rubrica derivada `salario_liquido` (mesma fonte de valor do bloco Resultados).

2. Aplicar a mesma decisão de contrato na `TotalsBar` para evitar inconsistência entre linha e totais.

3. Manter `computeSpreadsheetEntry(...)` como função única; ajustar apenas **qual campo do resultado** cada bloco consome.
