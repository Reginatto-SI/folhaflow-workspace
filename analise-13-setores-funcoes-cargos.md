## 1. Resumo executivo
A implementação atual de `/setores` e `/funcoes-cargos` está **parcialmente aderente** ao PRD-06: a modelagem base (vínculo por empresa, nome, status ativo/inativo, edição via modal e separação entre telas) está presente, porém há desvios críticos em exclusão física, isolamento de acesso e consistência de contexto de empresa.

Do ponto de vista de permissões (PRD-10), a proteção está correta na camada de rota/UI (`PermissionRoute` + menu), mas **não está refletida de forma equivalente no backend/RLS** para setores/cargos (e também para funcionários), o que mantém risco de acesso/manipulação indevida fora do fluxo visual.

Do ponto de vista operacional, há fragilidade no contexto de empresa ativa: as telas dependem de `selectedCompany` global sem seletor explícito nelas, e esse estado pode vir de outra tela (especialmente Central de Folha), gerando risco de cadastro em empresa inesperada.

Conclusão executiva: o módulo **não está pronto para ser considerado aderente e seguro** sem correções mínimas estruturais em políticas de acesso, regra de exclusão e consistência de contexto multiempresa.

## 2. Escopo auditado
Arquivos e fluxos analisados:

- PRDs (fonte de verdade):
  - `/public/PRD/PRD-06 — Cadastro de Setores e Funções-Cargos.txt`
  - `/public/PRD/PRD-10 — Usuários e Controle de Acesso.txt`
  - `/public/PRD/PRD-04 — Cadastro de Funcionários.txt`
  - `/public/PRD/PRD-00 — Visão Geral do Produto.txt`
- Rotas e guards:
  - `src/App.tsx`
  - `src/components/auth/ProtectedRoute.tsx`
  - `src/components/auth/PermissionRoute.tsx`
  - `src/components/auth/Forbidden.tsx`
- Navegação/menu e coerência com permissão:
  - `src/components/layout/AppLayout.tsx`
- Contextos e carregamento de dados:
  - `src/contexts/AuthContext.tsx`
  - `src/contexts/PayrollContext.tsx`
- Telas auditadas:
  - `src/pages/Departments.tsx` (`/setores`)
  - `src/pages/JobRoles.tsx` (`/funcoes-cargos`)
- Integração com funcionários:
  - `src/pages/Employees.tsx`
  - `src/types/payroll.ts`
- Persistência e segurança (migrations/RLS):
  - `supabase/migrations/20260404211000_create_departments_and_job_roles.sql`
  - `supabase/migrations/20260404223000_employee_department_role_ids_transition.sql`
  - `supabase/migrations/20260404160000_create_companies_and_employees.sql`
  - `supabase/migrations/20260418134415_7f2aba94-2012-46cd-996a-443cf25b644d.sql`
  - `supabase/migrations/20260418172233_f6b94bb6-d49f-4ac5-805f-2f520a98fb0c.sql`

## 3. Aderência ao PRD-06
### itens aderentes
- Entidades de setores e funções/cargos possuem `company_id`, `name`, `is_active`, `created_at`, `updated_at` no banco.
- UI exige nome e empresa no create/edit.
- Separação de telas entre setores e funções/cargos está implementada.
- Há status ativo/inativo com edição em modal e exibição por badge.
- Relação com funcionários por `department_id`/`job_role_id` existe e possui validação de empresa na trigger de funcionário.

### itens parcialmente aderentes
- Regra “não compartilhar automaticamente entre empresas” está atendida no modelo de dados, mas a listagem de `/setores` e `/funcoes-cargos` usa catálogo global (`allDepartments`/`allJobRoles`) e depende de filtro manual por empresa, o que aumenta risco de operação em contexto errado.
- Contexto de empresa para novo cadastro é pré-preenchido por `selectedCompany`, porém esse estado não é definido diretamente nessas telas (dependência implícita do contexto global).
- Status inativo existe e funciona, mas a tela de funcionários deliberadamente exibe setores/cargos ativos e inativos no formulário para evitar dropdown vazio legado; isso conflita parcialmente com a diretriz do PRD-06 de não aparecer em novos cadastros.

