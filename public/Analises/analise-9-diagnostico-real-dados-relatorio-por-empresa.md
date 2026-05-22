# Análise 9 — Diagnóstico real dos dados no relatório por empresa

Data: 2026-05-22

## Escopo investigado

Arquivos revisados:
- `src/pages/ReportsCompany.tsx`
- `src/lib/reportByCompanyData.ts`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Index.tsx` (Central de Folha)
- `src/types/payroll.ts`

## Evidência de fluxo (sem suposição)

1. A Central de Folha renderiza a tabela com `payrollEntries` vindos do contexto e aplica apenas uma prévia visual local (`livePreviewEntry`) para o item em edição, sem inserir linhas fantasmas fora do array persistido/carregado. Ou seja, a linha visível normalmente parte de `payrollEntries` carregado do backend (com possível sobrescrita temporária em memória para o mesmo `id`).
2. Novo lançamento é persistido imediatamente ao clicar em "Novo lançamento" > confirmar funcionário, via `addPayrollEntry`, com `insert` em `payroll_entries`.
3. Mudar status para `finalizado` atualiza apenas `payroll_batches.status` (`updateCurrentBatchStatus`), sem gravar/regravar lançamentos.
4. O relatório usa `allPayrollEntries` (não `payrollEntries`) e filtra no builder por: empresa + mês + ano + (quando há batch ativo selecionado) compatibilidade de `payroll_batch_id` com o batch escolhido.

## Logs temporários adicionados (DEV only)

Foram adicionados logs protegidos por `import.meta.env.DEV` em `ReportsCompany.tsx` para capturar:
- `selectedCompanyId`, `selectedBatchId`, `selectedMonth/year`
- contagens de `payrollEntries`, `allPayrollEntries`, `allPayrollBatches`
- `dataset.rows.length`
- amostra segura de entradas (`id`, `companyId`, `employeeId`, `month`, `year`, `payrollBatchId`, `netSalary`, `inssAmount`)

Esses logs não afetam produção.

## Diagnóstico objetivo solicitado

### 1) A Central mostra a linha a partir de `payrollEntries` persistido ou estado em memória?
- Mostra a partir de `payrollEntries` do contexto (carregado/persistido) com possibilidade de prévia local para o mesmo item durante edição (`livePreviewEntry`). Não existe cálculo paralelo no relatório.

### 2) Novo lançamento salva imediatamente em `payroll_entries`?
- Sim. `addPayrollEntry` faz `insert` direto em `payroll_entries`.

### 3) Marcar `finalizado` salva lançamentos ou só status do batch?
- Só status do batch (`payroll_batches.status`). Não salva nem recalcula lançamentos.

### 4) Quantos itens em `payrollEntries` no relatório?
- Agora é exibido no log DEV (`payrollEntriesCount`). Valor depende do ambiente real em execução.

### 5) Quantos itens em `allPayrollEntries`?
- Agora é exibido no log DEV (`allPayrollEntriesCount`).

### 6) Quantas entradas entram no builder antes do filtro?
- `allEntries.length` (equivalente prático a `allPayrollEntriesCount` no ponto de chamada).

### 7) Quantas linhas o builder retorna após filtro?
- `datasetRows` no log DEV.

### 8) Qual `selectedCompany.id`?
- `selectedCompanyId` no log DEV.

### 9) Qual `selectedMonth`?
- `selectedMonth` + `selectedYear` no log DEV.

### 10) Qual `selectedBatch.id`?
- `selectedBatchId` no log DEV.

### 11) Existe entrada para empresa/mês/ano em `payroll_entries`?
- Não foi possível confirmar diretamente por SQL neste ambiente (sem conexão/credencial explícita do banco nesta sessão).

### 12) Essa entrada tem `payroll_batch_id`?
- Não foi possível confirmar diretamente por SQL nesta sessão.

### 13) O batch da competência está `is_archived = false`?
- Não foi possível confirmar diretamente por SQL nesta sessão.

### 14) Onde o dado desaparece?
- Pelo código, os pontos críticos são:
  - carga de `allPayrollEntries` no contexto (consulta/permissão/RLS), e
  - filtro do builder quando existe `selectedBatch` e `payrollBatchId` divergente.

## Causa raiz real (com evidência disponível nesta sessão)

Com base no fluxo implementado, o desaparecimento tende a ocorrer em um destes pontos verificáveis pelos logs/SQL:

- **Persistência ausente**: Central pode exibir prévia do item em edição, mas sem `insert/update` concluído no banco (menos provável para linha estável já listada).
- **Carga incompleta no contexto**: `allPayrollEntries` não veio (erro de query/permissão/RLS), enquanto a Central usa subconjunto já mantido em estado.
- **Divergência de vínculo de batch**: entrada existe para empresa/mês/ano, mas `payroll_batch_id` não bate com `selectedBatch.id`; builder elimina a linha por regra.

## Correção aplicada

- Nenhuma correção de regra de negócio foi aplicada sem evidência runtime/SQL.
- Apenas instrumentação diagnóstica temporária em DEV (`ReportsCompany.tsx`) para comprovar quantitativamente onde o dado some.

## Se não foi possível corrigir agora, pergunta objetiva ao usuário

Por favor, execute a tela `/relatorios/por-empresa` em ambiente DEV e envie:
1. o `console.table` de resumo (contagens/seleções),
2. o `console.table` de amostra das entries,
3. e o resultado das 4 queries SQL sugeridas para abril/2026.

Com isso, fecho a causa em um único ponto (persistência, contexto ou filtro) e aplico a correção mínima com segurança.

## Confirmações críticas

- Não houve recálculo de folha no relatório.
- Não foi alterada lógica de rubricas/recibos.
- Não houve flexibilização para incluir folha arquivada.

## Testes executados

- `npm run build`
- `npm run lint`
- `npm run typecheck`
