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

## Refinamento de alinhamento no PDF (grid executivo)
- Foi aplicado um novo ajuste **somente no PDF** para corrigir desalinhamentos visuais da seção `Resumo Gerencial para Aprovação`.
- Os cards de indicadores foram **compactados** (menor altura e padding interno reduzido), mantendo os mesmos 5 indicadores e os mesmos dados.
- `Ranking por Setor / Empresa` e `Composição da Folha` passaram a usar **grid fixo de duas colunas** (larguras proporcionais, gap fixo e mesmo eixo Y de início).
- Os títulos dos dois blocos foram alinhados ao mesmo grid horizontal das tabelas, evitando sensação de blocos soltos.
- **Tela web não foi alterada** e **Excel não foi alterado**.
- **Não houve alteração de cálculo** nem mudança em helpers de consolidação de dados.

## Ajuste final: linha TOTAL do ranking no PDF e versionamento
- A linha `TOTAL` do bloco `Ranking por Setor / Empresa` no PDF passou a ser montada **explicitamente** com base no resumo gerencial:
  - Funcionários: `managerial.totalEmployees`
  - Salário Líquido: `managerial.salarioLiquido`
  - Percentual: `100,0%` quando `managerial.salarioLiquido > 0`; caso contrário `0,0%`
- Com isso, o PDF não depende mais da existência de um item `TOTAL` dentro de `managerial.ranking`.
- **Não houve alteração de cálculo** da folha nem mudança de helper; o ajuste é somente de apresentação no PDF.
- Sobre `public/version.json`: a alteração automática de build foi **removida do escopo deste ajuste** para evitar ruído de versão sem impacto funcional direto.

## Refinamento final de espaçamento e integração visual no PDF
- Foi concluído o polimento visual **somente no PDF** da seção `Resumo Gerencial para Aprovação`, sem alteração de tela web, Excel, cálculo da folha ou helpers de dados.
- Ajustes aplicados neste refinamento final:
  - aumento do espaço entre a tabela principal e o início da seção gerencial para criar separação visual clara;
  - melhor integração entre o cabeçalho da seção e os 5 cards, com ajuste de faixa/título e aproximação controlada dos cards;
  - correção da sobreposição no título `Ranking por Setor / Empresa` com unificação do ponto de renderização do título;
  - ajuste de espaçamento vertical entre cards e blocos inferiores (`Ranking` e `Composição`) para dar mais respiro e acabamento;
  - manutenção do grid já corrigido (cards em linha e blocos inferiores lado a lado), apenas com refinamento de distâncias.

## Refinamento final: integração visual dos cards no bloco gerencial (PDF)
- Foi realizado um ajuste final de acabamento **somente no PDF** para reduzir a sensação de que os 5 cards eram elementos desconectados.
- A linha de indicadores passou a ter um **container sutil único** (fundo leve, borda leve e cantos arredondados), mantendo os cards individuais dentro desse agrupamento visual.
- Também foram refinados gap e proporções dos cards para que a faixa de indicadores fique mais coesa e executiva, sem alterar dados exibidos.
- **Não houve alteração de cálculo da folha, tela web ou exportação Excel**.
