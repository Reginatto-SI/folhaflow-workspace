-- Bloco 1 da fase 1 da Central de Folha (PRD-03 + PRD-10):
-- aplicar segurança real no backend para evitar dependência exclusiva de bloqueio na UI.
-- Escopo mínimo desta tarefa: employees + payroll_entries.

-- =========================
-- employees
-- =========================
-- Motivação:
-- 1) Central de Folha consulta colaboradores para compor a grade operacional;
-- 2) tabela estava com policies permissivas (using true / with check true);
-- 3) PRD-10 exige validação no backend por permissão explícita.
--
-- Regra aplicada (mínima e compatível):
-- - SELECT: permitido para quem pode operar folha OU visualizar funcionários.
-- - INSERT/UPDATE/DELETE: restrito a quem pode visualizar funcionários
--   (mantém comportamento atual da tela de Funcionários sem abrir para usuários sem permissão).

drop policy if exists employees_select_all on public.employees;
drop policy if exists employees_insert_all on public.employees;
drop policy if exists employees_update_all on public.employees;
drop policy if exists employees_delete_all on public.employees;

drop policy if exists "employees select by permission" on public.employees;
drop policy if exists "employees insert by permission" on public.employees;
drop policy if exists "employees update by permission" on public.employees;
drop policy if exists "employees delete by permission" on public.employees;

create policy "employees select by permission"
  on public.employees for select
  to authenticated
  using (
    public.has_permission(auth.uid(), 'folha.operar')
    or public.has_permission(auth.uid(), 'funcionarios.view')
  );

create policy "employees insert by permission"
  on public.employees for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'funcionarios.view'));

create policy "employees update by permission"
  on public.employees for update
  to authenticated
  using (public.has_permission(auth.uid(), 'funcionarios.view'))
  with check (public.has_permission(auth.uid(), 'funcionarios.view'));

create policy "employees delete by permission"
  on public.employees for delete
  to authenticated
  using (public.has_permission(auth.uid(), 'funcionarios.view'));

-- =========================
-- payroll_entries
-- =========================
-- Motivação:
-- 1) payroll_entries é o dado operacional central da /central-de-folha;
-- 2) tabela estava totalmente aberta em RLS;
-- 3) bloco 1 exige que somente quem tenha `folha.operar` leia/escreva esses lançamentos.

drop policy if exists payroll_entries_select_all on public.payroll_entries;
drop policy if exists payroll_entries_insert_all on public.payroll_entries;
drop policy if exists payroll_entries_update_all on public.payroll_entries;
drop policy if exists payroll_entries_delete_all on public.payroll_entries;

drop policy if exists "payroll entries by folha.operar select" on public.payroll_entries;
drop policy if exists "payroll entries by folha.operar insert" on public.payroll_entries;
drop policy if exists "payroll entries by folha.operar update" on public.payroll_entries;
drop policy if exists "payroll entries by folha.operar delete" on public.payroll_entries;

create policy "payroll entries by folha.operar select"
  on public.payroll_entries for select
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll entries by folha.operar insert"
  on public.payroll_entries for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll entries by folha.operar update"
  on public.payroll_entries for update
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'))
  with check (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll entries by folha.operar delete"
  on public.payroll_entries for delete
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'));
