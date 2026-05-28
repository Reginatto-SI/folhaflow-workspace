# Análise 1 — divergência no líquido do recibo

## 1. Diagnóstico completo

### Sintoma observado

Para o funcionário **Vitor da Cruz Gusmão**, empresa **IMOBILIARIA**, competência **abril/2026**, a Central de Folha e o recibo exibem:

- **Salário Fiscal / Salário Bruto no recibo:** R$ 1.762,20;
- **Horas Extras:** R$ 66,84;
- **INSS:** R$ 199,69;
- **Vales/Descontos:** R$ 527,22;
- **Faltas/Descontos:** R$ 77,73;
- **Salário Líquido / Valor recebido / Líquido a receber:** R$ 1.762,20.

A leitura aritmética das linhas operacionais visíveis no recibo resultaria em:

```text
1.762,20 + 66,84 - 199,69 - 527,22 - 77,73 = 1.024,40
```

Portanto, o recibo está internamente contraintuitivo: ele lista proventos/descontos, mas a linha final não corresponde à soma visual dessas linhas.

### Regra de projeto aplicável

Os PRDs consultados estabelecem que:

- o cálculo operacional da folha deve acontecer no frontend;
- o recibo deve apenas exibir dados já calculados;
- os valores do recibo devem bater com a Central de Folha;
- `salario_real`, `g2_complemento` e `salario_liquido` são rubricas canônicas e devem ser consistentes entre Central, Recibos e Relatórios;
- não deve existir lógica paralela para esses totais.

Arquivos consultados obrigatoriamente:

- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`;
- `public/PRD/PRD-03 — Central de Folha.txt`;
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`;
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`.

### Causa técnica encontrada

A divergência **não nasce no componente visual do PDF**. O componente do recibo renderiza o valor consolidado recebido de `buildReceiptData`.

O fluxo atual é:

1. O drawer da Central executa `calculatePayroll({ rubrics, manualValues })` para gerar a prévia única da folha.
2. O mesmo drawer persiste `netSalary` usando `spreadsheetPreview.salarioLiquido` quando a rubrica canônica `salario_liquido` está resolvida.
3. O recibo monta seus dados com `buildReceiptData(entry, rubrics)`.
4. `buildReceiptData` usa `entry.netSalary`, quando presente, como fonte prioritária do líquido exibido.
5. O componente `Receipt.tsx` usa `data.netSalary` tanto para **VALOR RECEBIDO** quanto para **Líquido a receber**.

Assim, para o cenário observado, o recibo está refletindo exatamente o líquido que a Central já considera oficial: **R$ 1.762,20**.

O ponto de atenção está antes do recibo: a rubrica canônica `salario_liquido`, ou o valor persistido em `net_salary` derivado dela, está com o mesmo valor do `salario_fiscal` no cenário observado. Isso indica que a fórmula/cadastro da rubrica canônica provavelmente está configurada para resultar em R$ 1.762,20, ou que há dado persistido legado/stale com esse valor.

## 2. Fórmula atualmente usada para `salario_liquido`

No código frontend, `salario_liquido` **não possui fórmula hardcoded por nome ou por classificação**. A regra atual é declarativa:

```text
salario_liquido = valuesByRubricId[id_da_rubrica_canônica_salario_liquido]
```

Esse valor é produzido por `computeSpreadsheetEntry` conforme o cadastro da própria rubrica:

- se a rubrica calculada for `valor_fixo`, usa `fixedValue`;
- se for `percentual`, aplica `percentageValue` sobre `percentageBaseRubricId`;
- se for `formula`, soma/subtrai os `formulaItems` na ordem cadastrada.

Para fórmulas, a operação efetiva é:

```text
resultado = 0
para cada item de formulaItems ordenado por order:
  se operation = subtract:
    resultado = resultado - valor_da_rubrica_fonte
  senão:
    resultado = resultado + valor_da_rubrica_fonte
