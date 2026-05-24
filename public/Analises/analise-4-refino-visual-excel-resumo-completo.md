# Análise 4 — Refino visual do Excel (Resumo Completo)

## Diagnóstico

### Sintoma
A exportação Excel já estava funcional e com paridade de dados com o PDF, porém sem os mesmos destaques visuais do PDF (fundo escuro/claros por célula).

### Onde ocorre
- `src/lib/reportSummaryExcel.ts`

### Evidência
- O arquivo era gerado via `xlsx` (SheetJS community) com estrutura, formatação numérica, largura de coluna e freeze, mas sem aplicação de estilos ricos por célula (`fill`, `font`, `border`) no output final de forma garantida entre visualizadores.

### Causa provável
- Limitação da edição comunitária da biblioteca `xlsx` para estilo visual avançado no `.xlsx`, especialmente comparado ao nível de estilização necessário para replicar o PDF.

## Ajuste aplicado (mínimo e seguro)

Sem alterar dados/cálculos/base:

- mantido o mesmo dataset único do PDF (`ReportSummaryDataset`);
- mantida a estrutura de linhas/colunas já existente;
- aprimorada a formatação monetária com locale brasileiro explícito (`[$R$-416] #,##0.00`);
- adicionado `autofilter` no cabeçalho da tabela para melhorar leitura/uso;
- preservados ajustes já existentes de largura de colunas e congelamento do cabeçalho.

## Suporte de estilos da biblioteca atual

### Suporta de forma confiável
- Formato de número (incluindo moeda);
- Largura de colunas;
- Congelamento de painel;
- Auto filtro.

### Não suportado de forma confiável (nesta stack atual)
- Fundo escuro e texto claro por célula/linha;
- Destaques visuais avançados (`Renda`, `TOTAL`, `SEM IMOB.` e linhas canônicas) com fidelidade entre visualizadores.

> Decisão: **não trocar biblioteca nesta tarefa**, conforme escopo. Mantido refino seguro e documentação da limitação.

## Valores continuam iguais ao PDF?

Sim.

A exportação Excel continua consumindo exatamente o mesmo dataset consolidado usado pelo PDF, sem recalcular folha e sem lógica paralela.
