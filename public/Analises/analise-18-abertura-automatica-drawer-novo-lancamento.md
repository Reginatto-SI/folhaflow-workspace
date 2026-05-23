# Análise 18 — Abertura automática do drawer após novo lançamento

## Diagnóstico
- **Sintoma:** ao salvar "Novo lançamento" na `/central-de-folha`, o registro era criado, porém o drawer não era aberto automaticamente.
- **Onde ocorre:** fluxo `handleCreatePayrollEntry` em `src/pages/Index.tsx`.
- **Evidência de código:** a rotina anterior encerrava em `setNewEntryOpen(false)` + `setNewEmployeeId("")`, sem definir `selectedEntry` nem `drawerOpen`.
- **Causa provável:** o `addPayrollEntry` no contexto retornava `Promise<void>`, então a tela não tinha referência explícita do lançamento recém-criado para selecionar e abrir no drawer com segurança por `id`.

## Arquivos alterados
- `src/contexts/PayrollContext.tsx`
- `src/pages/Index.tsx`
- `public/Analises/analise-18-abertura-automatica-drawer-novo-lancamento.md`

## Regra aplicada
- Reutilizado o drawer existente (`EmployeeDrawer`) e os mesmos estados operacionais (`selectedEntry`, `drawerOpen`, `drawerMode`).
- Sem novo modal, sem novo drawer, sem duplicação de componente.
- Mantida a proteção contra duplicidade (tratamento de erro de chave única/duplicate já existente no fluxo).
- Não houve alteração de cálculo, backend de cálculo, recibos, relatórios, duplicação de folha ou layout geral.

## Testes realizados
1. Criar lançamento com funcionário disponível:
   - Abrir modal "Novo lançamento".
   - Selecionar funcionário ativo disponível.
   - Salvar lançamento.
2. Confirmar abertura automática do drawer:
   - Verificar fechamento do modal.
   - Verificar limpeza da seleção do modal.
   - Verificar drawer aberto no lançamento recém-criado.
3. Cancelar criação:
   - Abrir modal e clicar em "Cancelar".
   - Confirmar que o drawer não é aberto.
4. Tentar criar quando todos já possuem lançamento:
   - Confirmar combobox bloqueado e mensagem informativa mantida.
5. Abrir manualmente lançamento existente pela tabela:
   - Clicar em linha existente e confirmar comportamento original do drawer.

## Riscos observados
- **Baixo:** mudança de contrato de `addPayrollEntry` (`Promise<void>` para `Promise<PayrollEntry>`) pode impactar chamadas futuras que assumam `void`; chamadas atuais permanecem compatíveis.
- **Baixo:** abertura automática depende do retorno do insert no Supabase; como já usamos `.select(...).single()`, o risco funcional é mínimo.
