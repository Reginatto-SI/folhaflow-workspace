-- Enums canônicos do PRD-02
do $$ begin
  create type public.rubric_nature as enum ('base','calculada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rubric_method as enum ('manual','valor_fixo','percentual','formula');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rubric_classification as enum (
    'salario_ctps','salario_g','outros_rendimentos','horas_extras',
    'salario_familia','ferias_terco','insalubridade',
    'inss','emprestimos','adiantamentos','vales','faltas'
  );
exception when duplicate_object then null; end $$;

-- Novas colunas (nullable nesta fase para preservar dados legados)
alter table public.rubricas
  add column if not exists nature public.rubric_nature,
  add column if not exists calculation_method public.rubric_method,
  add column if not exists classification public.rubric_classification,
  add column if not exists fixed_value numeric,
  add column if not exists percentage_value numeric,
  add column if not exists percentage_base_rubrica_id uuid references public.rubricas(id);

-- Backfill defensivo a partir do entry_mode legado
update public.rubricas set
  calculation_method = case entry_mode when 'formula' then 'formula'::public.rubric_method else 'manual'::public.rubric_method end,
  nature = case entry_mode when 'formula' then 'calculada'::public.rubric_nature else 'base'::public.rubric_nature end
where calculation_method is null;

-- Código único (case-insensitive)
create unique index if not exists rubricas_code_unique on public.rubricas (lower(code));

-- RLS real para rubricas (substitui policies abertas)
drop policy if exists rubricas_select_all on public.rubricas;
drop policy if exists rubricas_insert_all on public.rubricas;
drop policy if exists rubricas_update_all on public.rubricas;
drop policy if exists rubricas_delete_all on public.rubricas;

create policy "rubricas view" on public.rubricas for select to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubricas insert" on public.rubricas for insert to authenticated
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubricas update" on public.rubricas for update to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'))
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
-- Sem DELETE policy → exclusão física bloqueada por padrão.

-- RLS real para itens de fórmula
drop policy if exists rubrica_formula_items_select_all on public.rubrica_formula_items;
drop policy if exists rubrica_formula_items_insert_all on public.rubrica_formula_items;
drop policy if exists rubrica_formula_items_update_all on public.rubrica_formula_items;
drop policy if exists rubrica_formula_items_delete_all on public.rubrica_formula_items;

create policy "rubrica items view" on public.rubrica_formula_items for select to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items insert" on public.rubrica_formula_items for insert to authenticated
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items update" on public.rubrica_formula_items for update to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'))
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items delete" on public.rubrica_formula_items for delete to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));