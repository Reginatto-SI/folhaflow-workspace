# Correção do Recibo — Alinhar "Salário Bruto" à Central

## Diagnóstico

Validando o caso da Ana Alves Pereira (ABRIL-26) contra a fórmula visível do recibo legado:

```text
Salário Bruto + Diárias 300,00 + HE 18,38 − INSS 282,01 − Faltas 39,80 = Líquido 2.996,57
⇒ Salário Bruto = 3.000,00  → corresponde ao Salário G
```

Hoje, em `src/lib/receiptData.ts`, a função `getLegacyGrossSalaryValue` tem esta ordem de prioridade:

1. Rubrica explicitamente chamada "salário bruto"  
2. **Salário Fiscal** ← está caindo aqui (2.996,57) — origem do bug  
3. `salario_ctps`  
4. `entry.baseSalary`

Salário G nem entra na lista. Resultado: o recibo mostra Bruto = 2.996,57 (fiscal), e a soma das demais linhas estoura o líquido. O drawer/Central estão corretos porque consomem o motor único (`calculatePayrollFromEntry`), sem essa heurística — então o bug é exclusivamente da camada de exibição do recibo.

Os demais valores do recibo (Diárias, HE, INSS, Faltas, Líquido a receber) já vêm corretos da mesma `calculatePayrollFromEntry` usada pela Central, então não há cálculo paralelo a remover — apenas reordenar a prioridade da linha "Salário Bruto".

## Mudança

Arquivo único: `src/lib/receiptData.ts`

Em `getLegacyGrossSalaryValue`, ajustar a prioridade para refletir a base operacional do legado:

```text
1. Rubrica explicitamente "salário bruto" (mantém)
2. classification === 'salario_g'        ← passa a ter prioridade sobre fiscal
3. classification === 'salario_ctps'
4. Salário Fiscal                          ← rebaixado (é base contábil, não operacional)
5. entry.baseSalary                        (mantém fallback final)
```

Justificativa: Salário G é a base operacional usada na Central para chegar ao Salário Real e ao Líquido. Salário Fiscal é base contábil/INSS e não deve aparecer como "Salário Bruto" no recibo — a divergência observada confirma isso.

## Não-mudanças (escopo)

- Não criar motor/fórmula nova no recibo.  
- Não alterar `calculatePayrollFromEntry`, drawer, tabela da Central, totais, relatórios ou layout do recibo.  
- Geração em lote (`ReceiptPrintView`) já reusa o mesmo componente `Receipt` → fix individual cobre lote automaticamente, sem tocar no arquivo.  
- Líquido continua vindo da canônica `salario_liquido` quando executável (lógica atual mantida).  
- Sem migration de dados; sem refresh forçado; valores em tela são respeitados via `livePreviewEntry`.

## Validação

1. Atualizar/rodar `src/components/payroll/Receipt.test.tsx` e `src/lib/receiptData.test.ts` (caso Ana: Bruto 3.000,00 / Líquido 2.996,57).  
2. Conferência manual: Ana ABRIL-26 → recibo individual e em lote precisam mostrar Líquido = 2.996,57 e Bruto = 3.000,00, batendo com o drawer.

## Critérios de aceite

- Recibo individual e em lote idênticos ao drawer/Central.  
- Nenhum cálculo novo dentro do recibo.  
- Não exige re-salvar lançamentos para refletir valores em tela.  
- Layout, rodapé e demais telas inalterados.
