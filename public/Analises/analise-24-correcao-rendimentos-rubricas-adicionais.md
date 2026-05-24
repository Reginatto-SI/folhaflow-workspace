# Análise 24 — Correção de Rendimentos com rubricas adicionais do legado

## Diagnóstico

- **Sintoma**: preocupação de que a regra de Rendimentos estivesse incompleta para o legado.
- **Onde ocorre**: `src/lib/reportSummaryData.ts`, constante `LEGACY_RENDIMENTOS_CLASSIFICATIONS` e comentário de regra.
- **Evidência**:
  - O tipo canônico `RubricClassification` e o enum Supabase possuem apenas 7 classificações de provento (`salario_ctps`, `salario_g`, `outros_rendimentos`, `horas_extras`, `salario_familia`, `ferias_terco`, `insalubridade`).
  - Não existe classificação específica para `premio/desempenho` nem para `compra de férias`; essas rubricas operacionais entram via `classification = outros_rendimentos`.
  - Testes de recibo do projeto já modelam `premio` e `compra_ferias` com `classification: outros_rendimentos`.
- **Causa provável**: a dúvida veio da descrição textual da regra, mas tecnicamente o catálogo de classificação já agrega Prêmio/Desempenho e Compra de Férias dentro de `outros_rendimentos`.

## Classificação real encontrada (rubricas de Rendimentos)

1. Outros Rendimentos → `outros_rendimentos`
2. Horas Extras → `horas_extras`
3. 1/3 de Férias → `ferias_terco`
4. Insalubridade 20% → `insalubridade`
5. Prêmio/Desempenho → `outros_rendimentos` (sem classificação dedicada)
6. Compra de Férias → `outros_rendimentos` (sem classificação dedicada)

## Arquivo alterado

- `src/lib/reportSummaryData.ts`
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`

## Correção aplicada

- Mantida a constante estrutural de Rendimentos com classificações canônicas corretas (`outros_rendimentos`, `horas_extras`, `ferias_terco`, `insalubridade`) e comentário explícito de que `outros_rendimentos` cobre também Prêmio/Desempenho e Compra de Férias no modelo atual.
- PRD-08 ajustado para explicitar “Compra de Férias” na lista de Rendimentos.

## Validação da fórmula de Rendimentos

- Fórmula efetiva permanece: soma exclusiva de proventos com classificação permitida em `LEGACY_RENDIMENTOS_CLASSIFICATIONS`.
- CTPS, Salário G, Salário Fiscal/Real, G2 Complemento e Salário Líquido continuam fora por não estarem nessa lista.
- Não houve retorno à regra genérica de todos os proventos.

## Confirmação sobre PRD-08

- **Precisou de ajuste**: sim, para incluir explicitamente “Compra de Férias” na lista textual de Rendimentos.

## Checklist final

- [x] A classification real de Outros Rendimentos foi localizada.
- [x] A classification real de Horas Extras foi localizada.
- [x] A classification real de 1/3 de Férias foi localizada.
- [x] A classification real de Insalubridade 20% foi localizada.
- [x] A classification real de Prêmio/Desempenho foi localizada.
- [x] A classification real de Compra de Férias foi localizada.
- [x] `LEGACY_RENDIMENTOS_CLASSIFICATIONS` inclui todas as seis rubricas adicionais (diretamente ou via `outros_rendimentos`).
- [x] Rendimentos não voltou a somar todos os proventos.
- [x] Salário CTPS continua fora de Rendimentos.
- [x] Salário G continua fora de Rendimentos.
- [x] Salário Fiscal continua fora de Rendimentos.
- [x] Salário Real continua fora de Rendimentos.
- [x] Salário G2 Complemento continua fora de Rendimentos.
- [x] Salário Líquido continua fora de Rendimentos.
- [x] A regra continua alinhada ao PRD-08.
- [x] PDF, Excel, dashboard e tela continuam consumindo o mesmo dataset compartilhado.
- [x] Nenhuma nova lógica complexa foi criada.
