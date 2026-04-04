# 1) O que foi implementado

## Persistência real (Fase 1)
- Criação de migration SQL para estruturar tabelas reais `companies` e `employees`.
- Inclusão de colunas cadastrais de funcionário para dados principais, funcionais e bancários.
- Inclusão de índices e `updated_at` automático por trigger.
- Ativação de RLS com políticas permissivas temporárias (coerente com estado atual sem auth/tenant no app).

## Integração front-end com banco
- O `PayrollContext` deixou de iniciar com `mockCompanies`/`mockEmployees`.
- Empresas e funcionários agora são carregados do Supabase (`select`), com CRUD real (`insert/update/delete`).
- Conversões de mapeamento entre modelo UI (camelCase) e banco (snake_case) foram centralizadas no contexto.

## Evolução do cadastro de funcionário
- Reaproveitada a tela `/funcionarios` existente, mantendo padrão de modal + listagem.
- Formulário foi ampliado com grupos:
  - Dados pessoais / vínculo
  - Dados funcionais
  - Dados bancários
  - Status e observações
- Campos adicionados no fluxo oficial:
  - `cpf`
  - `registration` (registro/matrícula)
  - `department` (setor)
  - `role` (função/cargo)
  - `bankName`, `bankBranch`, `bankAccount`
  - `notes`
  - flags `isMonthly`, `isOnLeave`, `isActive`
- `baseSalary` foi mantido para compatibilidade com a Central de Folha.

## Compatibilidade com o restante
- A Central de Folha continua em memória (não foi escopo desta fase), porém agora usa funcionários vindos da persistência real.
- Componentes da folha que liam `mockEmployees` foram adaptados para ler do contexto (`allEmployees`).

# 2) Arquivos alterados

- `supabase/migrations/20260404160000_create_companies_and_employees.sql`
- `src/integrations/supabase/types.ts`
- `src/types/payroll.ts`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Companies.tsx`
- `src/pages/Employees.tsx`
- `src/data/mock.ts`
- `src/components/payroll/PayrollTable.tsx`
- `src/components/payroll/EmployeeRowExpansion.tsx`
- `src/components/payroll/TotalsBar.tsx`
- `package-lock.json` (atualizado após `npm install`)

# 3) Decisões tomadas

1. **Menor mudança segura**: manutenção das páginas e layout atuais, com evolução local do contexto e formulários.
2. **Sem filial nesta fase**: vínculo permanece por `company_id`.
3. **Setor/função simples**: implementados como campos de texto (`department`, `role`), preparados para futura normalização.
4. **Uma conta bancária por funcionário**: `bank_name`, `bank_branch`, `bank_account`.
5. **Status por flags booleanas**: `is_active`, `is_on_leave`, `is_monthly`.
6. **Compatibilidade preservada**: `baseSalary` mantido para não quebrar a Central de Folha.

# 4) O que ficou propositalmente fora desta fase

- CRUD independente de setor e função.
- Entidade de filial/multifilial.
- Múltiplas contas bancárias por funcionário.
- Persistência oficial da Central de Folha (`payroll_entries`, rubricas, cálculos e processamento).
- Modelo completo de isolamento multi-tenant por usuário/perfil (RLS está permissivo por ora).

# 5) Riscos e próximos passos recomendados

## Riscos atuais
- RLS permissivo não oferece isolamento por usuário/empresa (apenas mantém RLS habilitado sem quebrar o app atual).
- CPF e CNPJ ainda sem máscara/normalização de formato no front.
- A Central de Folha continua com geração em memória e valores randômicos, sem persistência auditável.

## Próximos passos recomendados
1. Introduzir autenticação e contexto de tenant para endurecer policies de RLS por empresa.
2. Normalizar CPF/CNPJ (máscara + validação + limpeza de caracteres) antes de persistir.
3. Criar estrutura oficial de folha em banco (quando entrar no escopo).
4. Avaliar evolução de `department`/`role` para cadastros próprios se operação demandar controle administrativo.
