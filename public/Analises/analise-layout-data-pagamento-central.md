# Análise — Layout da Data de pagamento na Central de Folha

## Diagnóstico visual anterior

O cabeçalho da `/central-de-folha` estava separado em dois blocos independentes:

- bloco com Empresa, Competência, Status e Data de pagamento;
- bloco separado com os botões de ação.

Isso criava sensação de desalinhamento, com ações "soltas" visualmente.

## Arquivos revisados

- `src/components/payroll/PayrollHeader.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Index.tsx`
- `src/components/payroll/Receipt.tsx`
- `src/components/payroll/ReceiptPrintView.tsx`

## Arquivos alterados

- `src/components/payroll/PayrollHeader.tsx`
- `public/Analises/analise-layout-data-pagamento-central.md`

## Como ficou o layout

O header foi reorganizado para um card único de operação:

- linha principal com Empresa, Competência, Status e Data de pagamento;
- botões (`Criar nova folha`, `Novo lançamento`, `Gerar recibos`, `Gerar relatório`, `...`) integrados dentro do mesmo card, abaixo e alinhados.

Resultado:

- layout mais compacto;
- ações deixam de parecer bloco isolado;
- responsividade preservada com `flex-wrap`.

## Como a sugestão de data funciona

### Folhas novas

Já estava correto no contexto: `ensureCurrentBatch` cria `payment_date` com `getSuggestedPaymentDate(month, year)` (dia 5 do mês seguinte).

### Folhas duplicadas

Já estava correto no contexto: `duplicatePayroll` cria batch novo com `payment_date` calculada por `getSuggestedPaymentDate(targetMonth.month, targetMonth.year)`.

### Folhas antigas sem `payment_date`

Não há preenchimento em massa no banco.

Na UI, quando `currentBatch.paymentDate` está vazio:

- aparece texto discreto `Sugestão: DD/MM/AAAA`;
- aparece botão `Usar sugestão`;
- só ao clicar o RH grava a data sugerida na folha.
- O `PayrollHeader` reutiliza o helper oficial `getSuggestedPaymentDate(month, year)` do contexto, evitando duplicidade de regra.

## Persistência da Data de pagamento e recibos

- Campo continua editável via input `type=date`.
- Salvamento principal ocorre no `onBlur` (mudança mínima, sem salvar a cada render).
- Se o usuário clicar em `Gerar recibos` sem sair do campo:
  - o sistema tenta salvar a data pendente antes de abrir os recibos.

Isso reduz risco de emitir recibo com data antiga.

## Garantia de uso no recibo

Fluxo confirmado:

1. `Index.tsx` passa `currentBatch?.paymentDate` para `ReceiptPrintView`.
2. `ReceiptPrintView` repassa para `Receipt`.
3. `Receipt` renderiza a data por extenso a partir de `paymentDate`.

Logo, recibo usa a data salva na folha (não usa data atual do computador como fonte principal).

## Validação técnica solicitada

1. `getSuggestedPaymentDate` na criação: **confirmado**.
2. `getSuggestedPaymentDate` na duplicação: **confirmado**.
3. Central exibe `currentBatch.paymentDate`: **confirmado** (`PayrollHeader`).
4. Alteração no input persiste em `payroll_batches.payment_date`: **confirmado** (`updateCurrentBatchPaymentDate`).
5. Recibo recebe `currentBatch.paymentDate`: **confirmado** (`Index` -> `ReceiptPrintView` -> `Receipt`).
6. Risco de data antiga ao gerar sem blur: **mitigado** com salvamento prévio em `Gerar recibos`.

## Testes executados

- `npm run build` (executado para validar build do projeto).
- `npm run lint` (executado; mantém falhas preexistentes fora do escopo desta tarefa).

## Confirmação de escopo preservado

Não foram alterados:

- cálculo da folha;
- rubricas;
- compra de férias/dias;
- salário real, G2 complemento, salário líquido;
- AppLayout;
- tabela de funcionários;
- cards de resumo;
- relatório PDF por empresa.
