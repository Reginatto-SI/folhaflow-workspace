# Análise — Conversão da tela `/funcionarios` para listagem global com filtro opcional por empresa

## 1. Diagnóstico do problema atual

A tela `/funcionarios` estava usando `employees` do `PayrollContext`, e esse array já vem filtrado por `selectedCompany?.id`. Isso prende a tela ao contexto da empresa ativa da folha e pode exibir `0 de 0` mesmo com funcionários em outras empresas.

## 2. Arquivos analisados

- `public/PRD/PRD-04 — Cadastro de Funcionários.txt`
- `public/PRD/PRD-05 — Cadastro de Empresas.txt`
- `public/PRD/PRD-06 — Cadastro de Setores e Funções-Cargos.txt`
- `public/PRD/PRD-10 — Usuários e Controle de Acesso.txt`
- `public/PRD/PRD-00B — Modelo Operacional Simplificado.txt`
- `src/contexts/PayrollContext.tsx`
- `src/pages/Employees.tsx`
- `src/components/employees/EmployeeFilters.tsx`

## 3. Fonte atual dos funcionários na tela

A página de funcionários usa o `usePayroll()` como fonte de dados. Antes do ajuste, consumia a coleção `employees` (já restrita por empresa ativa). Após ajuste, passa a consumir `allEmployees` para listagem global.

## 4. Como a empresa ativa estava afetando a listagem

No `PayrollContext`, `employees` é derivado com:

- `allEmployees.filter((employee) => employee.companyId === selectedCompany?.id)`.

Com isso, a tela de cadastro administrativo herdava o comportamento operacional da folha e ocultava funcionários de outras empresas.

## 5. Ajuste realizado para listagem global

- A tabela/filtros/KPIs da tela agora partem de `allEmployees`.
- Foi adicionado filtro manual de empresa (`companyId`) na área de filtros.
- Estado inicial do filtro: `Todas as empresas` (valor vazio).
- A empresa ativa da folha não restringe mais a listagem por padrão.

## 6. Funcionamento do filtro de empresa

- Sem seleção: mostra todos os funcionários permitidos (`Todas as empresas`).
- Com empresa selecionada: filtra `employee.companyId === filters.companyId`.
- Subtítulo da tela:
  - Global: `Todas as empresas — X funcionários`
  - Por empresa: `NOME DA EMPRESA — X de Y funcionários`

## 7. Funcionamento dos filtros de setor e função/cargo

Como setor/função pertencem à empresa, foi adotada abordagem previsível:

- Quando `Todas as empresas`: filtros de setor e função/cargo ficam desabilitados.
- Placeholders orientam o usuário a selecionar empresa para habilitar esses filtros.
- Quando empresa é selecionada: listas de setor/função carregam somente catálogo da empresa escolhida.

## 8. Impacto em cards e contador

- Cards (Total, Ativos, Afastados, Mensalistas) agora refletem a visão filtrada atual (`filteredEmployees`).
- Contador/subtítulo também reflete a visão atual, com distinção entre global e filtrada por empresa.

## 9. Impacto em cadastro, importação e exportação

- Cadastro: empresa registrante continua obrigatória.
  - Se filtro de empresa estiver ativo, o formulário pré-preenche essa empresa.
  - Se estiver em `Todas as empresas`, o formulário não herda empresa automaticamente e exige escolha explícita.
- Importação: mantém regra existente da planilha (Empresa ID/nome), e validação de duplicidade passou a usar `allEmployees` para não perder visão global.
- Exportação: já exportava `filteredEmployees`; com a nova base, exporta global quando sem filtro e por empresa quando filtrado.

## 10. Riscos evitados

- Nenhuma alteração na Central de Folha.
- Nenhuma alteração de RLS/políticas.
- Nenhuma nova arquitetura de contexto.
- Reuso dos componentes e padrões existentes de filtro/tabela/modal.

## 11. Checklist de testes manuais

- [ ] Abrir `/funcionarios` e ver todos os funcionários permitidos.
- [ ] Confirmar que a tela não fica presa automaticamente na empresa ativa da folha.
- [ ] Filtrar por uma empresa específica.
- [ ] Voltar para `Todas as empresas`.
- [ ] Buscar por nome.
- [ ] Buscar por CPF.
- [ ] Filtrar por status.
- [ ] Filtrar por setor (com empresa selecionada).
- [ ] Filtrar por função/cargo (com empresa selecionada).
- [ ] Conferir cards superiores.
- [ ] Conferir contador da tela.
- [ ] Conferir mensagem vazia sem filtros.
- [ ] Conferir mensagem vazia com filtro de empresa.
- [ ] Cadastrar novo funcionário com empresa específica.
- [ ] Cadastrar novo funcionário quando o filtro está em `Todas as empresas`.
- [ ] Editar funcionário existente.
- [ ] Exportar visão global.
- [ ] Exportar visão filtrada por empresa.
- [ ] Confirmar que a Central de Folha não mudou de comportamento.
