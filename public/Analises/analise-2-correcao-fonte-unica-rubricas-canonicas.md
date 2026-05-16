# Análise 2 — Correção da fonte única de cálculo e rubricas canônicas

Data: 2026-05-16

## 1. Diagnóstico antes da alteração

### Chamadas de recálculo backend

- A RPC `recalculate_payroll_batch` era chamada no frontend em `src/contexts/PayrollContext.tsx` pela função `runPayrollBatchReprocess`.
- Essa função era acionada em dois pontos operacionais da Central:
  - após salvar um lançamento no drawer (`updatePayrollEntry`);
  - ao abrir/trocar para uma folha com `currentBatch`, via `useEffect`.
- As migrations antigas continuam contendo a função SQL `public.recalculate_payroll_batch`, especialmente `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`, mas a correção mínima não remove migrations históricas.

### Campos persistidos em `payroll_entries`

O frontend carrega e persiste a tabela `payroll_entries` com, entre outros campos:

- `base_salary`;
- `earnings`;
- `deductions`;
- `notes`;
- `earnings_total`;
- `deductions_total`;
- `inss_amount`;
- `net_salary`;
- `payroll_batch_id`, `company_id`, `employee_id`, `month`, `year`.

Antes da correção, `earnings_total`, `deductions_total`, `inss_amount` e `net_salary` podiam ser recalculados/materializados pela RPC backend após salvar/abrir a folha.

### Drawer e payload

- O drawer já salvava somente rubricas não calculadas (`nature !== calculada`) em `earnings`/`deductions`.
- Rubricas calculadas/canônicas apareciam como resultados readonly no drawer e não eram enviadas como input manual.
- A prévia do drawer já vinha do frontend por `calculatePayroll`.

### Rubricas canônicas

As canônicas eram resolvidas em `src/lib/payrollSpreadsheet.ts` por rubricas ativas e calculadas com `code`:

- `salario_real`;
- `g2_complemento`;
- `salario_liquido`.

Ainda existe fallback legado por nome, mantido somente por compatibilidade transitória. O alerta do drawer era disparado quando qualquer canônica não era resolvida estritamente por `code`.

### Risco de dupla contagem

Antes da correção, `earningsTotal` e `deductionsTotal` no frontend somavam todas as rubricas ativas por tipo, inclusive calculadas. Isso podia duplicar valores quando uma rubrica derivada de provento/desconto representava resultado de outra rubrica-base.

## 2. Arquivos alterados

