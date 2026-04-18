# Auditoria da tela `/funcionarios`

## 1. Resumo executivo

**Nível geral de aderência ao PRD:** **parcial**, com inconsistências críticas de regra de negócio e persistência.

A tela `/funcionarios` já implementa boa parte da base operacional (listagem, filtros, cadastro/edição em modal com abas, validações de CPF/formato e vínculo de setor/cargo por empresa). Porém, há divergências relevantes em relação ao PRD, sobretudo:

- presença de campo de folha (`base_salary`) no modelo/persistência de funcionário;
- uso de exclusão física (UI + contexto + banco) em vez de inativação;
- unicidade de CPF por empresa (não global);
- status modelado em booleans (`is_active`, `is_on_leave`, `is_monthly`) em vez de enum canônico (`ativo`, `inativo`, `afastado`);
- acoplamento operacional entre empresa registrante e Central de Folha (funcionário só entra na folha da empresa do próprio cadastro no fluxo atual);
- segurança de backend não aderente ao PRD-10 (RLS permissivo em `employees`, `companies`, `departments`, `job_roles`).

**Gravidade geral:** **alta** (devido a impactos diretos em integridade cadastral, segurança e comportamento multiempresa da folha).

---

## 2. Pontos consistentes

1. **Tela possui estrutura base esperada** (listagem, busca/filtros, botão “Novo funcionário”, edição em modal com abas).  
   - Aderente ao PRD-04 seção de UX (7.1 e 7.4).

2. **Não há campo de salário visível na UI de cadastro/edição**.
   - Há mensagens explícitas na tela indicando que salário/composição mensal pertencem à Central de Folha.
   - Aderente parcialmente ao PRD-04 (2, 3, 6 e 8) do ponto de vista visual.

3. **Validação de CPF em formato e dígitos verificadores no front-end**.
   - Regra de validação local implementada e máscara visual.
   - Aderente ao PRD-04 item 5.3 (formato).

4. **Setor e cargo como campos opcionais**.
   - Não são obrigatórios no formulário e podem ficar sem vínculo por ID.
   - Aderente ao PRD-04 item 4.2 e PRD-06 item 6.

5. **Validação de integridade de setor/cargo por empresa registrante**.
   - Front-end e trigger no banco validam `department_id` e `job_role_id` compatíveis com `company_id` do funcionário.
   - Aderente ao PRD-06 item 6/7.

6. **Estados de loading e vazio existem** na tela.
   - `isLoading` para carregamento e mensagem de vazio para empresa/filtro.
   - Parcialmente aderente ao PRD-04 item 10.

7. **Proteção de rota na UI para `/funcionarios` por permissão `funcionarios.view`**.
   - Aderente ao padrão de roteamento de permissão no front-end (PRD-10, parcialmente).

---

## 3. Pontos inconsistentes

### 3.1 Campo de folha proibido no cadastro de funcionário (`base_salary`) [**Crítico**]
- **Problema encontrado:** o modelo `Employee` mantém `baseSalary`; a tela inicializa `baseSalary: 0`; o contexto persiste `base_salary` em insert/update e carrega esse campo da tabela `employees`.
- **Por que está inconsistente:** PRD-04 determina que cadastro de funcionário não deve armazenar salário nem valores de folha (seções 2, 3, 6 e 8).
- **Referência PRD:** PRD-04 (2, 3, 6.1, 8).
- **Impacto prático:** mistura responsabilidades entre cadastro e folha; risco de interpretação errada de fonte de remuneração; aumenta chance de inconsistência entre cadastro e lançamentos mensais.

### 3.2 Exclusão física de funcionário permitida [**Crítico**]
- **Problema encontrado:** botão de lixeira na UI chama `deleteEmployee`; contexto executa `delete` em `employees`; migration cria policy de `delete` liberada (`using true`).
- **Por que está inconsistente:** PRD exige não exclusão física, apenas inativação.
- **Referência PRD:** PRD-04 item 5.5 e 8; PRD-10 item 7.4.
- **Impacto prático:** perda de histórico cadastral; possível quebra de rastreabilidade e reconciliação histórica.

