# Análise — Funcionários cadastrados não aparecem na tela `/funcionarios`

## 1) Resumo do problema

Usuários relatam que há funcionários cadastrados, mas a tela **Funcionários** mostra lista vazia, contador `0 de 0` e cards zerados.

Pelo código atual, a tela **não consulta o banco diretamente**: ela consome `employees` já filtrado no `PayrollContext`, e esse array já vem restrito à `selectedCompany` global.

Resultado: se a empresa ativa no contexto global não for a mesma empresa em que os funcionários foram gravados, a tela mostrará vazio mesmo com dados existentes em `allEmployees`.

---

## 2) Arquivos analisados

- `public/PRD/PRD-04 — Cadastro de Funcionários.txt`
- `public/PRD/PRD-05 — Cadastro de Empresas.txt`
- `public/PRD/PRD-06 — Cadastro de Setores e Funções-Cargos.txt`
- `public/PRD/PRD-10 — Usuários e Controle de Acesso.txt`
- `public/PRD/PRD-00B — Modelo Operacional Simplificado.txt`
- `src/pages/Employees.tsx`
- `src/components/employees/EmployeeFilters.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/components/layout/AppLayout.tsx`
- `supabase/migrations/20260404160000_create_companies_and_employees.sql`
- `supabase/migrations/20260419110000_block1_central_payroll_rls.sql`

---

## 3) Como a empresa ativa é determinada

### Evidência técnica

1. A empresa ativa da aplicação é `selectedCompany` no `PayrollContext`.
2. Em `loadData`, após carregar `companies`, o contexto define a empresa selecionada com:
   - mantém a atual se ainda existir e estiver ativa;
   - senão usa **a primeira empresa ativa** da lista (`find(c => c.isActive)`), e a lista vem ordenada por nome.
3. Não há uso de `localStorage`/`sessionStorage` para empresa ativa nesse fluxo analisado.
4. A tela `/funcionarios` não implementa seletor próprio de empresa; ela só exibe `selectedCompany?.name` no cabeçalho.

### Conclusão

A empresa ativa vem de **contexto global** (`PayrollContext`) e não de um estado local da página de funcionários.

---

## 4) Query atual de funcionários

### Fonte de dados

- `PayrollContext.loadData` executa `supabase.from("employees").select("*").order("name")` (sem filtro por empresa na query SQL).
- Depois disso, o frontend aplica filtro em memória:
  - `employees = allEmployees.filter(employee => employee.companyId === selectedCompany?.id)`.

### Campo de empresa usado

- O filtro de empresa na listagem usa `employee.companyId` no frontend.
- Esse `companyId` mapeia para coluna `company_id` da tabela `employees`.

### Respostas objetivas (itens 1 e 2 solicitados)

1. A tela filtra por qual campo? **`company_id` (via `employee.companyId` no model).**
2. É `empresa_id`, `empresa_registrante_id`, `company_id` ou outro? **`company_id`**.

---

## 5) Filtros aplicados automaticamente

### Filtro de empresa

Sim, existe filtro automático por empresa ativa (contexto global), aplicado antes dos filtros visuais da tela.

### Filtros visuais (Nome/CPF, Status, Setor, Função)

- Estado inicial dos filtros é vazio (`""`) para todos os campos.
- `Status` usa `""` como equivalente de "Todos".
- `departmentId` e `jobRoleId` iniciam vazios e só filtram se preenchidos.
- Não há persistência em storage para restaurar filtros antigos.

### Conclusão

Não foi encontrada evidência de filtro visual indevido automático quando “Todos” está selecionado. O principal filtro automático é o de empresa do contexto global.

---

## 6) Validação dos cards e contador

- Cards (`Total`, `Ativos`, `Afastados`, `Mensalistas`) usam `employees` (já filtrado por empresa ativa).
- Contador “x de y” usa `filteredEmployees.length` sobre `employees.length`.
- Tabela também usa `filteredEmployees`.

### Conclusão

Cards, contador e tabela estão consistentes entre si (mesma base lógica), portanto se a base da empresa ativa vier vazia, **todos** ficam zerados ao mesmo tempo.

---

## 7) Validação de cadastro/importação

### Cadastro manual

- `openNew` inicializa `form.companyId` com `selectedCompany?.id`.
- `buildPayload` usa `form.companyId || selectedCompany?.id`.
- `addEmployee` grava `company_id` com esse valor.

**Resultado:** novo cadastro tende a gravar na empresa exibida/ativa no momento do cadastro.

### Importação

- Importação prioriza `Empresa ID`; fallback por nome da empresa.
- Cada linha cria funcionário em `company.id` resolvido da planilha.

**Resultado:** importação pode gravar em empresa diferente da empresa atualmente exibida na tela, dependendo do arquivo.

---

## 8) Possíveis causas encontradas