- `src/contexts/PayrollContext.tsx`
- `src/lib/payrollSpreadsheet.ts`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/pages/Rubrics.tsx`
- `src/lib/payrollSpreadsheet.test.ts`
- `src/components/payroll/EmployeeDrawer.test.tsx`
- `src/test/payrollNoBackendRecalc.test.ts`
- `public/Analises/analise-2-correcao-fonte-unica-rubricas-canonicas.md`

## 3. Mudanças aplicadas

### Fonte única de cálculo

- Removida a chamada operacional da RPC `recalculate_payroll_batch` do frontend.
- Removido o reprocessamento automático ao abrir folha.
- Removido o reprocessamento automático após salvar no drawer.
- `updatePayrollEntry` agora apenas persiste os dados recebidos do frontend, incluindo totais calculados pelo drawer quando enviados.

### Persistência de totais calculados no frontend

- O drawer passa a enviar, junto com rubricas manuais e observação:
  - `earningsTotal`;
  - `deductionsTotal`;
  - `inssAmount`;
  - `netSalary`.
- Esses campos refletem a mesma prévia calculada pelo frontend, sem recálculo independente no backend.

### Regra única de totalização

- `computeSpreadsheetEntry` passou a somar totais operacionais somente com rubricas-base/manuais.
- Rubricas calculadas/canônicas continuam sendo resolvidas e exibidas como resultados, mas não entram novamente em `earningsTotal`/`deductionsTotal`.
- Isso evita dupla contagem e mantém o modelo de planilha simples.

### Proteção das rubricas canônicas

- A tela `/rubricas` agora identifica rubricas com `code` canônico como “Rubrica do sistema”.
- Rubricas canônicas abertas no modal aparecem como “Visualizar rubrica do sistema”.
- A interface comum bloqueia salvar alterações em rubricas canônicas.
- A interface comum bloqueia inativar rubricas canônicas.
- A proteção é feita no frontend, sem alterar RLS ou migrations nesta correção mínima.

### Alerta de inconsistência canônica

- A mensagem técnica genérica do drawer foi substituída por textos mais objetivos e menos assustadores:
  - usuário comum/configuração ausente: “Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.”;
  - conflito/ambiguidade: “Configuração canônica incompleta: verifique salario_real, g2_complemento e salario_liquido.”;
  - fallback legado: “Resultados do sistema usando configuração legada de rubricas. Consulte o responsável pelo sistema.”.
- O alerta continua aparecendo apenas quando há inconsistência no diagnóstico canônico.

## 4. O que foi deliberadamente não alterado

- Migrations antigas e a função SQL `recalculate_payroll_batch` não foram removidas para evitar alteração destrutiva/histórica.
- Não foi criada nova RPC.
- Não foi criada nova tabela/campo.
- Não foi criada nova tela.
- Não foi criado novo motor de cálculo.
- Não foram implementados Recibos ou Relatórios.
- Métodos existentes `valor_fixo` e `percentual` não foram removidos para evitar refatoração ampla; permanecem como pendência de simplificação futura se o produto exigir aderência estrita apenas a soma/subtração.
- A proteção backend/RLS específica para rubricas canônicas não foi adicionada nesta etapa; a proteção aplicada é frontend e está documentada como risco restante.

## 5. Riscos restantes

1. A função SQL `recalculate_payroll_batch` ainda existe no histórico de migrations e pode ser chamada por outro cliente/manual técnico se alguém usar a RPC diretamente.
2. A proteção das canônicas ainda é apenas de frontend; uma proteção definitiva deveria ser reforçada no banco em tarefa específica, sem quebrar RLS.
3. O fallback por nome legado ainda existe para compatibilidade; deve ser removido/migrado quando os cadastros estiverem saneados por `code` canônico.
4. Recibos e Relatórios ainda precisam ser implementados consumindo os mesmos valores persistidos/calculados pela Central, sem recalcular.
5. `valor_fixo` e `percentual` continuam suportados por compatibilidade, embora os PRDs simplificados priorizem soma/subtração.

## 6. Testes executados

- `npm test` — passou.
- `npm run build` — passou, com warnings de Browserslist desatualizado e chunk grande do Vite.
- `npm run lint` — falhou por problemas já existentes em arquivos não relacionados à correção (`no-empty-object-type`, `no-explicit-any`, `no-require-imports` e warnings de Fast Refresh).

## 7. Checklist final

- [x] Central não chama mais `recalculate_payroll_batch` como rotina operacional.
- [x] Backend do fluxo normal passa a persistir/carregar, sem recálculo operacional disparado pelo frontend.
- [x] Totais operacionais não somam rubricas calculadas/canônicas novamente.
- [x] Drawer continua editável para rubricas manuais.
- [x] Rubrica manual ativa nova aparece no drawer e salva por tipo.
- [x] Rubricas calculadas/canônicas continuam readonly no drawer.
- [x] Rubricas canônicas ficam identificadas como rubricas do sistema em `/rubricas`.
- [x] Interface comum bloqueia edição e inativação de canônicas.
- [x] Alerta canônico foi suavizado e continua condicionado a inconsistência real.
- [x] Teste garante que o frontend não chama mais a RPC de recálculo.

## 8. Recomendação para Recibos/Relatórios

Com esta correção, a Central fica mais alinhada ao modelo dos PRDs: o frontend calcula e o backend persiste. Ainda assim, antes de iniciar Recibos/Relatórios em produção, recomenda-se validar/sanear os cadastros das três rubricas canônicas e planejar proteção backend para evitar alteração direta por clientes externos à UI.

A partir do ponto de vista do fluxo frontend da Central, já é seguro iniciar a próxima etapa de Recibos/Relatórios **desde que** esses módulos apenas leiam os valores da folha e não chamem a RPC antiga de recálculo nem reimplementem fórmulas próprias.