### itens não aderentes
- Exclusão física está permitida e exposta nas telas (ação “Excluir”), contrariando PRD-06 (inativação obrigatória).
- Policies de delete em `departments` e `job_roles` estão abertas (`for delete using (true)`), reforçando não aderência da regra de não exclusão física.
- Não há enforcement de permissão de estrutura no backend para setores/cargos (PRD-10 exige backend + UI).

## 4. Impacto do PRD-10 e das permissões
Status: **parcial/incorreto**.

O que está correto:
- Rotas `/setores` e `/funcoes-cargos` usam `PermissionRoute permission="estrutura.view"`.
- Menu lateral também oculta/exibe os itens por `hasPermission("estrutura.view")`.
- Acesso por URL direta sem permissão cai em tela de `Forbidden` na UI.

O que está incorreto (crítico):
- `PayrollProvider` carrega dados (companies/employees/departments/job_roles/rubricas/payroll_entries) antes da verificação fina de permissão da rota, então usuário autenticado sem `estrutura.view` ainda aciona consultas de catálogo ao entrar no app.
- No banco, as tabelas `departments` e `job_roles` foram criadas com RLS permissivo total (`select/insert/update/delete` com `true`), sem uso de `has_permission(auth.uid(), 'estrutura.view')`.
- O mesmo padrão permissivo ocorre em `employees`, ampliando superfície de exposição entre módulos relacionados.

Conclusão de permissões: há controle de navegação, mas **segurança real está incompleta**, contrariando o núcleo do PRD-10 (“UI não pode ser considerada segurança”).

## 5. Riscos encontrados
### alto
- Exclusão física de setores/cargos habilitada em UI + backend.
- RLS permissiva sem enforcement de `estrutura.view` para setores/cargos.
- Carregamento de dados sensíveis pelo provider antes da checagem de permissão da rota.
- Possibilidade de alterar `company_id` em edição de setor/cargo, gerando inconsistência cross-company com funcionários já vinculados.

### médio
- Dependência implícita de `selectedCompany` global sem seletor explícito na tela, com risco de cadastro na empresa errada.
- Falhas de carregamento de catálogo (setores/cargos) podem ser percebidas como vazio operacional, sem UX clara de erro nas telas auditadas.
- Exibição de setores/cargos inativos no formulário de funcionários em novos cadastros, contrariando expectativa do PRD-06.

### baixo
- Mensagens de erro genéricas (“não foi possível...”) dificultam diagnóstico operacional.
- Funcionalidades de import/export estão em modo simulação e podem gerar expectativa indevida de completude.

## 6. Problemas identificados
### Problema 1
- título: Exclusão física de setores/cargos ainda ativa
- severidade: alto
- onde ocorre: `src/pages/Departments.tsx`, `src/pages/JobRoles.tsx`, `src/contexts/PayrollContext.tsx`, migration `20260404211000_create_departments_and_job_roles.sql`
- causa provável: manutenção de padrão CRUD antigo com `delete()` real e policy de delete permissiva.
- impacto real: perda definitiva de cadastros estruturais e quebra de aderência ao PRD; risco de impacto em histórico e integrações.
- evidência no código: ação “Excluir” chama `deleteDepartment`/`deleteJobRole`; contexto executa `supabase.from(...).delete()`; migration cria policy `for delete using (true)`.
- recomendação mínima de correção: substituir exclusão por toggle de `is_active` (inativar/reativar), remover ação de delete físico da UI e eliminar policy de delete nas tabelas.