1. **Empresa ativa no contexto global diferente da empresa onde os funcionários foram cadastrados/importados**.
2. Importação em lote gravando registros em outra empresa (por `Empresa ID`/`Empresa` da planilha).
3. Registros existentes em empresas inativas (continuam em `allEmployees`, mas podem não bater com empresa ativa mostrada).
4. Menor probabilidade: usuário sem permissão `funcionarios.view` (RLS impediria retorno), porém nesse cenário normalmente o módulo inteiro já sofre restrição de acesso.

---

## 9) Causa mais provável (com evidências)

### Causa mais provável

**Desalinhamento de contexto de empresa ativa**: a tela mostra `selectedCompany` global (ex.: COMERCIAL), mas os funcionários existentes podem estar com `company_id` de outra empresa.

### Evidências

- Filtro de listagem por `selectedCompany.id` é obrigatório no contexto (`employees = allEmployees.filter(...)`).
- Página não possui seletor próprio de empresa para conferência imediata.
- Contador/cards/tabela usam a mesma coleção já filtrada.
- Importação permite direcionar empresa via planilha.

---

## 10) Correção mínima recomendada

> Nesta tarefa foi feita análise; não foi aplicada mudança de código sem validação de dados reais.

Correção mínima sugerida (segura e aderente ao padrão atual):

1. **Diagnóstico assistido na UI de Funcionários** (sem mudar arquitetura):
   - exibir no vazio da tabela uma dica contextual quando `employees.length === 0` e houver `allEmployees` em outras empresas (ex.: “Sem funcionários na empresa ativa X”).
2. **Adicionar validação de coerência de contexto** na tela:
   - quando importar, mostrar claramente “empresa destino por linha” (já existe lógica, faltaria reforço visual).
3. **(Opcional mínima)** inserir seletor de empresa já existente do padrão global no header comum (reuso), se o projeto confirmar esse padrão para todas as telas administrativas.

---

## 11) Riscos da correção

- Expor contagem de funcionários de outras empresas pode ser sensível se houver futura política de isolamento por empresa (hoje RLS está por permissão/tela, não por company_id).
- Incluir seletor local de empresa sem alinhar com contexto global pode criar dupla fonte de verdade.
- Mudar a query para filtrar direto no banco por empresa, sem rever demais telas, pode quebrar consistência do provider.

---

## 12) Checklist de testes manuais

1. Cadastrar funcionário na empresa ativa e confirmar aparição imediata na tabela.
2. Trocar empresa no contexto global e confirmar isolamento por empresa.
3. Validar status ativo, inativo e afastado.
4. Validar status “Todos” exibindo todos os permitidos.
5. Buscar por nome.
6. Buscar por CPF (com e sem máscara).
7. Filtrar por setor.
8. Filtrar por função/cargo.
9. Validar funcionário sem setor/função (se permitido).
10. Validar cards superiores.
11. Validar contador “x de y funcionários”.
12. Recarregar a página e validar continuidade do contexto/dados.
13. Testar usuário com acesso a uma única empresa.
14. Testar usuário com acesso a múltiplas empresas.

---

## Respostas diretas às 15 perguntas obrigatórias

1. **Campo usado na tela para empresa:** `company_id` (via `employee.companyId`).
2. **Nome do campo:** `company_id`.
3. **Empresa do topo e query são a mesma?** Sim, ambas derivam de `selectedCompany` + filtro por `companyId` no contexto.
4. **Empresa ativa vem de onde?** Do contexto global `PayrollContext` (carregado de `companies` e default para primeira ativa quando necessário).
5. **Existem funcionários no banco em outra empresa?** Não foi possível confirmar sem acesso ao banco em execução; o código permite esse cenário.
6. **Existem funcionários sem empresa?** Pelo schema `company_id` é `not null`; sem banco real não dá para afirmar ocorrência histórica.
7. **Status diferente do esperado?** Possível (flags `is_active` e `is_on_leave`), mas não confirmado sem dados reais.
8. **Filtro status restringe mesmo em “Todos”?** Não; “Todos” mapeia para `status = ""` e não filtra.
9. **Setor/função aplicados automaticamente vazios?** Não; só filtram se `departmentId`/`jobRoleId` estiverem preenchidos.
10. **Filtro setor/função depende da empresa ativa e pode zerar?** Depende da empresa para opções de filtro, mas não zera sozinho quando vazio.
11. **Há RLS impedindo leitura?** Há RLS por permissão (`funcionarios.view`/`folha.operar`), não por empresa.
12. **Contador usa mesma query da tabela?** Sim, mesma base `filteredEmployees`/`employees`.
13. **Cards usam mesma base da tabela?** Sim, usam `employees` do contexto.
14. **Cadastro/importação grava empresa corretamente?** Cadastro grava empresa ativa/formulário; importação grava empresa da planilha.
15. **Novo cadastro grava empresa do topo ou outra?** Por padrão, grava a empresa ativa exibida (salvo ajuste manual do campo empresa no formulário).
