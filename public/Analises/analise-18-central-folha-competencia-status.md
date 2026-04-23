# Análise 18 — Central de Folha: competências válidas e status operacional

## O que foi encontrado
- O seletor de competência no `PayrollHeader` era preenchido por uma janela fixa de meses (-12/+12), independente da existência de folha formal para a empresa.
- O `PayrollContext` criava automaticamente um `payroll_batch` ao trocar escopo, o que impedia estado vazio real de competências.
- O status da folha era apenas visual (`Badge`) e não tinha ação de persistência.
- A base tinha `status` restrito a `draft`.

## O que foi alterado
- Competência da Central agora é derivada apenas de `payroll_batches` da empresa selecionada, ordenada da mais recente para a mais antiga.
- Removida a criação automática de batch ao trocar empresa/competência; criação permanece apenas quando necessário (ex.: novo lançamento).
- Badge de status virou controle clicável com `Dialog` + `Select` para estados `em_edicao`, `em_revisao`, `finalizado`.
- Adicionada persistência de status da folha no `PayrollContext` com atualização imediata do estado local.
- Ajustada migração para aceitar e padronizar os três status operacionais.
- Atualização mínima dos PRDs 03 e 09 para formalizar regras.

## Arquivos tocados
- `src/components/payroll/PayrollHeader.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/types/payroll.ts`
- `supabase/migrations/20260423110000_payroll_batch_status_operacional.sql`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-09 — Duplicação de Folha de Pagamento.txt`

## Validações executadas
- Build TypeScript/Vite para garantir integridade do front.
- Suite de testes automatizados existente.
- Verificação de lint do projeto.

## Pontos de atenção
- Registros antigos com `status = draft` passam a `em_edicao` via migração.
- Se a empresa não tiver `payroll_batches`, a competência fica vazia até criação de nova folha (fluxo existente de lançamento/duplicação).
- Constraint de status foi recriada de forma explícita na migration para aceitar somente `em_edicao`, `em_revisao` e `finalizado`.
- Ordem da migration ajustada: primeiro remove CHECK legado, depois migra `draft -> em_edicao`, evitando violação de constraint durante execução.
