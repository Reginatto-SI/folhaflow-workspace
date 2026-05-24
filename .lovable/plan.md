
# Resumo Completo da Folha (PDF consolidado)

Reproduz o layout legado de `Resumo Completo DF.pdf`: tabela única consolidando **todas as empresas do grupo** numa competência, com rubricas como linhas e empresas como colunas. Sem recalcular nada — reaproveita os mesmos helpers já usados pelo Relatório por Empresa.

## Navegação

- Manter rota atual `/relatorios/por-empresa` intacta.
- Adicionar nova rota `/relatorios/resumo-completo` apontando para nova página `ReportsSummary.tsx`.
- No menu lateral (`AppLayout`), transformar o item "Relatórios" num grupo colapsável (mesmo padrão de "Cadastros"), com dois subitens:
  - **Por Empresa** → `/relatorios/por-empresa`
  - **Resumo Completo** → `/relatorios/resumo-completo`
- Acrescentar `routeLabels["/relatorios/resumo-completo"] = "Relatórios"`.
- Ambas exigem `relatorios.view` (mesma permissão atual).

## Estrutura de dados (novo helper)

Novo arquivo `src/lib/reportSummaryData.ts`:

- Função `buildReportSummaryData({ month, companies, allBatches, allEmployees, allEntries, rubrics })`.
- Para cada empresa ativa, internamente reusa `buildReportByCompanyData` (não duplica regra de seleção de batch nem de leitura de valores canônicos — `salario_real`, `g2_complemento`, `salario_liquido` vêm da mesma fonte via `calculatePayrollFromEntry` + `resolveCanonicalDerivedRubricIds`).
- Agrega por rubrica somando os totais por empresa: `companyTotals[companyId][rubricId]`.
- Calcula:
  - `headcount` por empresa (contagem de linhas/funcionários no dataset da empresa).
  - `totalGeral` por rubrica (soma de todas as empresas).
  - `semMov` por rubrica: soma das empresas marcadas como "sem movimento" — definição simples: empresa sem nenhuma linha na competência (headcount = 0). Se nenhuma se enquadrar, a coluna fica zerada (compatível com o legado).
  - Linhas finais derivadas: `Rendimentos` (= soma de todas rubricas tipo `provento`), `Descontos` (= soma de todas rubricas tipo `desconto`), `Custo médio por Func.` (= `salario_real` / headcount por empresa; total = soma `salario_real` / soma headcount). Estas linhas usam exclusivamente totais já calculados — sem novo motor.
- Ordenação das linhas: respeita `display_order` das rubricas (igual ao relatório por empresa); linhas iniciais fixas (`Total de Funcionários`) e linhas finais fixas (`Rendimentos`, `Descontos`, `Custo médio por Func.`) ficam separadas.

## Geração do PDF

Novo arquivo `src/lib/reportSummaryPdf.ts`, baseado em `reportByCompanyPdf.ts` (reutiliza jsPDF + autoTable, formatação BRL, footer "Reginatto SI", título e rodapé):

- Paisagem A4, margens pequenas.
- Título: `Resumo de Folha de Pagamento - <MÊS-YY>` (ex.: `ABRIL-26`), no formato do legado.
- Primeira coluna larga ("Rubrica"); colunas por empresa com largura uniforme; colunas finais `TOTAL` e `SEM MOV.`.
- Header cinza escuro com texto claro, bordas finas, fonte pequena (~4.7-5pt), valores alinhados à direita, headcount centralizado.
- Linhas `Salário Real`, `Salário G2 complem.`, `Salário Líquido`, `Rendimentos`, `Descontos`, `Custo médio por Func.` com fundo cinza e negrito.
- Cabeçalho repetido em quebra de página.
- Fallback para muitas empresas: reduz fonte e largura até o limite legível; se ainda assim estourar (>~16 empresas), quebra horizontalmente em páginas adicionais mantendo a coluna "Rubrica" e replicando `TOTAL`/`SEM MOV.` na última página. Implementação inicial: apenas redução de fonte/largura uniforme (mesma estratégia do relatório por empresa); quebra horizontal só se necessário em iteração futura.

## Tela `ReportsSummary.tsx`

Padrão visual igual ao `ReportsCompany.tsx`:

- Card de filtros com **um único Select de competência** (lista combinada de todos os batches não arquivados de todas as empresas, deduplicados por `month/year`, ordenados desc).
- Botão **"Gerar PDF"** → chama `generateReportSummaryPdf(dataset)`.
- Pré-visualização opcional simples (tabela HTML compacta) com os mesmos dados, para conferência antes de exportar. Pode ser implementada de forma básica reaproveitando componentes `Table` do shadcn.
- Sem CSV nesta versão (escopo mínimo conforme pedido).

## Arquivos

Criar:
- `src/lib/reportSummaryData.ts`
- `src/lib/reportSummaryPdf.ts`
- `src/pages/ReportsSummary.tsx`

Editar:
- `src/App.tsx` — registrar rota `/relatorios/resumo-completo`.
- `src/components/layout/AppLayout.tsx` — converter "Relatórios" em grupo colapsável com 2 subitens; atualizar `routeLabels`.

Não editar: `reportByCompanyData.ts`, `reportByCompanyPdf.ts`, `reportByCompanyExcel.ts`, `payrollSpreadsheet.ts`, contexto, Central, recibos.

## Regras respeitadas (PRDs)

- PRD-08: relatório só lê, não recalcula.
- PRD-12: canônicas via mesma resolução do relatório por empresa (`resolveCanonicalDerivedRubricIds` + `calculatePayrollFromEntry`).
- PRD-00/00B: simples, previsível, sem nova fonte de verdade.

## Validações manuais

1. Menu Relatórios mostra dois subitens; "Por Empresa" continua funcionando idêntico.
2. Nova tela aparece em `/relatorios/resumo-completo`.
3. Seleção de competência lista todos os meses com folhas ativas.
4. PDF abre em paisagem, título no formato `Resumo de Folha de Pagamento - ABRIL-26`.
5. Coluna por empresa, linhas com rubricas + linhas finais (Rendimentos/Descontos/Custo médio).
6. `Salário Real`, `G2 Complemento` e `Salário Líquido` batem com Central e com Relatório por Empresa para cada empresa.
7. `TOTAL` por linha = soma das colunas de empresas.
8. `SEM MOV.` zerada quando todas as empresas têm movimento.
9. Relatório por Empresa segue gerando PDF/CSV sem alterações.
