# Análise 10 — Correção da fonte real do Relatório por Empresa

Data: 2026-05-22

## 1) Contradição encontrada entre diagnóstico anterior e diff real

Foi identificada contradição objetiva: o diagnóstico textual anterior afirmava alinhamento da fonte com a Central, porém no código do `dataset` o builder ainda recebia `allPayrollEntries`.

## 2) Confirmação de que o builder ainda recebia `allPayrollEntries`

Antes desta correção, em `src/pages/ReportsCompany.tsx`, a chamada estava com:

- `allEntries: allPayrollEntries ?? []`

## 3) Correção aplicada para usar `payrollEntries`

Foi aplicada mudança mínima e localizada no `useMemo` do dataset:

- `allEntries: payrollEntries ?? []`

Também foi ajustado o array de dependências do `useMemo`:

- removido `allPayrollEntries`
- adicionado `payrollEntries`

## 4) Confirmação de que Central e Relatório agora usam a mesma fonte operacional

Após a alteração, o relatório passa a consumir a mesma lista operacional da Central (`payrollEntries`) para montagem do dataset da competência ativa.

## 5) Confirmação de que não houve recálculo

Nenhuma alteração foi feita em cálculo de folha ou no builder de cálculo. A mudança foi apenas na fonte de entradas utilizada pela tela de relatório.

## 6) Confirmação de que rubricas dinâmicas não foram alteradas

Nenhuma alteração em rubricas, contrato de rubricas ou ordenação de colunas dinâmicas.

## 7) Confirmação de que PDF/CSV não foram alterados

Não houve mudança em geração/exportação de PDF ou CSV. Apenas a origem de dados do dataset foi alinhada com a Central.

## 8) Testes executados

- `npm run build`

## Observação de validação visual

Validação visual em browser não foi executada neste ambiente CLI. Os logs DEV existentes em `ReportsCompany.tsx` permanecem disponíveis para conferência de `payrollEntriesCount` e `datasetRows` em ambiente de desenvolvimento.
