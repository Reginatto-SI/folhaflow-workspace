# Auditoria técnica — `/funcionarios` e Central de Folha

Data: 2026-04-13

## Escopo auditado
- `src/pages/Employees.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Index.tsx`
- `src/components/payroll/PayrollHeader.tsx`
- `src/data/mock.ts`
- migrações Supabase de empresas, funcionários, setores e funções

## Achados principais
1. **Setor/Função no formulário de funcionário dependem estritamente de `form.companyId`**; se a empresa registrada não estiver selecionada, os combobox ficam desabilitados e sem itens.
2. **Não há carregamento de erro explícito para `departments`/`job_roles`** no `loadData`; falha de query fica silenciosa e também resulta em dropdown vazio.
3. **A Central de Folha não consulta entidade de lançamentos**: ela gera linhas em memória a partir de `employees` ativos (`generatePayrollEntries`).
4. **Botão “Novo lançamento” está como placeholder** (sem fluxo real de inclusão manual).

## Evidências técnicas
### 1) Dropdowns Setor/Função
- Fonte de dados do formulário:
  - `availableDepartments = allDepartments.filter((department) => department.companyId === form.companyId)`
  - `availableJobRoles = allJobRoles.filter((jobRole) => jobRole.companyId === form.companyId)`
- No modo novo, `form.companyId` nasce de `selectedCompany?.id`.
- No modo edição, `form.companyId` vem do registro do funcionário.
- Combobox é desabilitado quando `!form.companyId`.

### 2) Carregamento de catálogo
- `loadData` busca `companies`, `employees`, `departments`, `job_roles` em paralelo.
- Se `departmentsRes.error` ou `rolesRes.error`, o código apenas não popula estado (sem toast/log).
- Resultado prático: dropdown vazio sem erro visível para usuário.

### 3) Fonte real da Central de Folha
- `payrollEntries` é `useMemo` no contexto.
- Se não houver cache para empresa+competência, chama:
  - `generatePayrollEntries(allEmployees, selectedCompany.id, selectedMonth.month, selectedMonth.year)`
- `generatePayrollEntries` filtra `employees` ativos por `companyId` e cria um `PayrollEntry` para **cada funcionário ativo**.

### 4) Fluxo manual de lançamento inexistente
- O botão `Novo lançamento` recebe `onNewEntry`, mas na página principal está `onNewEntry={() => {/* placeholder */}}`.
- Não existe tabela/CRUD de lançamentos de folha nas migrações auditadas.

## Diagnóstico consolidado
- Problema de dropdown: **bug de fluxo + observabilidade insuficiente** (dependência de empresa registrada e ausência de tratamento de erro no carregamento dos catálogos).
- Problema da Central: **acoplamento estrutural/modelagem** (folha derivada diretamente de `employees`, sem entidade separada de lançamentos por competência).
