## Objetivo

Permitir que uma rubrica manual tenha uma **quantidade complementar opcional** (ex.: "dias" para Compra de Férias), persistida por lançamento/competência, exibida no drawer e refletida no recibo. O número é **apenas descritivo** — não entra em cálculo algum.

## Escopo das alterações

### 1. Banco (migration)

**Tabela `rubricas`** — duas colunas novas:
- `uses_complementary_quantity boolean not null default false`
- `complementary_quantity_label text` (ex.: `"dias"`)

**Tabela `payroll_entries`** — uma coluna nova:
- `rubric_meta jsonb not null default '{}'::jsonb`
  - formato: `{ "<rubricId>": { "quantity": 10 } }`
  - mantida separada de `earnings`/`deductions` para não impactar o motor de cálculo e os totalizadores existentes.

Sem novos triggers, sem CHECK constraints. RLS herdada (sem mudança).

### 2. Tipos (`src/types/payroll.ts`)

- `Rubric`: `usesComplementaryQuantity?: boolean`, `complementaryQuantityLabel?: string | null`.
- `PayrollEntry`: `rubricMeta?: Record<string, { quantity?: number }>`.

### 3. Contexto (`src/contexts/PayrollContext.tsx`)

- Mapear as novas colunas em todos os pontos de leitura/escrita de rubricas e entries (load, add, update). Persistir `rubric_meta` no `addPayrollEntry`/`updatePayrollEntry`. Sem mudança em cálculo.

### 4. Cadastro de rubricas (`src/pages/Rubrics.tsx`)

- Adicionar, no formulário/diálogo de rubrica, um checkbox "Usar quantidade complementar" e, quando marcado, um input "Rótulo" (default `"dias"`). Sem reorganizar a tela.

### 5. Drawer da Central (`src/components/payroll/EmployeeDrawer.tsx`)

- Em `NumericRubricInput`, quando `rubric.usesComplementaryQuantity` for true, exibir um segundo input compacto à direita do valor, com largura curta (`w-20`), tipo numérico inteiro ≥ 0, label "Dias" (ou o rótulo configurado).
- Estado local adicional `rubricQuantities: Record<string, number>`; inicialização lê de `entry.rubricMeta`.
- `buildPayrollEntryDraft` adiciona `rubricMeta` ao payload com apenas as rubricas que têm quantidade definida (>0).
- Cálculo (`calculatePayroll`) e canônicas **não** recebem nada de quantidade.

### 6. Recibo

- `src/lib/receiptData.ts`:
  - `ReceiptLine` ganha `quantity?: number` e `quantityLabel?: string`.
  - Após construir as linhas legadas (agregadas), inserir **linhas extras dedicadas** para cada rubrica ativa que:
    - tenha `usesComplementaryQuantity = true`,
    - tenha valor > 0 no lançamento,
    - tenha quantidade > 0 em `entry.rubricMeta`.
  - Posicionamento: insere logo antes da linha "INSS" (final do bloco de proventos) para não quebrar a ordem visual dos descontos. Prefixo segue o tipo da rubrica (`(+)` provento, `(-)` desconto).
  - Para evitar dupla contagem visual, **subtrair** o mesmo valor da linha agregada onde a rubrica entraria (por `classification`). Os totais "Líquido a receber" não mudam, porque vêm da entry persistida.
- `src/components/payroll/Receipt.tsx`:
  - `formatReceiptLineLabel` passa a anexar `(N dias)` quando `line.quantity` e `line.quantityLabel` existirem. Ex.: `(+) Compra de Férias (10 dias)`.

### 7. Relatório PDF (`src/pages/ReportsCompany.tsx` e `src/lib/reportByCompanyData.ts`)

- **Nenhuma alteração**. O relatório continua lendo apenas valores monetários.

### 8. Testes manuais (após build)

1. Marcar a rubrica "Compra de Férias" como `uses_complementary_quantity = true`, rótulo `dias`.
2. No drawer, lançar R$ 1.200 + 10 dias, salvar, reabrir → persistência ok.
3. Salário Líquido e totais inalterados quando só os dias mudam.
4. Recibo mostra `(+) Compra de Férias (10 dias)  1.200,00`, separado da linha agregada.
5. Relatório PDF mostra apenas o valor.
6. Outras rubricas (Horas Extras, Prêmio, INSS, Faltas) continuam idênticas.

## Fora de escopo (explícito)

- Sem motor de cálculo por quantidade.
- Sem alteração em rubricas canônicas (`salario_real`, `g2_complemento`, `salario_liquido`).
- Sem mudança em AppLayout, navegação, demais páginas, ou relatórios.
- Sem refactor do drawer ou do template do recibo.

## Arquivos tocados

- Migration nova (rubricas + payroll_entries)
- `src/types/payroll.ts`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Rubrics.tsx`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/lib/receiptData.ts`
- `src/components/payroll/Receipt.tsx`
