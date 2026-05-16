# Análise 3 — Validação final de rubricas e fonte única da Central de Folha

Data: 2026-05-16

## 1. Diagnóstico final

A correção anterior deixou o fluxo principal da Central alinhado ao modelo dos PRDs: o usuário digita rubricas manuais no drawer, o frontend calcula a prévia imediatamente e o backend persiste/carrega os dados. Nesta validação final, foi encontrado um risco real restante: a RLS de leitura de `rubricas` e `rubrica_formula_items` dependia somente de `rubricas.manage`, enquanto a Central é operada pela permissão separada `folha.operar`.

Foi aplicada correção mínima de banco para permitir que usuários com `folha.operar` leiam apenas rubricas ativas e seus itens de fórmula necessários ao cálculo da Central. O gerenciamento de rubricas continua restrito a `rubricas.manage`.

## 2. Uso de `recalculate_payroll_batch`

### Resultado da busca

- A função SQL/RPC `recalculate_payroll_batch` ainda existe em migrations históricas e no tipo gerado do Supabase.
- Não há chamada operacional no frontend da Central.
- Não é chamada ao salvar no drawer.
- Não é chamada ao abrir folha.
- Não é chamada ao listar folha.
- O teste `src/test/payrollNoBackendRecalc.test.ts` cobre a ausência de chamada `rpc("recalculate_payroll_batch")` no `PayrollContext`.

### Decisão

A função permanece como legado histórico do banco, mas não é usada pela Central como rotina normal. Não removemos migrations antigas para evitar alteração destrutiva.

## 3. Fonte dos totais salvos

Ao salvar no drawer, os campos persistidos são montados a partir de `spreadsheetPreview`, a mesma prévia frontend exibida ao usuário:

- `earningsTotal` vem de `spreadsheetPreview.earningsTotal`;
- `deductionsTotal` vem de `spreadsheetPreview.deductionsTotal`;
- `inssAmount` vem de `spreadsheetPreview.inssAmount`;
- `netSalary` vem de `spreadsheetPreview.salarioLiquido` quando a canônica `salario_liquido` está resolvida, ou de `spreadsheetPreview.netSalary` como fallback.

As canônicas `salario_real`, `g2_complemento` e `salario_liquido` continuam derivadas por `calculatePayroll`/`computeSpreadsheetEntry` no frontend e são exibidas pela mesma prévia. Hoje somente o líquido também alimenta diretamente o campo agregado persistido `netSalary`; `salario_real` e `g2_complemento` não têm colunas próprias no modelo atual.

## 4. Situação das rubricas canônicas

Rubricas canônicas validadas:

- `salario_real`
- `g2_complemento`
- `salario_liquido`

Situação atual:

- Estão identificadas na listagem de `/rubricas` como “Rubrica do sistema”.
- Ao abrir o modal, aparecem como “Visualizar rubrica do sistema”.
- A interface comum bloqueia `Salvar` para essas rubricas.
- A interface comum bloqueia a ação de inativar essas rubricas.
- Campos críticos como código, tipo, natureza, status e método ficam protegidos no modal comum.
- A proteção de edição/inativação é frontend.
- A proteção backend específica contra alteração direta dessas três rubricas ainda não foi implementada; permanece como risco técnico controlado para uma próxima tarefa.

## 5. Permissão/RLS de leitura de rubricas

### Diagnóstico

A migration anterior de RLS permitia `select` em `rubricas` e `rubrica_formula_items` apenas para usuários com `rubricas.manage`. Porém, o papel `operacional` possui `folha.operar` e não possui `rubricas.manage`. Como o `PayrollContext` carrega rubricas para a Central independentemente da tela de cadastro, um operador de folha poderia ficar sem catálogo de rubricas para cálculo.

### Correção mínima aplicada

Criada a migration:

`supabase/migrations/20260516120000_allow_folha_operar_read_active_rubrics.sql`

Ela altera somente policies de leitura:

- `rubricas view`: permite `rubricas.manage` ou `folha.operar` com `is_active = true`;
- `rubrica items view`: permite `rubricas.manage` ou `folha.operar` quando o item pertence a rubrica ativa.

Não foram liberados insert/update/delete. O gerenciamento continua restrito pelas policies existentes de `rubricas.manage`.

## 6. Validação de rubrica manual nova

Existe teste cobrindo rubrica manual ativa nova no drawer:

