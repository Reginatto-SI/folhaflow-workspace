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

- A lista original de colunas do relatório é montada em `src/lib/reportByCompanyData.ts`, dentro de `buildReportByCompanyData(...)`.
- As colunas dinâmicas vêm das rubricas ativas (`rubrics.filter((rubric) => rubric.isActive)`), ordenadas por `rubric.order`.
- O PDF agora aplica uma camada de apresentação em `src/lib/reportByCompanyPdf.ts` para seguir a ordem oficial informada pelo usuário, sem mudar o dataset da tela nem o Excel/CSV.

## Nova fonte de verdade da ordem das colunas do PDF

A fonte de verdade de apresentação do PDF passou a ser a ordem oficial informada pelo usuário:

1. `Nome`
2. `Setor`
3. `Função`
4. `Admissão / Registro`
5. `Salário CTPS`
6. `Salário G`
7. `(+) Outros Rendim.`
8. `(+) Horas Extras`
9. `(+) 1/3 de Férias`
10. `(+) Premio.Desemp.`
11. `(-) Emprést. Consig.`
12. `(+) Compra de Férias`
13. `(-) INSS`
14. `(-) Vales / Descontos`
15. `(-) Faltas / Desconto`
16. `Salário Fiscal`
17. `Salário G2 complem.`
18. `Salário Líquido`

Rubricas inexistentes nessa sequência são omitidas com segurança, sem inventar coluna nem valor.

## Onde estava a formatação dos valores monetários

- A formatação monetária do PDF estava em `src/lib/reportByCompanyPdf.ts`, no helper local `formatPdfCurrency`.
- Antes do ajuste, valores que arredondavam para zero eram explicitamente exibidos como `R$ 0,00`.
- O PDF agora usa `formatPdfCurrencyBlankWhenZero(...)`, preservando BRL para valores diferentes de zero e deixando zeros/nulos/indefinidos em branco.

## Diferenças identificadas entre valores de salário

- `Salário CTPS`: rubrica base/classificação `salario_ctps`, valor operacional/cadastral já presente no dataset da folha.
- `Salário da folha`: valores lidos do lançamento (`earnings`, `deductions` e campos oficiais persistidos) conforme a rubrica.
- `Salário Real`: rubrica canônica derivada (`salario_real`) identificada pelo resolvedor canônico existente da Central, mas removida da apresentação deste PDF.
- `Salário Fiscal`, `Salário G2 complem.` e `Salário Líquido`: colunas finais oficiais de resultado no PDF, apenas exibidas com valores já vindos do dataset.

## O que foi alterado

1. `ReportDynamicColumn` carrega metadados técnicos já existentes da rubrica:
   - `rubricClassification`, para identificar rubricas por classificação operacional quando disponível.
   - `isCanonicalSalarioReal`, para identificar e remover a rubrica canônica `Salário Real` via resolvedor canônico já utilizado pela Central.
2. O PDF monta uma lista própria de colunas de apresentação:
   - segue exatamente a ordem oficial informada;
   - coloca `Salário CTPS` como primeira coluna dinâmica, logo após `Admissão / Registro`;
   - remove `Salário Real` em qualquer hipótese;
   - omite rubricas oficiais inexistentes sem inventar dados;
   - não carrega colunas fora da ordem oficial para esse PDF.
3. A regra anterior de mover CTPS para o lugar antigo de `Salário Real` foi corrigida: CTPS não substitui mais visualmente a posição final de Salário Real.
4. A formatação monetária do PDF mantém `formatPdfCurrencyBlankWhenZero(...)`:
   - `0`, `0.00`, `R$ 0,00`, `null`, `undefined` e equivalentes numéricos zerados exibem célula vazia;
   - valores diferentes de zero continuam formatados em moeda brasileira.
5. O destaque visual final permanece apenas para as colunas oficiais de resultado:
   - `Salário Fiscal`;
   - `Salário G2 complem.`;
   - `Salário Líquido`.

## Confirmação de que não houve alteração no cálculo da folha

- Não foi alterado `calculatePayrollFromEntry`.
- Não foi alterada regra de fórmula, motor de cálculo, persistência, banco, Supabase, RLS ou rubricas canônicas.
- A alteração é apenas de apresentação e montagem de colunas no PDF.
- `Salário CTPS` continua usando o valor já presente em `row.rubricValues[column.rubricId]`.
- `Salário Real` não foi usado para preencher `Salário CTPS` e segue removido do PDF.

## Checklist dos critérios de aceite

- [x] PDF da `/central-de-folha` usa o gerador compartilhado ajustado.
- [x] PDF de `/relatorios/por-empresa` usa o gerador compartilhado ajustado.
- [x] `Salário Real` não entra mais na lista de colunas do PDF.
- [x] `Salário CTPS` aparece logo após `Admissão / Registro`.
- [x] As demais colunas seguem a ordem oficial quando existem.
- [x] Rubricas inexistentes são omitidas sem inventar coluna ou valor.
- [x] Valores monetários zerados nas linhas ficam em branco.
- [x] Totais zerados no rodapé ficam em branco.
- [x] Valores monetários diferentes de zero continuam em BRL (`R$ 3.000,00`).
- [x] Nenhum cálculo da folha foi alterado.
- [x] Nenhum dado salvo foi alterado.
- [x] Layout geral do PDF foi preservado, mudando apenas a ordem/seleção de colunas solicitada e exibição de zeros.

## Testes cobertos