### 3.3 CPF não é único no cadastro geral [**Crítico**]
- **Problema encontrado:** constraint é `(company_id, cpf)` (unicidade por empresa), sem unicidade global; migration de endurecimento reforça decisão de não global.
- **Por que está inconsistente:** PRD-04 pede CPF único no cadastro geral de funcionários (mesma pessoa não pode duplicar).
- **Referência PRD:** PRD-04 item 5.3 e 8.
- **Impacto prático:** risco de múltiplos cadastros da mesma pessoa em empresas distintas; duplicidade operacional e confusão em relatórios.

### 3.4 Status fora do modelo canônico do PRD [**Alta**]
- **Problema encontrado:** status é derivado por combinação de booleans (`isActive`, `isOnLeave`) e há atributo adicional `isMonthly`; filtro inclui `monthly`.
- **Por que está inconsistente:** PRD define status explícito com três estados (`ativo`, `inativo`, `afastado`), sem “mensalista” como status.
- **Referência PRD:** PRD-04 item 4.1 e 5.4.
- **Impacto prático:** semântica ambígua de status, risco de comportamentos conflitantes em seleções operacionais e integração com outros módulos.

### 3.5 Acoplamento indevido entre empresa registrante e operação da folha [**Crítico**]
- **Problema encontrado:** `employees` no contexto é filtrado por `selectedCompany`; na Central, inclusão de lançamento usa lista filtrada por `employee.companyId === selectedCompany.id`; criação de lançamento usa `employee.baseSalary` do cadastro.
- **Por que está inconsistente:** PRD-04 exige que empresa registrante seja referência cadastral e não bloqueie participação em folhas de outras empresas.
- **Referência PRD:** PRD-04 itens 2, 5.1, 5.2, 6.2 e 8.
- **Impacto prático:** bloqueio prático de lançamentos cruzados matriz/filial no fluxo atual; conflita com regra central do produto.

### 3.6 Segurança de backend não aderente ao PRD-10 [**Crítico**]
- **Problema encontrado:** RLS de `employees`, `companies`, `departments` e `job_roles` está permissiva (`select/insert/update/delete using true`), sem checagem de permissão por backend.
- **Por que está inconsistente:** PRD-10 exige validação de acesso no backend e bloqueio de URL direta não dependente apenas da UI.
- **Referência PRD:** PRD-10 itens 2, 5.3, 7.1 e 9.3.
- **Impacto prático:** usuário autenticado com acesso técnico à API pode operar dados fora da permissão da UI; risco de acesso indevido.

### 3.7 Ações da listagem não seguem padrão do PRD [**Média**]
- **Problema encontrado:** ações estão em dois ícones diretos (editar/excluir), não em menu `...`; não há ação explícita de inativar/reativar.
- **Por que está inconsistente:** PRD sugere menu `...` e ações `editar`, `inativar`, `reativar`, `visualizar dados`.
- **Referência PRD:** PRD-04 item 7.3.
- **Impacto prático:** UX fora do padrão descrito e induz fluxo de exclusão ao invés de inativação.

### 3.8 Campos obrigatórios do PRD ausentes no cadastro [**Média**]
- **Problema encontrado:** não há campo de `data_demissao`; não há status único explícito; listagem/edição não contemplam integralmente o modelo de status.
- **Por que está inconsistente:** PRD-04 inclui `data_demissao` opcional quando aplicável e status canônico.
- **Referência PRD:** PRD-04 itens 4.1, 4.2 e 7.4.
- **Impacto prático:** dificulta ciclo de desligamento e histórico coerente do colaborador.

### 3.9 Estado de erro da tela incompleto [**Média**]
- **Problema encontrado:** falhas de carregamento de funcionários não exibem estado de erro dedicado com retry na tela `/funcionarios`; há apenas toasts pontuais para catálogos quando modal abre.
- **Por que está inconsistente:** PRD pede estado de erro claro com tentativa de nova ação.
- **Referência PRD:** PRD-04 item 10 (Erro).
- **Impacto prático:** diagnóstico operacional prejudicado, dificuldade de recuperação sem recarregar aplicação.

