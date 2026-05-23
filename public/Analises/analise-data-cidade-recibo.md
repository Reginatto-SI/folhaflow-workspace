# Análise — data de pagamento e cidade/UF no recibo

## Diagnóstico do comportamento anterior
- PDF do recibo era renderizado em `src/components/payroll/Receipt.tsx`.
- Linha de local/data estava fixa como `Sorriso - MT, Data: ______/______/______`.
- Portanto havia cidade fixa e data em branco.

## Onde estava a cidade fixa
- `src/components/payroll/Receipt.tsx` (linha do `<p className="receipt-local">`).

## Onde estava a data em branco
- Mesmo ponto em `src/components/payroll/Receipt.tsx`.

## Entidade da folha/lote/competência
- Entidade formal: `payroll_batches` (mapeada em `PayrollBatch`).
- Armazena empresa, mês, ano e status operacional.

## Criação manual da folha
- Fluxo por `ensureCurrentBatch` em `src/contexts/PayrollContext.tsx`.
- Ao abrir competência sem lote ativo, cria novo `payroll_batches`.

## Duplicação da folha
- Fluxo em `duplicatePayroll` no `PayrollContext`.
- Cria novo batch e copia apenas rubricas manuais selecionadas (sem recalcular no recibo).

## Como o recibo acessa dados da empresa
- `ReceiptPrintView` passa `company` para `Receipt`.
- `Receipt` usa cadastro da empresa para exibição.

## Campos de empresa para cidade/UF
- Antes: apenas `address` em texto livre.
- Agora: `city` e `state` estruturados na tabela `companies` e no formulário `/empresas`.

## Campo de data de pagamento
- Campo usado: `payment_date` em `payroll_batches`.
- Exibido/editável na Central (`PayrollHeader`) como “Data de pagamento”.

## Refinamento de segurança documental (ajuste pós-review)
- **Não preencher folhas antigas em massa:** removido o `UPDATE` de backfill automático da migration para evitar gravar data oficial sem confirmação do RH.
- **Fonte única da data:** a data do recibo pertence ao lote (`PayrollBatch.paymentDate` / `payroll_batches.payment_date`), não ao lançamento individual.
- **`PayrollEntry` sem `paymentDate`:** o campo foi removido do tipo para evitar dupla fonte de verdade.
- **Sugestão automática preservada:** folhas novas e duplicadas continuam recebendo sugestão do dia 5 do mês seguinte.
- **Folhas antigas sem data:** campo pode permanecer vazio até ação explícita do RH na Central.

## Cálculo da sugestão automática
- Regra: dia 5 do mês seguinte da competência.
- Implementada em `getSuggestedPaymentDate(month, year)`.
- Aplicada na criação de folha e na duplicação.

## Estratégia de fallback
- Cidade/UF ausentes: `____ - ____`.
- Data ausente/inválida: `____ de ______________ de ______`.
- Recibo não inventa dados e não usa data atual.

## Arquivos alterados
- `src/components/payroll/Receipt.tsx`
- `src/components/payroll/ReceiptPrintView.tsx`
- `src/components/payroll/PayrollHeader.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Companies.tsx`
- `src/types/payroll.ts`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260523170000_payment_date_and_company_city_state.sql`

## Testes executados
- `npm run test -- src/lib/receiptData.test.ts src/components/payroll/Receipt.test.tsx`
- `npm run build`

## Confirmação de não regressão de cálculo
- Não houve mudança em fórmulas de cálculo de folha.
- Não houve mudança em rubricas canônicas.
- Não houve mudança na lógica de Compra de Férias/dias (apenas mantida no recibo).
- Não houve mudança no relatório por empresa.
