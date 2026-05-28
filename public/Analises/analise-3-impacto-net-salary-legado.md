# Análise 3 — impacto de `net_salary` legado após correção do `salario_liquido`

## 1. Diagnóstico

Após a correção da fórmula canônica `salario_liquido`, existe um cenário transitório importante:

```text
rubrica/fórmula corrigida no cadastro
payroll_entries.net_salary ainda salvo com valor legado
```

Exemplo observado:

```text
net_salary salvo legado: 1.762,20
salario_liquido recalculado pela fórmula corrigida: 1.024,40
```

A investigação confirmou que a **Central de Folha** já exibe valores recalculados em tempo real, mas o **recibo** priorizava `entry.netSalary` persistido. Isso podia manter o recibo divergente mesmo depois da migration da fórmula, até o usuário abrir e salvar novamente cada lançamento.

## 2. Onde cada tela busca o valor

### Drawer da Central de Folha

Arquivo: `src/components/payroll/EmployeeDrawer.tsx`

O drawer monta `spreadsheetPreview` com:

```text
calculatePayroll({ rubrics: activeRubricsOrdered, manualValues: rubricValues })
```

O card “Resultados” exibe cada rubrica derivada com:

```text
spreadsheetPreview.valuesByRubricId[rubric.id]
```

Conclusão: o card **Salário Líquido** do drawer usa a fórmula recalculada no frontend e não depende de `entry.netSalary` salvo para exibição.

### Tabela principal da Central

Arquivo: `src/components/payroll/PayrollTable.tsx`

A tabela calcula cada linha com:

```text
calculatePayrollFromEntry({ entry, rubrics })
```

E exibe:

```text
localComputed.salarioLiquido
```

Conclusão: a tabela principal da Central também usa cálculo atualizado da canônica e não exibe diretamente `payroll_entries.net_salary` persistido.

### Prévia viva da Central enquanto o drawer está aberto

Arquivo: `src/pages/Index.tsx`

A página substitui o lançamento carregado pela prévia viva do drawer (`livePreviewEntry`) enquanto a edição está aberta. Essa prévia é montada no drawer e já inclui `netSalary` recalculado antes de salvar.

Conclusão: durante edição, tabela e totalizadores refletem a prévia recalculada antes do `save`.

### Recibo individual / recibo em lote

Arquivos:

- `src/lib/receiptData.ts`
- `src/components/payroll/Receipt.tsx`

Antes deste refinamento, `buildReceiptData` escolhia o líquido assim:

```text
1. entry.netSalary, se existisse;
2. result.salarioLiquido, se a canônica existisse;
3. result.netSalary como fallback.
```

Isso significava que o recibo podia continuar exibindo `net_salary` legado mesmo quando a Central já mostrava a canônica recalculada.

## 3. Problema fica resolvido automaticamente ou exige ressalvar?

### Antes deste refinamento

- Drawer: resolvido automaticamente após a fórmula corrigida.
- Tabela principal: resolvido automaticamente após a fórmula corrigida.
- Relatórios que usam `calculatePayrollFromEntry`: resolvidos automaticamente.
- Recibos: **não resolvidos automaticamente**, porque priorizavam `entry.netSalary` salvo.
- Persistência: `payroll_entries.net_salary` continuava antigo até abrir e salvar novamente.

### Após este refinamento

Foi aplicada correção mínima em `src/lib/receiptData.ts`:

```text
se a canônica salario_liquido estiver resolvida e executável:
  usar result.salarioLiquido
senão:
  usar entry.netSalary como fallback
senão:
  usar result.netSalary
```

Assim, o recibo passa a refletir a mesma canônica recalculada que a Central já exibe, sem criar fórmula paralela, sem alterar layout e sem fazer migration massiva de dados.

### O que ainda exige ressalvar

O usuário **não precisa obrigatoriamente abrir e salvar cada lançamento para que o recibo gerado pelo app reflita a Central**, desde que a rubrica canônica `salario_liquido` esteja resolvida e sua fórmula esteja executável.

Porém, o usuário ainda precisa abrir/salvar se o objetivo for atualizar fisicamente a coluna persistida `payroll_entries.net_salary` no banco.

## 4. Risco para recibos já salvos

- Recibos/PDFs já exportados antes da correção não são alterados retroativamente.
- Recibos gerados novamente pelo app passam a usar a canônica recalculada quando disponível.
- Se a canônica estiver ausente, ambígua ou sem fórmula executável, o recibo mantém fallback para `entry.netSalary`, preservando comportamento seguro para cadastros incompletos.

## 5. Correção mínima aplicada

Arquivo alterado:

- `src/lib/receiptData.ts`

Alteração:

- `buildReceiptData` deixou de priorizar `entry.netSalary` quando existe uma canônica `salario_liquido` resolvida e executável.
- O recibo reutiliza `calculatePayrollFromEntry`, a mesma função única usada pela Central, e apenas troca a prioridade da fonte do líquido.
- `entry.netSalary` permanece fallback para cadastros sem canônica executável.

Teste adicionado:

- `src/lib/receiptData.test.ts`

Cenário coberto:

```text
entry.netSalary legado = 1.762,20
salario_liquido recalculado = 1.024,40
recibo deve exibir = 1.024,40
```

## 6. Recomendação final antes de merge

Recomendação: manter a correção mínima do recibo neste PR.

Motivos:

1. Evita que o usuário veja Central corrigida e recibo antigo após a migration.
2. Não cria cálculo paralelo no recibo; usa a mesma função canônica já usada pela Central.
3. Não altera layout visual.
4. Não faz migration massiva em dados financeiros existentes.
5. Mantém fallback para `entry.netSalary` quando a canônica não estiver executável.

Antes de uma migration futura para atualizar `payroll_entries.net_salary`, ainda será necessário listar registros afetados, cálculo aplicado e riscos. Para este PR, não é recomendada atualização massiva.

## 7. Checklist manual recomendado

1. [ ] Aplicar a migration da fórmula em homologação.
2. [ ] Abrir Central de Folha na empresa IMOBILIARIA / abril de 2026.
3. [ ] Confirmar que a tabela principal mostra o `Salário Líquido` recalculado.
4. [ ] Abrir Vitor da Cruz Gusmão no drawer.
5. [ ] Confirmar que o card “Salário Líquido” mostra o mesmo valor da tabela.
6. [ ] Sem salvar, gerar recibo individual.
7. [ ] Confirmar que “Valor Recebido” e “Líquido a receber” batem com a Central recalculada.
8. [ ] Salvar o lançamento.
9. [ ] Recarregar a tela.
10. [ ] Confirmar que Central e recibo continuam iguais.
11. [ ] Gerar recibo em lote e confirmar paridade com o recibo individual.
