# Análise 6 — Refino da Tela Piloto de Funcionários (Grupo Empresarial)

## Diagnóstico curto do estado atual
- A tela piloto já tinha estrutura correta de modal administrativo (header, tabs, footer fixo), mas ainda faltava acabamento semântico para reduzir ambiguidades entre cadastro e folha.
- `Employee.companyId` já estava sendo usado como vínculo principal; com o refino, ficou explicitado no código e na UI que esse vínculo é **empresa registrada**.
- O campo de carteira de trabalho já existia com persistência em modelo/contexto/migração, porém o label e a orientação visual podiam ficar mais claros.
- `baseSalary` já estava fora da UI, mas faltava reforço textual na tela para evitar leitura ambígua de que salário pertence ao cadastro-base.

## O que foi refinado no front
- Ajuste do subtítulo da página para “funcionários registrados”, alinhando com o conceito de empresa registrada.
- Inclusão de texto auxiliar na página informando separação entre cadastro-base e operação de folha multiempresa.
- Refino do label da carteira para “Nº da carteira de trabalho (CTPS)” e placeholder mais objetivo.
- Inclusão de mensagem no footer do modal reforçando que salário/composição mensal é tratado na Central de Folha.

## Como salário base ficou tratado
- Continua **sem exibição** no cadastro de funcionário.
- Permanece internamente por compatibilidade técnica temporária com fluxos da Central de Folha.
- Comentários no código reforçam explicitamente essa decisão e limitação de fase.

## Como carteira de trabalho ficou tratada
- Campo presente na aba de dados do funcionário.
- Nome e orientação visual refinados para leitura operacional de RH.
- Persistência mantida via `workCardNumber` ↔ `work_card_number` no mapeamento com banco.

## Decisão final sobre empresa registrada
- Mantido `companyId` para menor mudança segura.
- Semântica oficial documentada: `companyId` representa **empresa registrada**.
- UI e comentários reforçam separação entre empresa registrada e participação em folha multiempresa.

## Como ficou documentada a limitação de folha multiempresa
- Comentários no contexto e textos da UI deixam explícito que participação em múltiplas folhas/empresas será tratada em camada futura dedicada.
- Nenhuma refatoração ampla foi feita nesta fase para evitar quebra de CRUD e de compatibilidade.

## Arquivos alterados
- `src/pages/Employees.tsx`
- `src/contexts/PayrollContext.tsx`
- `analise-6-refino-tela-piloto-funcionarios-grupo-empresarial.md`

## Riscos remanescentes
- A modelagem operacional de folha multiempresa ainda não existe; risco de interpretação indevida caso fluxos externos não sigam os novos comentários/labels.
- `baseSalary` ainda existe tecnicamente no modelo por compatibilidade; qualquer uso indevido em novas telas deve ser evitado por governança de produto.

## Próximos passos recomendados
1. Introduzir estrutura dedicada para participação de funcionário em folha por múltiplas empresas (sem usar `companyId` para isso).
2. Criar validações/UX específicas para gerenciar fontes de renda por empresa em fluxo de folha.
3. Reutilizar este padrão de modal piloto em outros cadastros administrativos para manter consistência visual e semântica.
