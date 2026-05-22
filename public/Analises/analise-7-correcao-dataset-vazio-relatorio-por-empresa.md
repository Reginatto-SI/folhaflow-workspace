# Análise 7 — Correção de dataset vazio no Relatório por Empresa

## 1) Causa raiz
O builder do relatório (`buildReportByCompanyData`) aplicava filtro diferente da Central de Folha para entradas da competência ativa:
- quando existia `batch` selecionado, entradas sem `payrollBatchId` podiam ser descartadas em cenários de inconsistência de vínculo;
- e a regra não espelhava com precisão o comportamento operacional da Central (prioridade por `payrollBatchId` quando há batch ativo, com fallback legado controlado).

Resultado: para a mesma empresa/competência, a Central encontrava lançamento e o relatório retornava dataset vazio.

## 2) Diferença entre Central de Folha e Relatório
### Central (`PayrollContext.payrollEntries`)
- Se existe `currentBatch` ativo e não arquivado: filtra **somente por** `entry.payrollBatchId === currentBatch.id`.
- Se não existe `currentBatch`: fallback legado por `companyId + month + year`.
- Se a competência selecionada estiver arquivada: retorna vazio.

### Relatório (antes da correção)
- Validava empresa/competência e, para entradas com `payrollBatchId`, testava pertencimento a um conjunto de batches não arquivados da competência.
- Para entradas sem `payrollBatchId`, aceitava apenas quando havia `batch` selecionado não arquivado.
- A lógica era parecida, mas não espelhava a regra da Central com a mesma prioridade por batch selecionado + fallback explícito para entradas sem vínculo no cenário ativo.

## 3) Campo/filtro que causava dataset vazio
O ponto crítico estava no filtro de `buildReportByCompanyData` sobre `payrollBatchId`, com regra excessivamente restritiva/inconsistente para entradas legadas sem vínculo (`payrollBatchId` nulo) no contexto de competência ativa.

## 4) Correção aplicada
Arquivo alterado:
- `src/lib/reportByCompanyData.ts`

Ajuste mínimo:
- substituído o filtro por uma regra alinhada ao comportamento da Central:
  1. com `batch` ativo selecionado (não arquivado):
     - se entrada tiver `payrollBatchId`, precisa bater com `batch.id`;
     - se entrada não tiver `payrollBatchId`, entra por fallback legado da competência.
  2. sem `batch` ativo selecionado:
     - mantém fallback por `companyId + month + year`;
     - exclui entrada que esteja vinculada explicitamente a `batch` arquivado.

## 5) Filtro final de lançamentos
Filtro final passou a ser:
1. sempre exige `entry.companyId`, `entry.month`, `entry.year` iguais à seleção;
2. se há `batch` ativo selecionado:
   - `entry.payrollBatchId` presente -> deve ser igual ao batch selecionado;
   - `entry.payrollBatchId` ausente -> inclui por fallback legado;
3. se não há `batch` ativo:
   - inclui por competência;
   - mas exclui entrada com vínculo explícito a batch arquivado.

## 6) Confirmação de exclusão de folhas arquivadas
Mantida:
- no relatório, competências disponíveis já filtram `!isArchived`;
- no dataset, entradas ligadas a `batch` arquivado continuam excluídas.

## 7) Confirmação de que não houve recálculo
Confirmado: não foi adicionado nenhum uso de `calculatePayroll`, `calculatePayrollFromEntry` ou funções equivalentes. A mudança é apenas de seleção/leitura de entradas persistidas.

## 8) Confirmação sobre rubricas dinâmicas
Não houve alteração na montagem de rubricas dinâmicas, totais por rubrica ou leitura de payload por rubrica.

## 9) Testes executados
- `npm run build`
- `npm run lint`
- `npm run typecheck`

Validação por inspeção de regra:
- botões PDF/CSV continuam dependentes de `dataset.rows.length > 0`;
- com dataset preenchido pela regra corrigida, ambos permanecem habilitados automaticamente.

## 10) Riscos remanescentes
- Se existirem lançamentos legados sem `payrollBatchId` para mesma empresa/competência oriundos de períodos antigos, eles ainda entram no fallback (intencional para compatibilidade com a Central quando não há vínculo explícito).
- O cenário ideal de longo prazo continua sendo 100% das entradas com `payrollBatchId` consistente.