### 3.10 Importação/exportação simuladas sem execução real [**Baixa/Média**]
- **Problema encontrado:** ações de export/import são placeholders (“simulação”).
- **Por que está inconsistente:** embora não seja explicitamente obrigatório no PRD-04 para esta fase, na prática cria affordance de funcionalidade sem entrega real.
- **Referência PRD:** PRD-00 (previsibilidade operacional, evitar ações sem efeito real).
- **Impacto prático:** expectativa incorreta do usuário e ruído operacional.

---

## 4. Pontos parcialmente aderentes

1. **Separação de responsabilidade “cadastro x folha” está parcialmente implementada na UI**, mas violada no modelo/persistência por `base_salary`.
2. **Empresa registrante está nomeada corretamente no formulário**, com texto explicativo, porém o comportamento operacional da Central ainda restringe por essa empresa.
3. **Status operacional existe de forma funcional**, porém com modelagem booleana e filtro “mensalista”, sem enum único do PRD.
4. **Setor/cargo opcionais e por empresa estão corretos**, mas coexistência com campos legados de texto (`department`, `role`) aumenta ambiguidade na exibição/listagem.
5. **Proteção de rota por permissão existe no front-end**, porém sem contrapartida obrigatória de proteção robusta no backend para o domínio de funcionários.

---

## 5. Riscos operacionais

1. **Risco de dados indevidos no cadastro**: manter salário no funcionário pode contaminar decisões de folha com base desatualizada.
2. **Risco de perda histórica**: exclusão física remove trilha e dificulta auditoria.
3. **Risco de duplicidade de pessoa**: CPF não global permite múltiplos registros para o mesmo colaborador.
4. **Risco de bloqueio de regra core do grupo empresarial**: lançamento cruzado entre empresas fica impedido no fluxo atual da Central.
5. **Risco de acesso indevido**: RLS permissiva abre margem para operações fora da permissão esperada.
6. **Risco de inconsistência de status**: combinações de booleans podem gerar estados inválidos/ambíguos para consumo de outros módulos.
7. **Risco de UX enganosa**: ações simuladas (import/export) e ação de exclusão em destaque podem induzir uso incorreto.

---

## 6. Melhorias mínimas recomendadas

> **Sem reescrever arquitetura; apenas ajustes pontuais e seguros.**

1. **Trocar exclusão física por inativação** no fluxo de `/funcionarios` (UI + contexto) e remover caminho de delete exposto para operação comum.
2. **Remover `base_salary` do payload de funcionário** no front-end/contexto (mantendo transição controlada no backend quando necessário), evitando novas gravações de salário no cadastro.
3. **Introduzir checagem de duplicidade de CPF global** antes de salvar (front) e preparar constraint global no banco com plano de saneamento.
4. **Padronizar status para enum único (`ativo`/`inativo`/`afastado`)** sem alterar demais a UX, apenas ajustando contrato e mapeamento.
5. **Adicionar `data_demissao` no formulário** (quando aplicável), alinhado ao PRD.
6. **Ajustar ações da listagem para menu `...`** com `editar`, `inativar/reativar` e `visualizar`.
7. **Exibir estado de erro de carregamento com retry** para falhas de dados principais da tela.
8. **Na Central de Folha, permitir seleção de funcionário além da empresa registrante** (mínimo viável sem refatoração total), para cumprir regra de lançamentos cruzados.
9. **Endurecer backend para domínio de funcionários** com políticas vinculadas a permissões, reduzindo dependência de bloqueio apenas na UI.

---

## 7. Ordem sugerida de correção

1. **Inconsistências críticas de regra de negócio**
   - remover dependência operacional da empresa registrante na seleção de funcionários da folha;
   - eliminar uso funcional de salário no cadastro.

