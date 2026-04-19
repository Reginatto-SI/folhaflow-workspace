### 1. Resumo executivo
A Central de Folha foi simplificada para operar como planilha controlada: a edição permanece manual nos campos operacionais, os campos derivados agora são recalculados imediatamente no frontend e exibidos como readonly, e o save ficou focado em persistência.

### 2. Complexidades removidas
- Removido recálculo backend automático após cada save no fluxo da tela principal.
- Removido recálculo backend automático após criação de lançamento.
- Removida divergência entre “prévia local” e “total consolidado backend” no drawer.
- Reduzida duplicidade de lógica de soma (table, totais e drawer agora usam o mesmo cálculo centralizado).

### 3. Fluxo antigo vs fluxo novo
- **Antes**: usuário editava no drawer, salvava, e a UI dependia de nova chamada de recálculo backend para feedback final na tabela/totais.
- **Agora**: usuário edita, a tela recalcula instantaneamente localmente (incluindo derivados), salva apenas persistência e mantém resposta imediata sem ida-e-volta obrigatória.

### 4. Onde a lógica de cálculo ficou centralizada
A lógica ficou centralizada em `src/lib/payrollSpreadsheet.ts` via:
- `computeSpreadsheetEntry`: resolve valores manuais + derivados + totais da linha.
- `getEntryManualValues`: normaliza leitura dos valores manuais (incluindo compatibilidade legada por chave).

### 5. Arquivos alterados
- `src/lib/payrollSpreadsheet.ts`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/components/payroll/PayrollTable.tsx`
- `src/components/payroll/TotalsBar.tsx`
- `src/pages/Index.tsx`
- `src/components/payroll/EmployeeDrawer.test.tsx`

### 6. O que foi preservado
- Estrutura de dados dos lançamentos (`earnings`, `deductions`, `notes`, `baseSalary`).
- Persistência atual via contexto/Supabase.
- Layout geral da Central e padrão visual já existente.
- Componente drawer e fluxo de edição por funcionário.

### 7. O que ficou pendente para uma próxima etapa
- Evoluir parser/validador de fórmulas para cenários mais complexos (além de soma/subtração por itens).
- Definir regra explícita para rubricas excepcionais com natureza/metodologia inconsistente em dados legados.
- Adicionar testes de integração entre tabela/totais/drawer com rubricas formula encadeadas.

### 8. Como validar manualmente
1. Acessar `/central-de-folha` e abrir um funcionário no drawer.
2. Alterar rubricas-base/proventos/descontos e confirmar atualização imediata da prévia.
3. Conferir seção “Campos derivados (readonly)” recalculando sem salvar.
4. Salvar e verificar tabela e barra de totais atualizadas sem dependência de recálculo manual.
5. Criar novo lançamento e validar que o fluxo conclui sem disparo automático de recálculo backend.
