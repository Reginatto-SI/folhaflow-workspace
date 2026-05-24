# Análise 25 — Validação visual da linha Rendimentos após ajuste das rubricas adicionais

## Diagnóstico

- **Sintoma**: necessidade de confirmar se a linha **Rendimentos** realmente agrega as rubricas adicionais esperadas do legado, incluindo `Prêmio/Desemp.` e `Compra de Férias`.
- **Onde ocorre**: montagem do dataset consolidado em `buildReportSummaryData` (`src/lib/reportSummaryData.ts`), consumido por tela, PDF, Excel e dashboard.
- **Evidência de regra ativa**:
  - A linha Rendimentos usa lista fechada por `classification` (`outros_rendimentos`, `horas_extras`, `ferias_terco`, `insalubridade`), sem fallback por label e sem soma de todos os proventos.
  - `Prêmio/Desemp.` e `Compra de Férias` no modelo atual entram como `classification = outros_rendimentos`.

## Conferência prática (exemplo controlado)

Validação executada com teste automatizado em `src/lib/reportSummaryData.test.ts` (1 empresa, 1 funcionário, 1 lançamento):

### Valores de rubricas

- (+) Outros Rendim.: **100**
- (+) Horas Extras: **200**
- (+) 1/3 de férias: **300**
- (+) Insalub. 20%: **400**
- (+) Premio/Desemp.: **500**
- (+) Compra de Férias: **600**

Rubricas fora de Rendimentos no mesmo cenário:

- Salário CTPS: 1000
- Salário G: 2000
- INSS (desconto): 50

### Soma manual esperada

`100 + 200 + 300 + 400 + 500 + 600 = 2.100`

### Valor exibido em Rendimentos

- Linha `__rendimentos__` no dataset consolidado: **2.100**

### Resultado

- **BATE** (Rendimentos = soma das seis rubricas adicionais).

## Arquivos analisados

- `src/lib/reportSummaryData.ts`
- `src/types/payroll.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/receiptData.test.ts`
- `src/lib/reportSummaryData.test.ts`

## Correção aplicada

- Não foi necessária nova correção de regra nesta tarefa.
- Foi adicionada validação automatizada objetiva para evitar regressão futura da linha Rendimentos.

## Checklist final

- [x] Rendimentos soma as rubricas adicionais esperadas.
- [x] Prêmio/Desemp. está incluído via `outros_rendimentos`.
- [x] Compra de Férias está incluída via `outros_rendimentos`.
- [x] Salário CTPS não entra em Rendimentos.
- [x] Salário G não entra em Rendimentos.
- [x] Salário Fiscal/Real/G2/Líquido não entram em Rendimentos.
- [x] Descontos não entram em Rendimentos.
- [x] Não houve mudança de arquitetura, classificação ou motor de cálculo.
- [x] Dataset compartilhado (tela/PDF/Excel/dashboard) foi preservado.
