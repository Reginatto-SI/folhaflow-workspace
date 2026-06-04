# Análise 1 — Ajuste PDF relatório da folha: Salário CTPS e valores zerados

## Arquivos alterados

- `src/lib/reportByCompanyData.ts`
- `src/lib/reportByCompanyPdf.ts`
- `src/lib/reportByCompanyPdf.test.ts`
- `public/Analises/analise-1-ajuste-pdf-relatorio-folha.md`

## Fontes de verdade consultadas

- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-00B — Modelo Operacional Simplificado.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`

Conclusão dos PRDs: o relatório deve apenas refletir dados já calculados/persistidos pela Central de Folha, sem criar cálculo paralelo, sem nova fonte de dados e sem alterar rubricas canônicas.

## Onde o PDF é gerado

### `/central-de-folha`

- A Central de Folha chama `buildReportByCompanyData(...)` e em seguida `generateReportByCompanyPdf(dataset)` no fluxo de geração do relatório por empresa.
- Portanto, a Central usa o mesmo dataset e o mesmo gerador de PDF do relatório por empresa.

### `/relatorios/por-empresa`

- A tela `ReportsCompany` monta o mesmo `dataset` com `buildReportByCompanyData(...)`.
- O botão de PDF chama `generateReportByCompanyPdf(dataset)`.

## Onde estava a configuração das colunas

- A lista de colunas do relatório é montada em `src/lib/reportByCompanyData.ts`, dentro de `buildReportByCompanyData(...)`.
- As colunas dinâmicas vêm das rubricas ativas (`rubrics.filter((rubric) => rubric.isActive)`), ordenadas por `rubric.order`.
- Antes do ajuste, o PDF consumia `dataset.dynamicColumns` diretamente, por isso `Salário CTPS` permanecia na posição original da rubrica e `Salário Real` continuava aparecendo no final.

## Onde estava a formatação dos valores monetários

- A formatação monetária do PDF estava em `src/lib/reportByCompanyPdf.ts`, no helper local `formatPdfCurrency`.
- Antes do ajuste, valores que arredondavam para zero eram explicitamente exibidos como `R$ 0,00`.

## Diferenças identificadas entre valores de salário

- `Salário CTPS`: rubrica base/classificação `salario_ctps`, valor operacional/cadastral já presente no dataset da folha.
- `Salário da folha`: valores lidos do lançamento (`earnings`, `deductions` e campos oficiais persistidos) conforme a rubrica.
- `Salário Real`: rubrica canônica derivada (`salario_real`) identificada pelo resolvedor canônico existente da Central, sem regra nova no relatório.
- `Salário Líquido`: rubrica canônica derivada (`salario_liquido`) e/ou campo oficial `netSalary`, conforme fallback já existente.

## O que foi alterado

1. `ReportDynamicColumn` passou a carregar metadados técnicos já existentes da rubrica:
   - `rubricClassification`, para identificar `Salário CTPS` sem usar nome da coluna.
   - `isCanonicalSalarioReal`, para identificar a rubrica canônica `Salário Real` via resolvedor canônico já utilizado pela Central.
2. O PDF passou a montar uma lista própria de colunas de apresentação:
   - remove a coluna canônica `Salário Real`;
   - remove a ocorrência original de `Salário CTPS` somente quando ela realmente substitui `Salário Real`;
   - reinsere `Salário CTPS` exatamente no ponto onde `Salário Real` apareceria;
   - preserva `Salário CTPS` na posição original quando `Salário Real` não existe.
3. A formatação monetária do PDF passou a usar `formatPdfCurrencyBlankWhenZero(...)`:
   - `0`, `0.00`, `null`, `undefined` e valores numericamente zerados exibem célula vazia;
   - valores diferentes de zero continuam formatados em moeda brasileira.
4. A mesma regra é aplicada às linhas e ao total do rodapé do PDF.

## Confirmação de que não houve alteração no cálculo da folha

- Não foi alterado `calculatePayrollFromEntry`.
- Não foi alterada regra de fórmula, motor de cálculo, persistência, banco, Supabase, RLS ou rubricas canônicas.
- A alteração é apenas de metadados para apresentação e montagem das colunas no PDF.
- `Salário CTPS` continua usando o valor já presente em `row.rubricValues[column.rubricId]`.
- `Salário Real` não foi usado para preencher `Salário CTPS`.

## Checklist dos critérios de aceite

- [x] PDF da `/central-de-folha` usa o gerador compartilhado ajustado.
- [x] PDF de `/relatorios/por-empresa` usa o gerador compartilhado ajustado.
- [x] `Salário Real` não entra mais na lista de colunas do PDF.
- [x] `Salário CTPS` é exibido no lugar onde a coluna canônica `Salário Real` aparecia.
- [x] Valores monetários zerados nas linhas ficam em branco.
- [x] Totais zerados no rodapé ficam em branco.
- [x] Valores monetários diferentes de zero continuam em BRL (`R$ 3.000,00`).
- [x] Nenhum cálculo da folha foi alterado.
- [x] Nenhum dado salvo foi alterado.
- [x] Layout geral do PDF foi preservado, mudando apenas colunas solicitadas e exibição de zeros.

## Possíveis pontos de atenção encontrados

- O destaque visual das colunas finais ainda preserva a compatibilidade legada por rótulo/código já existente (`isResultColumn`), mas agora passa pelo helper de apresentação `isHighlightedPayrollPdfColumn(...)` para também destacar o CTPS apenas quando ele substitui o Salário Real no PDF.
- O Excel/CSV não foi alterado porque o escopo solicitado foi somente PDF.
- Se não existir rubrica classificada como `salario_ctps`, o PDF apenas removerá `Salário Real`, sem inventar valor alternativo.

## Refinamento final — segurança visual/lógica

Após a primeira implementação, foram revisados dois pontos de segurança:

1. **Destaque visual do CTPS substituto**
   - A coluna `Salário CTPS`, quando substitui a posição da coluna canônica `Salário Real`, recebe a marca de apresentação `isSubstitutingSalarioReal`.
   - O destaque visual do PDF passou a considerar `isHighlightedPayrollPdfColumn(...)`, que mantém o destaque das colunas finais já existentes e também destaca o CTPS quando ele estiver substituindo o Salário Real.
   - Isso preserva cabeçalho destacado, fundo suave nas linhas, negrito e largura/alinhamento compatíveis com a posição substituída.

2. **Preservação do CTPS quando Salário Real não existe**
   - `buildPayrollPdfDynamicColumns(...)` agora só remove a posição original de `Salário CTPS` quando existe `Salário Real` canônico para ser substituído.
   - Se `Salário Real` não existir, `Salário CTPS` permanece na posição original.
   - Se `Salário Real` existir sem `Salário CTPS`, apenas o `Salário Real` é removido, sem criar coluna substituta.
   - Se nenhum dos dois existir, as demais colunas permanecem inalteradas.

## Testes do refinamento

- [x] CTPS substitui Salário Real quando ambos existem.
- [x] CTPS permanece na posição original quando Salário Real não existe.
- [x] Salário Real é removido quando CTPS não existe.
- [x] Demais colunas permanecem quando não existem Salário Real nem CTPS.
- [x] CTPS substituta é tratada como coluna destacada no PDF.
- [x] Valores zerados continuam em branco.
- [x] Valores não zerados continuam em BRL.