- aparece no drawer via título `BONUS — Bônus manual`;
- aparece como input editável;
- salva no payload de `earnings` quando `type = provento`;
- não entra em `deductions` indevidamente;
- atualiza `earningsTotal` pela prévia frontend;
- usa o mesmo mecanismo de persistência por `payroll_entries`, ou seja, por funcionário/empresa/competência/folha.

Análise complementar:

- Se a rubrica manual for `desconto`, o drawer usa o mesmo agrupamento por `rubric.type` e grava em `deductions`.
- Ao recarregar, `getEntryManualValues` reidrata valores a partir de `entry.earnings`/`entry.deductions` por `rubric.id`, com compatibilidade legada por código/nome.
- Rubricas manuais novas não interferem diretamente na resolução canônica; elas só entram nos cálculos se forem referenciadas por fórmula.

## 7. Métodos `valor_fixo` e `percentual`

A tela `/rubricas` ainda exibe os métodos:

- `valor_fixo`;
- `percentual`.

Eles continuam suportados no cálculo por compatibilidade com o modelo já existente e dados legados. Como os PRDs atuais enfatizam fórmula simples por soma/subtração, esses métodos podem gerar dúvida operacional. Não foram ocultados nesta validação porque isso alteraria comportamento existente do cadastro e poderia afetar dados já configurados.

Recomendação futura: decidir em tarefa própria se esses métodos devem ser ocultados para novas rubricas ou formalizados em PRD específico.

## 8. Alerta canônico

Situação atual:

- O alerta é calculado por `diagnoseCanonicalDerivedRubrics` e `hasCanonicalRubricInconsistency`.
- Não aparece quando as três canônicas ativas/calculadas são resolvidas por `code` canônico.
- Aparece quando há ausência, ambiguidade ou fallback legado por nome.
- A mensagem para usuário comum foi suavizada: “Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.”
- A mensagem de ambiguidade ainda informa quais códigos técnicos precisam ser verificados, mas sem bloquear a operação.
- O alerta não bloqueia edição/salvamento quando o cálculo ainda pode ser feito.

## 9. Resultado dos testes

Comandos executados nesta validação:

- `npm test` — passou.
- `npm run build` — passou, com warnings não bloqueantes de Browserslist desatualizado e chunk grande do Vite.
- `npm run lint` — falhou por problemas já existentes/não relacionados descritos abaixo.

## 10. Explicação do lint

O `npm run lint` continua falhando, mas os erros reportados não foram introduzidos pela correção de rubricas/fonte única. Os principais pontos são:

- `src/components/ui/command.tsx`: `@typescript-eslint/no-empty-object-type`.
- `src/components/ui/textarea.tsx`: `@typescript-eslint/no-empty-object-type`.
- `src/contexts/PayrollContext.tsx`: `@typescript-eslint/no-explicit-any` em mapeamentos já existentes e warning de dependências do hook.
- `tailwind.config.ts`: `@typescript-eslint/no-require-imports`.
- Warnings de `react-refresh/only-export-components` em arquivos compartilhados já existentes.

Nenhum erro novo específico da validação final foi identificado.

## 11. Riscos restantes

1. A RPC SQL `recalculate_payroll_batch` ainda existe e pode ser chamada manualmente por cliente técnico se exposta; a Central frontend não chama mais.
2. A proteção das rubricas canônicas contra alteração direta ainda não existe no backend/RLS; a proteção atual contra edição/inativação comum é frontend.
3. `valor_fixo` e `percentual` permanecem visíveis e suportados por compatibilidade, apesar de não serem o foco dos PRDs simplificados.
4. Recibos e Relatórios ainda precisam ser implementados com a regra de não recalcular e de ler os mesmos valores da Central.
5. `salario_real` e `g2_complemento` não possuem colunas persistidas próprias; continuam derivados pela função frontend compartilhada.

## 12. Decisão final

**Pode avançar para Recibos/Relatórios**, com as seguintes condições explícitas:

1. Recibos e Relatórios devem apenas ler/exibir os valores da folha, sem chamar `recalculate_payroll_batch`.
2. Não devem implementar motor paralelo de fórmulas.
3. Devem consumir a mesma semântica de rubricas-base versus rubricas calculadas usada pela Central.
4. A proteção backend das três rubricas canônicas deve ser planejada como hardening posterior, mas não bloqueia o início de Recibos/Relatórios desde que o fluxo comum use a UI atual.
