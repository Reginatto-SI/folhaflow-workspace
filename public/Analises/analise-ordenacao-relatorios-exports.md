# Análise — Ordenação A-Z nos relatórios e exports da folha

## PRDs consultados

- `public/PRD/PRD-00 — Visão Geral do Produto.txt`: produto deve ser previsível, simples e sem múltiplas fontes de verdade.
- `public/PRD/PRD-00B — Modelo Operacional Simplificado.txt`: backend persiste/carrega dados; cálculo acontece de forma controlada no fluxo da folha.
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`: cálculo imediato no frontend e sem recálculo manual.
- `public/PRD/PRD-03 — Central de Folha.txt`: Central é a origem operacional da folha.
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`: recibos apenas exibem valores já existentes.
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`: relatórios apenas refletem valores já calculados, sem lógica paralela.
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`: rubricas canônicas devem permanecer consistentes entre Central, Recibos e Relatórios.

## Arquivos analisados

- `src/lib/reportByCompanyData.ts`
- `src/lib/reportByCompanyPdf.ts`
- `src/lib/reportByCompanyExcel.ts`
- `src/lib/reportSummaryData.ts`
- `src/lib/reportSummaryPdf.ts`
- `src/lib/reportSummaryExcel.ts`
- `src/lib/reportSummaryManagerial.ts`
- `src/pages/ReportsCompany.tsx`
- `src/pages/ReportsSummary.tsx`
- `src/pages/Index.tsx`
- Testes existentes relacionados a relatórios: `src/lib/reportSummaryData.test.ts` e `src/lib/reportSummaryManagerial.test.ts`

## Arquivos alterados

- `src/lib/reportByCompanyData.ts`
- `src/lib/reportByCompanyData.test.ts`
- `public/Analises/analise-ordenacao-relatorios-exports.md`

## Exports encontrados

- **PDF por empresa**: `generateReportByCompanyPdf`, consumindo `ReportByCompanyDataset`.
- **Excel/CSV por empresa**: `exportReportByCompanyExcel`, consumindo o mesmo `ReportByCompanyDataset`.
- **PDF geral / resumo completo**: `generateReportSummaryPdf`, consumindo `ReportSummaryDataset`.
- **Excel geral / resumo completo**: `generateReportSummaryExcel`, consumindo `ReportSummaryDataset`.
- **Atalhos da Central de Folha**: `/central-de-folha` monta o mesmo dataset por empresa com `buildReportByCompanyData` antes de chamar os exportadores de PDF e Excel.

## Onde a ordenação A-Z foi aplicada

A ordenação foi aplicada em `buildReportByCompanyData`, no ponto único onde as linhas de funcionários do relatório por empresa são montadas.

Critérios implementados:

- `Intl.Collator("pt-BR", { sensitivity: "base", numeric: true })` para ordenação amigável em português.
- Funcionários sem nome real ficam no final.
- Em empate de nome, CPF é usado como desempate quando disponível.
- Persistência da estabilidade por índice de origem quando nome e CPF empatam.
- A ordenação ocorre após a leitura dos valores da folha e antes de o dataset ser consumido por PDF, Excel/CSV, tela de relatório ou atalhos da Central.

## Confirmação — PDFs ordenados

- **PDF por empresa**: ordenado porque `generateReportByCompanyPdf` recebe `dataset.rows` já em A-Z pelo helper central `buildReportByCompanyData`.
- **PDF geral / resumo completo**: o arquivo de resumo completo não renderiza linhas individuais de funcionários; ele consolida rubricas e headcount por empresa a partir de `buildReportByCompanyData`. Assim, qualquer base com listagem por funcionário usada na consolidação passa pela ordenação A-Z, sem alterar totais.

## Confirmação — Excels ordenados

- **Excel/CSV por empresa**: ordenado porque `exportReportByCompanyExcel` monta as linhas exportadas a partir de `dataset.rows`, agora já ordenadas A-Z.
- **Excel geral / resumo completo**: o arquivo de resumo completo não renderiza linhas individuais de funcionários; ele exporta matriz consolidada por empresa/rubrica a partir de `buildReportSummaryData`, que reaproveita `buildReportByCompanyData` para cada empresa.

## Confirmação — independência da tela e paginação

- A ordenação foi aplicada no dataset de relatório/exportação, não na tabela visual da Central.
- O export por empresa da Central chama `buildReportByCompanyData` diretamente com os dados filtrados da competência e empresa, sem reaproveitar a ordenação visual da tabela.
- Não há dependência da paginação, porque os exports usam a coleção completa de entradas filtradas por empresa/competência antes de montar as linhas.

## Confirmação — totais e cálculos

- Nenhum cálculo de folha foi alterado.
- Nenhuma fórmula, rubrica canônica, totalizador, layout de PDF ou layout de Excel foi alterado.
- Os totais continuam calculados por soma dos mesmos `rubricValues`; apenas a sequência das linhas foi alterada.
- Foi criado teste automatizado específico garantindo que a ordenação A-Z ocorre e que o total permanece igual após a ordenação.

## Checklist de validação

- [x] PDF por empresa usa `dataset.rows` ordenado A-Z antes da renderização.
- [x] PDF geral/resumo completo mantém consolidação e não introduz recálculo; não há tabela individual de funcionários nesse export.
- [x] Excel/CSV por empresa usa `dataset.rows` ordenado A-Z antes de montar as linhas.
- [x] Excel geral/resumo completo mantém consolidação e não introduz recálculo; não há tabela individual de funcionários nesse export.
- [x] Ordenação dos arquivos não depende da ordenação atual da tabela da Central.
- [x] Ordenação dos arquivos não depende de paginação.
- [x] Totais dos PDFs permanecem iguais, pois a soma usa os mesmos valores.
- [x] Totais dos Excels permanecem iguais, pois a soma usa os mesmos valores.
- [x] Nenhum cálculo foi alterado.
- [x] Testes relacionados a relatórios executados: `npm run test -- src/lib/reportSummaryData.test.ts src/lib/reportSummaryManagerial.test.ts src/lib/reportByCompanyData.test.ts`.
- [x] Build executado: `npm run build`.
