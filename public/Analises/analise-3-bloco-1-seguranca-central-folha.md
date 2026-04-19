# Bloco 1 — Segurança real da Central de Folha

## 1. Objetivo

Implementar proteção real no backend/RLS para o fluxo atual da `/central-de-folha`, garantindo coerência com a permissão `folha.operar` sem ampliar escopo para batch, recálculo ou mudanças estruturais da fase 1.

## 2. Diagnóstico encontrado

- Antes deste bloco, `payroll_entries` estava com policies permissivas (`using (true)` e `with check (true)`), permitindo exposição indevida no backend.
- `employees` também mantinha políticas abertas legadas, incompatíveis com o nível de segurança esperado para dados usados na Central.
- A UI já bloqueava rota por permissão (`PermissionRoute`), mas isso não era suficiente como barreira principal sem RLS coerente no backend.

## 3. Mudanças realizadas

- Arquivos alterados:
  - `supabase/migrations/20260419110000_block1_central_payroll_rls.sql`
  - `src/contexts/PayrollContext.tsx`

- Policies alteradas:
  - `public.employees`:
    - remove policies abertas legadas;
    - adiciona select por permissão (`folha.operar` OU `funcionarios.view`);
    - adiciona insert/update/delete por `funcionarios.view`.
  - `public.payroll_entries`:
    - remove policies abertas legadas;
    - adiciona select/insert/update/delete exigindo `folha.operar`.

- Helpers/hooks/services alterados:
  - `PayrollContext.loadData` passou a condicionar queries de `employees` e `payroll_entries` conforme permissões carregadas no `AuthContext`, evitando chamadas desnecessárias sem acesso.

## 4. Regras de segurança aplicadas

- `folha.operar` passou a ser requisito real de backend para operar `payroll_entries` (leitura e escrita).
- `employees` deixou de ficar aberto para qualquer usuário autenticado:
  - leitura somente com `folha.operar` ou `funcionarios.view`;
  - escrita somente com `funcionarios.view`.
- Resultado: esconder menu/rota deixou de ser única proteção; o backend agora sustenta o bloqueio efetivo.

## 5. Impacto no frontend

- Não houve redesign, nem mudança de fluxo visual da Central.
- Apenas ajuste mínimo no `PayrollContext` para não disparar consultas de folha quando o usuário não tem `folha.operar`.
- Mantido padrão existente de permissões via `AuthContext` + `PermissionRoute`.

## 6. Impacto no backend/RLS

- `payroll_entries` deixa de estar exposta indevidamente para usuários autenticados sem `folha.operar`.
- `employees` deixa de depender de policy aberta, alinhando acesso com permissões já existentes no sistema.
- A proteção agora é aplicada diretamente no banco (RLS), cobrindo chamadas fora da UI e acesso direto por API.

## 7. Riscos ou limitações restantes

- Este bloco não altera modelo estrutural da fase 1 (sem `payroll_batches`, sem `payroll_batch_id`).
- Não implementa recálculo backend.
- Permissões de edição de `employees` continuam baseadas em `funcionarios.view` para manter compatibilidade com comportamento atual; revisão fina de perfil de escrita pode ser feita em bloco futuro.
- Não foram localizados CSVs de esquema/RLS no workspace durante a execução; a validação foi feita pelas migrations e tipos Supabase existentes.

## 8. Próxima etapa recomendada

Executar bloco 2 com foco em estrutura da folha (batch formal e vínculo `payroll_entries` → batch), mantendo o mesmo critério de mudança mínima e segura.