### Problema 2
- título: Segurança de estrutura baseada só em UI (backend sem permissão explícita)
- severidade: alto
- onde ocorre: `src/components/auth/PermissionRoute.tsx`, `src/App.tsx`, migration `20260404211000_create_departments_and_job_roles.sql`
- causa provável: implementação de permissões primeiro no frontend e não propagada para RLS dessas tabelas.
- impacto real: usuário sem permissão de estrutura pode ainda consultar/manipular dados via chamadas diretas à API (dependendo do token de sessão), violando PRD-10.
- evidência no código: proteção de rota existe, mas policies de `departments`/`job_roles` são `using (true)`/`with check (true)` em select/insert/update/delete.
- recomendação mínima de correção: reescrever policies para `authenticated` com `has_permission(auth.uid(), 'estrutura.view')` (e granularidade de escrita conforme papel definido).

### Problema 3
- título: Carregamento antecipado de dados sem autorização contextual da tela
- severidade: alto
- onde ocorre: `src/App.tsx`, `src/contexts/PayrollContext.tsx`
- causa provável: `PayrollProvider` envolve toda a área autenticada e executa `loadData()` no mount, independente da rota/permissão efetiva da página.
- impacto real: risco de exposição indireta e consumo desnecessário de dados mesmo para usuário que não pode acessar a tela final.
- evidência no código: `loadData()` busca `departments` e `job_roles` para todos os usuários autenticados na árvore protegida.
- recomendação mínima de correção: desacoplar carregamentos por módulo/rota, ou condicionar consultas sensíveis à permissão no provider.

### Problema 4
- título: Contexto de empresa ativa frágil e implícito nas telas auditadas
- severidade: médio
- onde ocorre: `src/pages/Departments.tsx`, `src/pages/JobRoles.tsx`, `src/contexts/PayrollContext.tsx`, `src/components/payroll/PayrollHeader.tsx`
- causa provável: `selectedCompany` global é escolhido automaticamente na carga e alterado principalmente na Central de Folha; telas de estrutura não possuem seletor dedicado.
- impacto real: risco de criar/editar no CNPJ errado por estado herdado de navegação anterior.
- evidência no código: `openNew` preenche `companyId` com `selectedCompany?.id`; não existe seletor de empresa no layout geral ou nas telas de estrutura para troca rápida de contexto.
- recomendação mínima de correção: exibir seletor explícito de empresa nas telas de estrutura (ou header global), com trava de confirmação de contexto para criação/edição.

### Problema 5
- título: Possível inconsistência cross-company ao editar setor/cargo e trocar empresa
- severidade: alto
- onde ocorre: `src/pages/Departments.tsx`, `src/pages/JobRoles.tsx`, `src/contexts/PayrollContext.tsx`, trigger de funcionário em `20260404223000_employee_department_role_ids_transition.sql`
- causa provável: update permite alterar `company_id` de setor/cargo sem validação de impacto em funcionários já vinculados por FK.
- impacto real: funcionário pode manter `department_id`/`job_role_id` válido em FK, mas semanticamente agora ligado a empresa divergente.
- evidência no código: modal de edição permite trocar “Empresa vinculada”; `updateDepartment`/`updateJobRole` inclui `company_id`; trigger valida apenas insert/update de employees, não update de departments/job_roles.
- recomendação mínima de correção: bloquear troca de empresa em registros já vinculados a funcionários, ou validar e impedir mudança quando houver vínculos.

### Problema 6
- título: Tratamento de erro parcial/silencioso em catálogos
- severidade: médio
- onde ocorre: `src/contexts/PayrollContext.tsx`, `src/pages/Departments.tsx`, `src/pages/JobRoles.tsx`
- causa provável: `loadData` não promove erro global para todas as consultas e telas auditadas não consomem `payrollCatalogErrors`.
- impacto real: falha de consulta pode parecer “lista vazia”, levando usuário a decisões incorretas (novo cadastro desnecessário, retrabalho).
- evidência no código: páginas só checam `isLoading` e tamanho da lista; não exibem erro de catálogo de setores/cargos.
- recomendação mínima de correção: exibir estado de erro por catálogo nas telas de estrutura com ação de retry.