```

Em seguida, `calculatePayroll` resolve os IDs canônicos e define:

```text
salarioLiquido = computed.valuesByRubricId[salarioLiquidoId] || 0
```

### Fórmula efetiva do caso de Vitor

Com os dados locais do repositório, não é possível consultar com segurança os `formulaItems` reais do ambiente Supabase para a rubrica `salario_liquido` da empresa/competência informada. A tentativa de consulta REST ao Supabase a partir deste ambiente falhou com:

```text
curl: (56) CONNECT tunnel failed, response 403
```

Portanto, a fórmula exata cadastrada no banco para esse caso **não foi comprovada** nesta análise.

O que foi comprovado pelo código e pelo print é:

- a Central mostra `salario_liquido = R$ 1.762,20`;
- o recibo usa esse mesmo valor consolidado como líquido;
- a soma visual das linhas operacionais do recibo daria R$ 1.024,40;
- logo, a inconsistência está entre a **configuração/valor canônico de `salario_liquido`** e a composição operacional exibida, não em uma soma feita pelo recibo.

## 3. Fonte exata usada pelo recibo para “Valor recebido” e “Líquido a receber”

### “Valor recebido”

`Receipt.tsx` chama:

```tsx
const data = buildReceiptData(entry, rubrics);
```

Depois renderiza:

```tsx
VALOR RECEBIDO: {fmt(data.netSalary)}
```

Fonte exata: `data.netSalary`.

### “Líquido a receber”

`buildReceiptData` adiciona a linha final:

```ts
lines.push({ label: "Líquido a receber", prefix: "(=)", value: netSalary, highlight: true });
```

Fonte exata: a mesma variável `netSalary`.

### Como `netSalary` é escolhido em `buildReceiptData`

A prioridade atual é:

```text
1. entry.netSalary, se existir como number;
2. result.salarioLiquido, se a canônica salario_liquido estiver resolvida;
3. result.netSalary, fallback operacional earningsTotal - deductionsTotal.
```

Ou seja: para lançamentos salvos, o recibo prioriza o campo persistido `net_salary` da folha.

### Como `entry.netSalary` é produzido no drawer

Ao montar o draft salvo na Central, o drawer define:

```text
netSalary = spreadsheetPreview.salarioLiquido
```

quando existe uma rubrica canônica `salario_liquido` resolvida. Se não existir, cai para `spreadsheetPreview.netSalary`.

## 4. Evidência dos arquivos/funções envolvidos

### PRDs

- `PRD-01` define cálculo simples e imediato no frontend e backend apenas como persistência.
- `PRD-03` define a Central como tela principal de edição, com cálculo automático ao digitar.
- `PRD-07` define que o recibo apenas exibe dados, não recalcula, e deve bater com a Central.
- `PRD-12` define as rubricas canônicas `salario_real`, `g2_complemento` e `salario_liquido` como valores do cálculo frontend, consistentes entre Central, Recibos e Relatórios.

### Cálculo da folha

Arquivo: `src/lib/payrollSpreadsheet.ts`

Funções envolvidas:

- `computeSpreadsheetEntry`:
  - lê rubricas ativas;
  - atribui valores manuais às rubricas não calculadas;
  - calcula rubricas derivadas por `valor_fixo`, `percentual` ou `formula`;
  - calcula totais operacionais de proventos/descontos apenas com rubricas-base.

- `resolveFormulaRubric`:
  - executa os `formulaItems` com operações `add`/`subtract`.

- `resolveCanonicalDerivedRubricIds`:
  - resolve os IDs canônicos de `salario_real`, `g2_complemento` e `salario_liquido`.

- `calculatePayroll`:
  - expõe `salarioReal`, `g2Complemento` e `salarioLiquido` a partir dos IDs canônicos resolvidos.

### Mapeamento das rubricas

Arquivo: `src/lib/payrollSpreadsheet.ts`

Pontos relevantes:

- resolução oficial por `code` canônico;
- fallbacks explícitos e transitórios por code/nome legado;
- sem heurística livre por nome para calcular valor.

### Montagem dos dados do drawer da Central

Arquivo: `src/components/payroll/EmployeeDrawer.tsx`

Pontos relevantes:

- a prévia é calculada por `calculatePayroll`;
- o card “Resultados” renderiza `spreadsheetPreview.valuesByRubricId[rubric.id]`;
- o draft salvo define `netSalary` como `spreadsheetPreview.salarioLiquido` quando a rubrica canônica existe.

### Geração do recibo/PDF

Arquivos:

- `src/lib/receiptData.ts`;
- `src/components/payroll/Receipt.tsx`.

Pontos relevantes:

- `buildReceiptData` monta as linhas operacionais do recibo legado;
- a linha “Salário Bruto” do recibo prioriza salário bruto explícito, depois salário fiscal, depois CTPS, depois `baseSalary`;
- as demais linhas somam rubricas por classificações (`horas_extras`, `inss`, `vales`, `faltas`, etc.);
- o líquido exibido **não é a soma visual dessas linhas**; ele vem do `netSalary` oficial;
- `Receipt.tsx` usa `data.netSalary` em “VALOR RECEBIDO” e também na linha final “Líquido a receber”.

### Backend/legado relevante

Arquivo: `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`

Existe uma função backend legada `recalculate_payroll_batch` que também materializa fórmula e `net_salary`. Comentários atuais do `PayrollContext.tsx` indicam que a Central não chama mais esse recálculo operacional e que os totais gravados vêm do cálculo frontend do drawer.

Esse backend legado é um risco histórico de divergência se algum fluxo externo ainda o acionar, mas a evidência do fluxo atual da Central aponta para frontend como fonte operacional.

## 5. Conclusão: erro no cálculo, mapeamento ou apenas no recibo?

### Não é apenas erro visual do recibo

O recibo está usando o mesmo líquido oficial da folha (`entry.netSalary` / `salario_liquido`) para:

- “VALOR RECEBIDO”;
- “Líquido a receber”.

Portanto, ele não está inventando um número diferente da Central.

### Não há evidência de recálculo indevido específico do recibo para o líquido

Embora `buildReceiptData` chame `calculatePayrollFromEntry` para montar valores e fallbacks das linhas, o líquido de lançamentos salvos prioriza `entry.netSalary`. Assim, o recibo não está recalculando o líquido final a partir das linhas visíveis.

### O problema provável está na origem canônica de `salario_liquido` ou em dado persistido

A inconsistência comprovada é:

```text
salario_liquido oficial = 1.762,20
soma visual das verbas do recibo = 1.024,40
```

Como o código não hardcoda uma fórmula por nome para `salario_liquido`, existem duas hipóteses seguras:

1. **Configuração da rubrica `salario_liquido` no cadastro/fórmula está incompleta ou incorreta**, possivelmente apontando apenas para `salario_fiscal` ou para uma composição que resulta em `1.762,20`.
2. **Valor persistido em `payroll_entries.net_salary` está legado/stale**, preservando `1.762,20` mesmo com verbas manuais que visualmente indicariam outro resultado.

Sem acesso aos `formulaItems` reais do banco e sem confirmação da regra de negócio oficial para o líquido, não é seguro afirmar que o valor correto deveria ser R$ 1.024,40.

## 6. Correção mínima proposta

### Correção aplicada nesta tarefa

Nenhuma alteração de lógica foi aplicada, porque a causa de negócio não foi confirmada com segurança.

Foi criado este Markdown de diagnóstico obrigatório para registrar o fluxo, as fontes e a dúvida de regra/configuração.

### Correção mínima recomendada, se a regra for confirmada

Se a regra oficial for:

```text
salario_liquido = salario_fiscal + horas_extras - inss - vales - faltas
```

ou alguma variação equivalente, a correção mínima deve ser feita **no cadastro da fórmula da rubrica canônica `salario_liquido`**, ajustando seus `formulaItems` para apontar para as rubricas corretas e operações corretas.

Essa correção deve ocorrer no cadastro/dados da rubrica, não no recibo, porque:

- o recibo não deve recalcular;
- não deve ser criada lógica paralela;
- a Central, Recibos e Relatórios devem consumir a mesma canônica;
- o código atual já executa fórmula declarativa por rubricas.

### O que não deve ser feito

- Não alterar o recibo para somar visualmente as linhas.
- Não criar heurística por nome de rubrica.
- Não hardcodar `salario_fiscal + horas_extras - descontos` no componente do recibo.
- Não alterar layout do PDF.
- Não criar nova lógica paralela em relatórios ou recibos.

### Dúvida bloqueadora de negócio

Antes de alterar lógica/dados, é necessário confirmar:

> Para a empresa IMOBILIARIA, competência abril/2026, o líquido oficial do recibo deve ser a rubrica canônica `salario_liquido` calculada por fórmula operacional ou deve permanecer igual ao `salario_fiscal` em algum cenário legado?

Enquanto essa dúvida não for respondida, a alteração segura é apenas registrar o diagnóstico e orientar a correção no cadastro da fórmula.

## 7. Checklist de testes manuais

### Validação da fórmula canônica

- [ ] Abrir o cadastro da rubrica calculada `salario_liquido`.
- [ ] Confirmar se o `code` é exatamente `salario_liquido`.
- [ ] Confirmar se há apenas uma rubrica ativa calculada resolvida como `salario_liquido`.
- [ ] Conferir cada `formulaItem` da rubrica:
  - [ ] rubrica fonte;
  - [ ] operação `add` ou `subtract`;
  - [ ] ordem.
- [ ] Verificar se a fórmula cadastrada explica o resultado R$ 1.762,20.
- [ ] Confirmar com negócio se a fórmula desejada deveria gerar R$ 1.024,40 ou outro valor.

### Validação na Central de Folha

- [ ] Abrir a Central de Folha.
- [ ] Selecionar empresa IMOBILIARIA.
- [ ] Selecionar competência abril/2026.
- [ ] Abrir Vitor da Cruz Gusmão.
- [ ] Conferir Salário Fiscal, Horas Extras, INSS, Vales/Descontos e Faltas/Descontos.
- [ ] Alterar temporariamente uma verba em ambiente de homologação.
- [ ] Verificar se `Salário Líquido` atualiza imediatamente sem salvar.
- [ ] Salvar e recarregar a tela.
- [ ] Confirmar que `Salário Líquido` permanece igual ao calculado antes de salvar.

### Validação do recibo

- [ ] Gerar recibo individual pelo drawer.
- [ ] Confirmar que “VALOR RECEBIDO” é igual ao `Salário Líquido` exibido no drawer.
- [ ] Confirmar que “Líquido a receber” é igual ao `Salário Líquido` exibido no drawer.
- [ ] Confirmar que o recibo não mostra rubricas técnicas `salario_real`, `g2_complemento` e `salario_liquido` como linhas operacionais separadas.
- [ ] Gerar recibo em lote pela Central.
- [ ] Confirmar paridade entre recibo individual e recibo em lote.

### Validação de relatórios

- [ ] Gerar relatório por empresa para IMOBILIARIA em abril/2026.
- [ ] Confirmar que a coluna/total de `salario_liquido` bate com a Central.
- [ ] Gerar resumo gerencial, se aplicável.
- [ ] Confirmar que o total gerencial de salário líquido bate com a soma das canônicas da Central.

## 8. Verificações executadas nesta análise

Comandos executados localmente:

```bash
sed -n '1,220p' "public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt"
sed -n '1,220p' "public/PRD/PRD-03 — Central de Folha.txt"
sed -n '1,220p' "public/PRD/PRD-07 — Recibos de Pagamento.txt"
sed -n '1,220p' "public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt"
rg -n "salario_liquido|salario_fiscal|Líquido a receber|Valor recebido|Gerar recibo|recibo|receipt|pdf" public src --glob '!node_modules'
nl -ba src/lib/payrollSpreadsheet.ts | sed -n '1,460p'
nl -ba src/lib/receiptData.ts | sed -n '1,340p'
nl -ba src/components/payroll/EmployeeDrawer.tsx | sed -n '260,410p'
nl -ba src/components/payroll/EmployeeDrawer.tsx | sed -n '560,600p'
nl -ba src/components/payroll/Receipt.tsx | sed -n '1,260p'
rg -n "recalculate_payroll_batch|net_salary|salario_liquido|salario_fiscal|salario_real|g2_complemento" supabase/migrations src/contexts/PayrollContext.tsx
```

Tentativa de consulta ao Supabase:

```bash
curl "$VITE_SUPABASE_URL/rest/v1/rubricas?..."
```

Resultado:

```text
curl: (56) CONNECT tunnel failed, response 403
```
