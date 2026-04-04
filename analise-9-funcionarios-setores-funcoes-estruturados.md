# Análise 9 — Funcionários com Setores/Funções estruturados por ID

## Diagnóstico curto (pré-implementação)
- **Funcionário** ainda persistia `department` e `role` como texto livre, sem vínculo relacional por ID.
- **Setores (`departments`) e Funções/Cargos (`job_roles`)** já existiam como catálogos separados por empresa (`company_id`) e com status ativo/inativo.
- A tela `/funcionarios` consumia catálogos apenas como **sugestão** (`datalist`) e ainda aceitava digitação livre como caminho principal.
- Menor mudança segura para transição: **adicionar `department_id` e `job_role_id` no funcionário**, manter `department`/`role` temporariamente para legado e sincronizar UI para seleção estruturada.

## O que foi alterado
1. **Banco / migração**
   - Adicionados `employees.department_id` e `employees.job_role_id` com FK para `departments` e `job_roles` (`on delete restrict`).
   - Adicionados índices para os novos vínculos.
   - Criada trigger de validação para garantir que `department_id`/`job_role_id` pertençam à mesma `company_id` do funcionário.

2. **Modelagem e tipagem**
   - `Employee` agora suporta `departmentId` e `jobRoleId`.
   - Mapeamentos de contexto (`PayrollContext`) atualizados para ler/gravar IDs estruturados sem remover campos legados.
   - Tipos Supabase atualizados com novas colunas e relacionamentos.

3. **Tela `/funcionarios`**
   - `Setor` e `Função/Cargo` migrados de `Input + datalist` para `Select` estruturado.
   - Opções filtradas pela **empresa registrada do formulário** (`companyId`), não apenas pela empresa selecionada no topo da listagem.
   - Mantido aviso de legado quando há texto histórico sem ID vinculado.

## Como ficou a modelagem
- **Novo (principal):**
  - `employees.department_id -> departments.id`
  - `employees.job_role_id -> job_roles.id`
- **Legado (temporário):**
  - `employees.department` (texto)
  - `employees.role` (texto)
- Estratégia de convivência: gravação de ID estruturado + preservação do texto para histórico e compatibilidade gradual.

## Tratamento do legado
- Funcionários antigos com texto livre continuam carregando normalmente.
- Quando não existe correspondência no catálogo atual, o registro permanece com texto legado e sem ID.
- UI sinaliza explicitamente quando o dado funcional está em legado (texto sem vínculo).

## Atualização da tela de funcionário
- Fluxo principal agora é seleção em catálogo ativo por empresa registrada.
- Ao trocar empresa registrada no formulário, vínculos por ID são limpos para evitar associação inválida.
- Validação de front impede salvar ID de setor/função que não seja ativo e da empresa correta.
- Setor e Função/Cargo foram evoluídos para **combobox com busca** (filtro em memória, case-insensitive e por qualquer parte do nome), com estado de vazio e CTA visual para criação futura.

## Regras de integridade implementadas
- **Proteção contra exclusão em uso:** via FK (`on delete restrict`) em `department_id` e `job_role_id`.
- **Consistência empresa x catálogo:** trigger no banco valida correspondência de `company_id`.
- **Validação mínima adicional no front:** bloqueia seleção inválida/inativa antes do write.

## Riscos remanescentes
- Ainda existe convivência de campos duplicados (ID + texto), exigindo cuidado em relatórios/integrações que leiam apenas legado.
- Não foi feita retro-migração automática de todo histórico legado para IDs para evitar inferência arriscada de correspondência textual.

## Próximos passos recomendados
1. Criar rotina assistida para conciliar `department`/`role` legados com catálogos ativos por empresa.
2. Após cobertura satisfatória, tornar `department_id`/`job_role_id` obrigatórios para novos cadastros.
3. Planejar remoção final de `department`/`role` texto em fase controlada com checklist de impacto.
