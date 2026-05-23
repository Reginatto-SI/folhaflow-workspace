# Análise — Gerar relatório na Central de Folha

## Diagnóstico
- A geração do PDF oficial do relatório por empresa estava implementada na página `src/pages/ReportsCompany.tsx`, dentro do callback `exportPdf`.
- No header da Central (`src/components/payroll/PayrollHeader.tsx`), a ação **Gerar relatório** estava fixa como desabilitada.
- A Central (`src/pages/Index.tsx`) já possui empresa, competência e batch atual em contexto, então era possível disparar a mesma geração oficial sem duplicar cálculo.

## Reuso e extração
- Foi extraída a geração do PDF para `src/lib/reportByCompanyPdf.ts`.
- A página `/relatorios/por-empresa` passou a reutilizar esse helper.
- A Central de Folha também passou a reutilizar o mesmo helper, chamando `buildReportByCompanyData` com a empresa/competência/batch selecionados.

## Arquivos alterados
- `src/lib/reportByCompanyPdf.ts` (novo helper compartilhado de PDF).
- `src/pages/ReportsCompany.tsx` (reuso do helper compartilhado).
- `src/components/payroll/PayrollHeader.tsx` (habilitação condicional do item de menu + callback).
- `src/pages/Index.tsx` (callback de geração a partir da Central usando dados atuais).

## Como a Central passa empresa/competência
- Empresa: `selectedCompany` do `usePayroll`.
- Competência: `selectedMonth` do `usePayroll`.
- Folha atual: `currentBatch` do `usePayroll`.
- Os dados usados no dataset são os mesmos da Central (`payrollEntries`, `allEmployees`, `rubrics`, `allPayrollBatches`).

## Regras preservadas
- Não foi alterado cálculo da folha.
- Não foi alterado recibo.
- Não foi alterada compra de férias/dias.
- Não foram alteradas rubricas.
- Não foi alterada data de pagamento.
- Não foi alterado layout geral da Central.
- `/relatorios/por-empresa` continua usando a regra oficial e agora com helper compartilhado.

## Testes executados
- Build do projeto para validar tipagem e integração.
- Verificação local dos pontos alterados e dos critérios de habilitação:
  - `Gerar relatório` habilita quando há `currentBatch`, `selectedCompany` e callback.
  - Sem folha atual, o item permanece desabilitado.

## Observações
- A Central atua apenas como atalho operacional; a regra oficial de geração do PDF ficou centralizada em um único helper.
