# Análise 12 — Largura dinâmica das colunas no PDF do Relatório por Empresa

## 1) Problema identificado na largura fixa
- O PDF usava largura fixa para colunas dinâmicas (`.col-numeric { width: 4%; }`).
- Com rubricas variáveis, essa abordagem pode ultrapassar 100% da largura total, gerando estouro horizontal.

## 2) Correção aplicada
- Foi feito ajuste mínimo no `exportPdf` de `src/pages/ReportsCompany.tsx`.
- As larguras fixas das 4 colunas base foram mantidas em proporção compacta.
- A largura das colunas numéricas passou a ser calculada dinamicamente a partir da quantidade de rubricas.

## 3) Como a largura das colunas dinâmicas passou a ser calculada
- Cálculo implementado:
  - `numericColumnsCount = dataset.dynamicColumns.length`
  - `fixedColumnsWidth = 10 + 7 + 8 + 7`
  - `numericColumnWidth = numericColumnsCount > 0 ? (100 - fixedColumnsWidth) / numericColumnsCount : 0`
- Esse valor é injetado no CSS do HTML de impressão:
  - `.col-numeric { width: ${numericColumnWidth}%; }`

## 4) Confirmação de que não houve alteração de cálculo
- Não houve alteração de cálculo da folha.
- Nenhuma regra de negócio foi alterada.
- A mudança ficou restrita ao layout/CSS do PDF.

## 5) Confirmação de que não houve alteração no dataset/rubricas
- Não houve alteração de dataset.
- Não houve alteração de rubricas nem de nomes oficiais.
- Não houve alteração de CSV, filtros, permissões, rota ou menu.

## 6) Testes executados
- `npm run build`

## 7) Riscos remanescentes
- Se a quantidade de rubricas for extrema, a largura por coluna ficará muito pequena (limite físico do A4), embora sem a soma fixa inadequada anterior.
- Diferenças sutis de renderização ainda podem ocorrer conforme o navegador usado para impressão.
