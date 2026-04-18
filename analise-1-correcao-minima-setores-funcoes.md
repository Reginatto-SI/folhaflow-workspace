## 1. Objetivo da correção
Aplicar a correção estrutural mínima e segura em `/setores` e `/funcoes-cargos` para reduzir os riscos altos apontados na auditoria, com foco em:
- remover exclusão física
- endurecer permissões reais no backend (RLS)
- condicionar carregamento de estrutura por permissão
- deixar o contexto de empresa mais explícito no create/edit
- impedir troca de empresa quando houver vínculo com funcionários

## 2. Arquivos alterados
- `src/contexts/PayrollContext.tsx`
  - condicionamento de carregamento de setores/cargos por permissão `estrutura.view`
  - substituição de delete físico por inativação/reativação
  - bloqueio de troca de empresa de setor/cargo com funcionários vinculados (pré-validação no contexto)
- `src/pages/Departments.tsx`
  - remoção da ação “Excluir” e substituição por “Inativar/Reativar”
  - novo fluxo de status sem delete físico
  - seleção explícita de empresa no novo cadastro (sem pré-preenchimento automático)
  - feedback explícito de empresa ativa no modal
- `src/pages/JobRoles.tsx`
  - remoção da ação “Excluir” e substituição por “Inativar/Reativar”
  - novo fluxo de status sem delete físico
  - seleção explícita de empresa no novo cadastro (sem pré-preenchimento automático)
  - feedback explícito de empresa ativa no modal
- `supabase/migrations/20260418193000_harden_structure_rls_and_integrity.sql`
  - endurecimento de policies RLS de `departments` e `job_roles`
  - remoção de delete policy (sem exclusão física)
  - trigger para bloquear troca de `company_id` quando houver funcionário vinculado

## 3. Correções aplicadas
### exclusão física
- UI de setores e funções/cargos deixou de expor “Excluir”.
- Ação agora é “Inativar/Reativar” com atualização de `is_active`.
- Contexto deixou de executar `delete()` para essas entidades.
- RLS remove policy de delete físico para `departments` e `job_roles`.

### permissões/RLS
- Policies permissivas antigas foram removidas.
- Novas policies exigem usuário autenticado com `has_permission(auth.uid(), 'estrutura.view')` para `select/insert/update`.
- Sem policy de delete para impedir exclusão física por API.

### carregamento por permissão
- `PayrollProvider` passou a condicionar fetch de `departments` e `job_roles` à permissão `estrutura.view`.
- Usuário autenticado sem essa permissão não dispara essas consultas no provider.

### contexto de empresa
- Novo cadastro em `/setores` e `/funcoes-cargos` agora exige seleção explícita de empresa (não herda automaticamente `selectedCompany`).
- Modal mostra texto da empresa ativa no contexto global para dar visibilidade operacional.
- Salvamento continua bloqueado sem `companyId` válido.

### integridade com funcionários
- No contexto, ao tentar alterar empresa de setor/cargo, há validação de vínculos em `employees`.
- No banco, trigger de proteção impede update de `company_id` em setor/cargo já vinculado a funcionário.
- Erro retorna mensagem explícita para o usuário.

## 4. Decisões de implementação
A solução foi mantida mínima e conservadora:
- sem reescrita de arquitetura
- sem criação de novos componentes
- sem alteração de fluxo macro do app
- ajustes localizados nas telas auditadas, no contexto já existente e em migration específica de segurança/integridade

Também foi adotada proteção em duas camadas para integridade (app + banco) para evitar regressão por acesso direto à API.

## 5. Riscos remanescentes
- O provider ainda faz preload de outros catálogos além de estrutura (fora do escopo desta correção mínima).
- A modelagem de permissões continua por código de tela único (`estrutura.view`) sem granularidade de ação (view/edit), seguindo padrão atual do projeto.
- Não foi feita revisão ampla de RLS de todos os módulos, apenas o necessário para `departments` e `job_roles`.

## 6. Checklist de validação
- [ ] usuário sem permissão não acessa estrutura
  - Validar login com role sem `estrutura.view` e acesso direto por URL `/setores` e `/funcoes-cargos`.
- [ ] delete físico não ocorre mais
  - Validar ausência de ação “Excluir” na UI.
  - Validar que não existe policy de delete para `departments`/`job_roles`.
- [ ] inativação/reativação funciona
  - Validar ação no menu “...” e troca de status em tabela.
- [ ] setor/cargo não pode trocar de empresa se tiver vínculo
  - Vincular funcionário ao setor/cargo e tentar alterar empresa no edit.
  - Esperar bloqueio com mensagem clara.
- [ ] criação/edição exige empresa válida
  - Tentar salvar novo cadastro sem empresa.
  - Esperar bloqueio com mensagem de validação.
- [ ] telas continuam operacionais
  - Validar listagem, filtros, edição e alteração de status nas duas telas.

## 7. Conclusão
Os problemas mínimos de risco alto levantados na auditoria foram **resolvidos em nível estrutural mínimo** para `/setores` e `/funcoes-cargos` (exclusão física, RLS permissiva, carregamento indevido de estrutura e integridade de troca de empresa com vínculo).

Ainda existem pontos de evolução fora do escopo (principalmente preload de outros módulos e granularidade de permissões), mas o estado atual sai do risco alto inicial para um patamar mais seguro e previsível dentro do escopo solicitado.
