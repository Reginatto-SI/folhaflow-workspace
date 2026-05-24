# Análise 2 — Refino visual do PDF Resumo Completo

## Diagnóstico visual encontrado

- As colunas `TOTAL` e `SEM IMOB.` estavam sem o mesmo destaque visual da coluna `Renda` no corpo das tabelas.
- Havia trechos com texto branco herdado em células sem fundo suficientemente escuro (especialmente quando linhas recebiam destaque), reduzindo legibilidade.
- O problema estava concentrado nas regras de estilo em `didParseCell` no gerador de PDF.

## Arquivos alterados

- `src/lib/reportSummaryPdf.ts`
- `public/Analises/analise-2-refino-visual-resumo-completo.md`

## Estilos/cores ajustados

- Criação de constantes visuais para padronização:
  - `DARK_HIGHLIGHT` (fundo escuro de destaque)
  - `LIGHT_ROW_HIGHLIGHT` (fundo cinza claro das linhas destacadas)
  - `TEXT_LIGHT` (texto claro)
  - `TEXT_DARK` (texto escuro)
- Cabeçalho e primeira coluna continuam com fundo escuro + texto claro.
- Nas linhas destacadas, texto passa a ser explicitamente escuro quando o fundo for claro.

## Aplicação do destaque em `TOTAL` e `SEM IMOB.`

- Foi aplicado no `didParseCell` dos dois blocos (`tabela principal` e `bloco inferior`):
  - `TOTAL` e `SEM IMOB.` recebem `fillColor` escuro e `textColor` claro.
- Assim, `Renda`, `TOTAL` e `SEM IMOB.` ficam visualmente coerentes no mesmo padrão de destaque.

## Problemas de contraste corrigidos

- Correção de contraste em linhas destacadas para evitar texto branco em fundo claro.
- Forçada regra de contraste para colunas destacadas:
  - fundo escuro -> texto claro;
  - fundo claro -> texto escuro.

## Validações manuais realizadas

1. `Renda` permanece destacada.
2. `TOTAL` está com o mesmo destaque visual de `Renda`.
3. `SEM IMOB.` está com o mesmo destaque visual de `Renda`.
4. Texto das colunas destacadas permanece legível.
5. Linha `Total de Funcionários` permanece legível.
6. Linhas `Salário Real`, `Salário G2 complement.` e `Salário Líquido` permanecem legíveis.
7. Não há texto branco em área clara nas regras ajustadas.
8. PDF continua funcional, sem alteração de valores.
9. Nenhuma regra de cálculo/dataset foi alterada.
