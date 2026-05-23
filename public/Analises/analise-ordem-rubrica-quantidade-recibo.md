# Análise — ordem de rubrica individualizada por quantidade no recibo

## Onde o PDF do recibo é montado
- Função principal: `buildReceiptData` em `src/lib/receiptData.ts`.
- O componente de recibo (`src/components/payroll/Receipt.tsx`) renderiza a tabela `DISCRIMINAÇÃO DAS VERBAS` com base em `data.lines` retornado por `buildReceiptData`.

## Onde a rubrica com quantidade estava sendo inserida
- Após montar todas as linhas legadas (`LEGACY_RECEIPT_LINES`), o código fazia `lines.push(...)` para cada rubrica individualizada (`individualized.forEach`).
- Isso colocava essas linhas no final da lista visual do recibo.

## Causa da ordenação errada
- Mesmo havendo `sort` por `rubric.order` entre as individualizadas, a inserção acontecia **depois** de todas as linhas legadas fixas.
- Resultado: a rubrica com quantidade (ex.: ordem 9) ficava no fim da discriminação, em vez de entrar na posição correta entre ordem 8 e 10.

## Ajuste mínimo aplicado
- Mantive o comportamento legado de agregação das linhas fixas.
- Troquei a montagem final para um merge ordenado entre:
  1. linhas legadas com `fallbackOrder` fixo;
  2. linhas individualizadas com `sortOrder = rubric.order`.
- Depois, ambas são ordenadas por `sortOrder` (com desempate por índice para estabilidade).
- Com isso, rubricas individualizadas com quantidade complementar passam a respeitar a ordem cadastrada no recibo sem hardcode por nome.
- Também adicionei comentário de código no ponto da ordenação explicando essa regra.

## Como validar manualmente
1. Abrir Central de Folha e lançar rubrica manual com quantidade complementar (ex.: `Compra de Férias`, quantidade `10`, valor `600`).
2. Gerar o recibo do colaborador.
3. Confirmar na tabela `DISCRIMINAÇÃO DAS VERBAS`:
   - `(+) Premio/Desemp.`
   - `(+) Compra de Férias (10 dias)`
   - `(-) INSS`
   nesta sequência.
4. Confirmar que `Líquido a receber` não mudou.

## Confirmação de escopo preservado
- Não houve alteração em cálculo de folha.
- Não houve alteração no drawer da Central de Folha.
- Não houve alteração em cadastro de rubricas (`/rubricas`).
- Não houve alteração em persistência de lançamentos.
- Não houve alteração no relatório PDF por empresa (`src/pages/ReportsCompany.tsx`).