### Problema 7
- título: Divergência parcial da regra de inativos no fluxo de novos funcionários
- severidade: médio
- onde ocorre: `src/pages/Employees.tsx`
- causa provável: estratégia de transição para evitar dropdown vazio legado.
- impacto real: novo funcionário pode ser associado a setor/cargo inativo, contrariando expectativa de uso operacional.
- evidência no código: `availableDepartments`/`availableJobRoles` incluem ativos e inativos.
- recomendação mínima de correção: em novo cadastro, listar apenas ativos; em edição, manter item inativo já vinculado como exceção.

## 7. Inconsistências com funcionários
- Há ponto positivo: validação de formulário em `/funcionarios` impede selecionar setor/cargo de empresa diferente da `empresa registrante`, e trigger no banco reforça esse vínculo em insert/update de funcionário.
- Porém, há inconsistência estrutural relevante: se setor/cargo mudar de empresa na própria tela de estrutura, os funcionários já vinculados não passam por revalidação automática (trigger não cobre update em catálogo), abrindo janela de inconsistência sem erro explícito.
- A regra de exibir inativos no dropdown funcional de funcionários ajuda legados, mas conflita com a regra operacional de “inativo não deve aparecer em novos cadastros”.
- Como as políticas de RLS de `employees` também estão permissivas, o isolamento de dados entre perfis não depende de permissão de módulo no backend.

## 8. Débitos técnicos e pontos frágeis
- Provider monolítico (`PayrollProvider`) carrega múltiplos módulos para qualquer usuário autenticado.
- RLS ainda heterogênea: `companies` já está endurecida por permissão; `departments`, `job_roles` e `employees` não.
- Ações de exclusão física permanecem em módulos que deveriam operar por inativação.
- Dependência de estado global de empresa sem affordance explícita em todas as telas administrativas.
- Mensagens de erro genéricas e sem granularidade por operação/causa.

## 9. Correção mínima recomendada
Sem implementar agora, a abordagem mínima segura seria:

1. **Segurança/RLS primeiro (bloqueio de risco alto)**
   - Revisar policies de `departments` e `job_roles` para exigir usuário autenticado + `has_permission(auth.uid(), 'estrutura.view')` (e separar escrita conforme regra do produto).
   - Remover policy de delete físico nessas tabelas.

2. **Convergência de regra de exclusão**
   - Substituir “Excluir” por “Inativar/Reativar” nas telas e no contexto.
   - Manter histórico e coerência com PRD-06/PRD-10.

3. **Consistência de contexto empresa**
   - Tornar explícito o contexto de empresa na tela (seletor fixo ou indicador acionável), reduzindo dependência de estado herdado.
   - No create, impedir salvar sem confirmação de empresa corrente.

4. **Integridade entre estrutura e funcionários**
   - Bloquear troca de `company_id` de setor/cargo quando houver funcionários vinculados, ou criar validação transacional equivalente.

5. **Erros e observabilidade operacional**
   - Exibir erro específico de catálogo em `/setores` e `/funcoes-cargos` com retry, evitando falso “vazio”.

6. **Ajuste de regra de inativos em funcionários**
   - Novo cadastro: apenas ativos.
   - Edição: permitir visualizar vínculo inativo existente (sem oferecer inativos para novas seleções).

## 10. Conclusão final
- a tela está pronta ou não? **Não está pronta** para operação considerada segura/aderente sem correções mínimas.
- o PRD está corretamente refletido ou não? **Parcialmente**; há aderência funcional básica, mas falhas críticas em exclusão e segurança.
- ainda há pendências relacionadas à autenticação/permissões? **Sim, pendências críticas** (backend/RLS e carregamento antecipado sem escopo de permissão).
- é seguro seguir para ajustes finos ou ainda precisa de correção estrutural? **Precisa de correção estrutural mínima primeiro** (RLS + exclusão + consistência de empresa), depois ajustes finos.
