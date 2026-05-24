# Análise 1 — Resumo Gerencial no Relatório Consolidado da Folha

## Arquivos alterados
- `src/pages/ReportsSummary.tsx`
- `src/lib/reportSummaryManagerial.ts`
- `src/lib/reportSummaryPdf.ts`
- `src/lib/reportSummaryExcel.ts`
- `public/Analises/analise-1-resumo-gerencial-relatorio-folha.md`

## Fragilidades corrigidas
- **Composição da folha** deixou de depender primariamente de labels: agora prioriza `row.key` estável das rubricas no `ReportSummaryDataset` e usa label apenas como fallback de contingência.
- **Salário líquido** deixou de depender de label como regra principal: agora prioriza rubrica canônica com `isCanonical` + `key="salario_liquido"`, com fallback legado controlado.
- **Ranking TOTAL na tela** não fixa mais `100%`: agora mostra `100,0%` somente quando o total de salário líquido é maior que zero, senão `0,0%`.
- **Responsividade dos cards** refinada para grid progressivo em breakpoints intermediários.

## Origem dos dados reutilizados
- Todos os indicadores do resumo gerencial continuam derivados do `ReportSummaryDataset` produzido por `buildReportSummaryData`.
- Não houve criação de endpoint, query nova, fonte paralela, backend, migração ou regra de cálculo nova.

## Confirmação de não recálculo da folha
- O resumo gerencial permanece camada visual de consolidação.
- Não foi criado novo motor de cálculo.
- Não houve alteração nas regras da Central, Recibos ou rubricas canônicas.

## PDF e Excel
- **PDF**: agora inclui indicadores, ranking e também a tabela **Composição da Folha**.
- **Excel** (mesma aba `Resumo Completo`): agora inclui indicadores, **Ranking por Setor / Empresa** e **Composição da Folha**, com títulos e espaçamento por linhas em branco.

## Validações realizadas
- Build frontend (`npm run build`) concluído com sucesso.
- Revisão do escopo com `git diff --stat`.
- Verificação de arquivos modificados com `git status --short`.

## Riscos e pontos pendentes
- O fallback por label permanece somente para compatibilidade com bases legadas onde o `row.key` canônico esperado não esteja disponível; regra principal permanece por identificador estável.

## Refinamento visual adicional no PDF (Resumo Gerencial para Aprovação)
- Foi realizado refinamento visual **somente no PDF** da seção `Resumo Gerencial para Aprovação` em `src/lib/reportSummaryPdf.ts`.
- **Tela `/relatorios/resumo-completo` não foi alterada**.
- **Exportação Excel não foi alterada** neste refinamento.
- **Não houve alteração de cálculo** da folha nem mudança em `buildReportSummaryData`/helpers de dados.
- Blocos melhorados no PDF:
  - Indicadores principais em cards visuais (Total de Funcionários, Rendimentos, Descontos, Salário Líquido, Custo Médio por Func.).
  - Tabela compacta de `Ranking por Setor / Empresa` (Top 5 + linha TOTAL quando existente).
  - Tabela compacta de `Composição da Folha` com destaque discreto para `Salário Líquido` e `Total da Folha / Rendimentos`.
- Paginação reforçada para evitar título isolado no fim da página e sobreposição com rodapé.

### Validações realizadas neste refinamento
- Build frontend (`npm run build`) executado.
- Revisão resumida de escopo com `git diff --stat`.
- Verificação de arquivos modificados com `git status --short`.