- [x] Ordem oficial completa das colunas dinâmicas do PDF.
- [x] Remoção de `Salário Real`.
- [x] `Salário CTPS` logo após as colunas fixas.
- [x] Omissão segura de rubricas inexistentes.
- [x] Garantia de que `Salário CTPS` não é mais movido para a posição antiga de `Salário Real`.
- [x] Destaque visual apenas das colunas finais oficiais de resultado.
- [x] Valores zerados continuam em branco.
- [x] Valores não zerados continuam em BRL.

## Possíveis pontos de atenção encontrados

- Para rubricas com classificação genérica `outros_rendimentos` (ex.: Outros Rendimentos, Prêmio/Desempenho e Compra de Férias), a ordenação oficial usa classificação mais código/nome normalizados para diferenciar cada coluna sem depender apenas do rótulo visual.
- O Excel/CSV não foi alterado porque o escopo solicitado foi somente PDF e o gerador de PDF possui camada própria de apresentação.

## Refinamento visual — altura padronizada das linhas

- **Causa provável:** a coluna `Função/Cargo` podia receber descrições longas e, com `overflow: "linebreak"` no `autoTable`, quebrava o texto em várias linhas, aumentando a altura da linha inteira.
- **Ajuste aplicado:** foi criado o helper `formatJobRoleForPrint(...)` em `src/lib/reportByCompanyPdf.ts`, usado somente na montagem do corpo do PDF. Ele normaliza espaços, aplica abreviações simples para termos comuns e trunca de forma controlada quando o cargo ainda excede o tamanho seguro para impressão.
- **Controle visual no autoTable:** a coluna `Função/Cargo` passou a usar `overflow: "ellipsize"`, mantendo a largura atual e evitando que textos longos expandam indefinidamente a altura da linha.
- **Escopo preservado:** a alteração é exclusivamente visual no PDF. Não altera cadastro de cargos, cadastro de funcionários, cálculo da folha, valores monetários, recibos, Excel/CSV, banco de dados ou rubricas canônicas.
- **Compatibilidade mantida:** a ordem oficial das colunas continua igual, `Salário Real` segue removido e valores monetários zerados continuam em branco.

## Refinamento visual — Compra de Férias e centralização dos valores

- **Diagnóstico da ausência visual:** a rubrica `(+) Compra de Férias` já existia na lista oficial do gerador de PDF, porém o matcher aceitava apenas o token normalizado `compra ferias`. Isso cobria códigos técnicos como `COMPRA_FERIAS`, mas podia falhar quando a rubrica viesse com código legado/numérico e nome visual contendo a preposição, como `(+) Compra de Férias`.
- **Ajuste aplicado no matcher:** a identificação de Compra de Férias passou a aceitar também o token normalizado `compra de ferias`, usando código/nome normalizados já presentes em `ReportDynamicColumn`. O ajuste continua sem criar rubrica, sem inventar valor e sem mexer no cadastro; ele apenas reconhece a rubrica quando ela já está no dataset do relatório.
- **Posição confirmada:** quando a rubrica existe no dataset, `(+) Compra de Férias` é inserida pela ordem oficial exatamente depois de `(-) Emprést. Consig.` e antes de `(-) INSS`. Quando não existe, a coluna é omitida sem erro.
- **Ajuste visual de alinhamento:** os valores das colunas monetárias/dinâmicas passaram de alinhamento à direita para alinhamento centralizado no PDF, inclusive na linha `TOTAL`. A coluna `Admissão/Registro` permanece centralizada, enquanto `Nome`, `Setor` e `Função/Cargo` permanecem alinhadas à esquerda.
- **Escopo preservado:** a alteração foi apenas visual/de montagem do PDF compartilhado por `/central-de-folha` e `/relatorios/por-empresa`.
- **Sem impacto em regras de negócio:** não houve alteração em cálculo da folha, `calculatePayrollFromEntry`, banco de dados, persistência, recibos, Excel/CSV, telas fora do escopo ou rubricas canônicas.
- **Compatibilidade mantida:** `Salário Real` continua removido, `Salário CTPS` continua logo após as colunas fixas, valores monetários zerados continuam em branco e `Função/Cargo` continua limitada somente na impressão para preservar altura visual uniforme das linhas.

## Refinamento visual — valores monetários em negrito

- **Ajuste aplicado:** o corpo do PDF passou a usar um helper único de estilo por índice de coluna. `Nome`, `Setor` e `Função/Cargo` continuam alinhados à esquerda; `Admissão/Registro` continua centralizada; e todas as colunas monetárias/dinâmicas, a partir de `Salário CTPS`, ficam centralizadas e em negrito.
- **Linha TOTAL preservada:** o destaque visual existente da linha `TOTAL` foi mantido, incluindo fundo escuro, texto claro e negrito. Os valores monetários do `TOTAL` continuam centralizados e em negrito.
- **Segurança do matcher de Compra de Férias:** a identificação continua aceitando `compra ferias`, `compra de ferias`, códigos como `COMPRA_FERIAS` e nomes como `(+) Compra de Férias`, mas agora permanece restrita a rubricas sem classificação técnica ou com `rubricClassification = outros_rendimentos`, evitando correspondência ampla demais.
- **Escopo visual:** a alteração é apenas de apresentação no PDF compartilhado por `/central-de-folha` e `/relatorios/por-empresa`.
- **Sem impacto operacional:** não houve alteração em cálculo da folha, `calculatePayrollFromEntry`, banco de dados, persistência, recibos, Excel/CSV, telas fora do escopo ou rubricas canônicas.
