

# Plano: Corrigir CRUD funcional de /setores e /funcoes-cargos

## Problema identificado

As telas já têm toda a integração com banco (insert, update, delete via Supabase no PayrollContext). O problema é que ambas importam `departments` e `jobRoles` do contexto — que são **pré-filtrados** pela empresa selecionada no header global (`selectedCompany`). Isso causa:

1. Listagem vazia se nenhuma empresa estiver selecionada
2. Filtro por empresa na própria tela não funciona (dados já chegam filtrados)
3. KPIs mostram apenas dados da empresa atual, não o total real

## Solução

Trocar `departments` por `allDepartments` e `jobRoles` por `allJobRoles` nas respectivas páginas. Ambos já estão expostos no contexto. Nenhuma alteração de banco, contexto ou layout necessária.

## Mudanças por arquivo

### 1. `src/pages/Departments.tsx` (linha 59)

Alterar de:
```typescript
const { companies, selectedCompany, departments, addDepartment, ... } = usePayroll();
```
Para:
```typescript
const { companies, selectedCompany, allDepartments: departments, addDepartment, ... } = usePayroll();
```

### 2. `src/pages/JobRoles.tsx` (linha 32)

Alterar de:
```typescript
const { companies, selectedCompany, jobRoles, addJobRole, ... } = usePayroll();
```
Para:
```typescript
const { companies, selectedCompany, allJobRoles: jobRoles, addJobRole, ... } = usePayroll();
```

## Impacto

- Zero mudança em outros arquivos
- Filtros da própria tela passam a funcionar corretamente (incluindo filtro por empresa)
- KPIs refletem totais reais
- CRUD já funciona — apenas a listagem estava limitada

