# Análise 23 — Indicadores consolidados do legado e coluna gerencial Sem Imobiliária

## Diagnóstico

- A montagem do Resumo Completo já era centralizada em `buildReportSummaryData`, com reutilização do dataset por tela, PDF, Excel e dashboard.
- A coluna `SEM IMOB.` já existia como derivada `TOTAL - IMOBILIÁRIA` e com regra específica de custo médio sem subtração de médias.
- Divergência encontrada: a linha **Rendimentos** somava todos os proventos não canônicos, incluindo rubricas que o legado não considera (ex.: Salário CTPS e Salário G, se classificados como provento ativo).

## Arquivos analisados

- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`
- `src/lib/reportSummaryData.ts`
- `src/pages/ReportsSummary.tsx`
- `src/lib/reportSummaryPdf.ts`
- `src/lib/reportSummaryExcel.ts`
- `src/pages/Dashboard.tsx`

## Regra encontrada no legado

- Rendimentos = apenas proventos adicionais (sem CTPS, sem Salário G).
- Descontos = soma dos campos de desconto.
- Custo médio por funcionário = Salário G / total de funcionários.
- Coluna Sem Imobiliária = TOTAL - Imobiliária.
- Custo médio Sem Imobiliária = Salário G sem Imobiliária / funcionários sem Imobiliária.

## Situação atual do código

- **Tela relatório**: usa `dataset.rows` com colunas empresas + TOTAL + SEM IMOB.
- **PDF**: usa o mesmo `dataset` do resumo.
- **Excel**: usa o mesmo `dataset` do resumo.
- **Dashboard**: usa `buildReportSummaryData` para métricas comparativas.

## Divergências encontradas

1. Critério de Rendimentos estava amplo demais (todos os proventos não canônicos).

## Correção aplicada

- Ajustado `buildReportSummaryData` para `Rendimentos` considerar somente classificações de proventos adicionais legados (`outros_rendimentos`, `horas_extras`, `ferias_terco`, `insalubridade`).
- Mantida a regra de custo médio por funcionário baseada em Salário G, com identificação da rubrica por `classification=salario_g` para evitar dependência de label.
- Incluídos comentários de paridade com legado no ponto de cálculo.
- PRD-08 atualizado com seção oficial de indicadores consolidados e coluna gerencial Sem Imobiliária.

## Validação da coluna Total

- Continua sendo soma de todas as empresas reais (`row.total`) no dataset consolidado.

## Validação da coluna Sem Imobiliária

- Continua sendo `row.semImob = row.total - row da empresa Imobiliária` para todas as linhas.
- No custo médio, mantém fórmula correta de recomputação da base sem Imobiliária (não subtração de médias).

## Checklist final

- [x] PRD-08 foi atualizado, sem criar PRD duplicado de relatórios.
- [x] Rendimentos soma apenas proventos adicionais.
- [x] Rendimentos não inclui Salário CTPS.
- [x] Rendimentos não inclui Salário G.
- [x] Descontos soma apenas campos de desconto.
- [x] Custo médio por funcionário usa Salário G dividido pelo total de funcionários.
- [x] Salário Líquido não foi usado para custo médio.
- [x] Salário Real não foi usado para custo médio.
- [x] Salário Fiscal não foi usado para custo médio.
- [x] Coluna TOTAL soma corretamente todas as empresas reais.
- [x] Coluna SEM IMOB. é calculada como TOTAL menos IMOBILIÁRIA.
- [x] Total de funcionários SEM IMOB. é calculado como total menos funcionários da IMOBILIÁRIA.
- [x] Custo médio SEM IMOB. usa Salário G SEM IMOB. / funcionários SEM IMOB.
- [x] “Sem Imobiliária” não foi criada como empresa real.
- [x] “Sem Imobiliária” não foi criada como rubrica.
- [x] PDF, Excel, dashboard e tela usam a mesma regra/função compartilhada (`buildReportSummaryData`).
- [x] Nenhuma rubrica canônica foi recalculada no relatório.
- [x] Nenhuma nova lógica complexa foi criada.