2. **Inconsistências de persistência**
   - substituir delete por inativação;
   - fortalecer unicidade global de CPF;
   - convergir status para enum canônico.

3. **Inconsistências de UX**
   - ações no padrão menu `...`;
   - incluir `data_demissao`;
   - estado de erro com retry.

4. **Refinamentos**
   - retirar/ocultar ações simuladas sem backend real (ou sinalizar claramente como “em breve”);
   - reduzir ambiguidade de campos legados texto vs IDs.

---

## 8. Arquivos e trechos relevantes encontrados

### PRD (fonte de verdade)
- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-04 — Cadastro de Funcionários.txt`
- `public/PRD/PRD-06 — Cadastro de Setores e Funções-Cargos.txt`
- `public/PRD/PRD-10 — Usuários e Controle de Acesso.txt`

### Front-end: tela e fluxo
- `src/pages/Employees.tsx`
  - form/modelo inclui `baseSalary`;
  - validações CPF, setor/cargo por empresa;
  - ações de excluir;
  - filtros/status;
  - listagem + tabs + loading/vazio.
- `src/components/employees/EmployeeFilters.tsx`
  - status (`active`, `on_leave`, `monthly`) + filtros avançados.
- `src/contexts/PayrollContext.tsx`
  - mapeamento de `employees` incluindo `base_salary`;
  - insert/update/delete em `employees`;
  - filtro de `employees` por empresa selecionada.
- `src/types/payroll.ts`
  - contrato `Employee` com `baseSalary`, `isMonthly`, `isOnLeave`, `isActive`.
- `src/pages/Index.tsx`
  - criação de lançamento puxando `employee.baseSalary`;
  - seleção de funcionários restrita à empresa selecionada (`companyId`).
- `src/App.tsx` e `src/components/auth/PermissionRoute.tsx`
  - guarda de rota `/funcionarios` por `funcionarios.view` apenas na UI.

### Banco/migrações
- `supabase/migrations/20260404160000_create_companies_and_employees.sql`
  - schema de `employees` com `base_salary`, unique `(company_id, cpf)`, políticas RLS permissivas com delete liberado.
- `supabase/migrations/20260404183000_harden_employee_data_quality.sql`
  - normalização de CPF e restrições complementares; mantém decisão de unicidade por empresa.
- `supabase/migrations/20260404195000_employee_registered_company_and_work_card.sql`
  - comentário de `company_id` como empresa registrada.
- `supabase/migrations/20260404211000_create_departments_and_job_roles.sql`
  - setores/cargos por empresa, RLS permissivo.
- `supabase/migrations/20260404223000_employee_department_role_ids_transition.sql`
  - `department_id/job_role_id` + trigger validando mesma empresa.
- `supabase/migrations/20260418134415_7f2aba94-2012-46cd-996a-443cf25b644d.sql`
  - modelo de permissões/roles; não estende endurecimento RLS para `employees`.

---

## 9. Dúvidas abertas

1. **CPF global único no legado:** já existe decisão oficial de saneamento dos CPFs duplicados entre empresas para viabilizar constraint global sem bloquear operação?
2. **Estratégia de transição do `base_salary`:** existe cronograma para remover definitivamente do cadastro e da criação de lançamento na Central?
3. **Status canônico:** o time prefere migrar para enum textual único no banco já agora, ou manter booleans com camada de compatibilidade temporária?
4. **Lançamento cruzado na Central:** qual ajuste mínimo aceito no fluxo atual para liberar funcionário de empresa registrante diferente sem reescrever módulo?
5. **Permissões backend por módulo:** qual tabela/função será a fonte oficial para aplicar `funcionarios.view` diretamente em policies de `employees`?
6. **Ação “visualizar dados”:** deve ser somente leitura no mesmo modal atual ou drawer dedicado (reaproveitando componente existente)?

---

## Nota de escopo

Esta entrega foi exclusivamente de **diagnóstico técnico e funcional**, sem correções de código de produção além da criação deste relatório em arquivo Markdown, conforme solicitado.
