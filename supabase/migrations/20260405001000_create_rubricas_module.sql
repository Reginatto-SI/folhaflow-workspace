-- Fase rubricas: persistência real para cadastro global e composição estruturada de fórmulas.
create table if not exists public.rubricas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  category text not null,
  type text not null check (type in ('provento', 'desconto')),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  entry_mode text not null check (entry_mode in ('manual', 'formula')),
  allow_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rubricas_code_unique unique (code)
);

create table if not exists public.rubrica_formula_items (
  id uuid primary key default gen_random_uuid(),
  rubrica_id uuid not null references public.rubricas(id) on delete cascade,
  operation text not null check (operation in ('add', 'subtract')),
  source_rubrica_id uuid not null references public.rubricas(id) on delete restrict,
  item_order integer not null check (item_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rubrica_formula_items_order_unique unique (rubrica_id, item_order),
  constraint rubrica_formula_items_no_self_reference check (rubrica_id <> source_rubrica_id)
);

create index if not exists rubricas_is_active_idx on public.rubricas (is_active);
create index if not exists rubricas_display_order_idx on public.rubricas (display_order);
create index if not exists rubrica_formula_items_rubrica_id_idx on public.rubrica_formula_items (rubrica_id);
create index if not exists rubrica_formula_items_source_rubrica_id_idx on public.rubrica_formula_items (source_rubrica_id);

drop trigger if exists set_rubricas_updated_at on public.rubricas;
create trigger set_rubricas_updated_at
before update on public.rubricas
for each row execute function public.set_updated_at();

drop trigger if exists set_rubrica_formula_items_updated_at on public.rubrica_formula_items;
create trigger set_rubrica_formula_items_updated_at
before update on public.rubrica_formula_items
for each row execute function public.set_updated_at();

alter table public.rubricas enable row level security;
alter table public.rubrica_formula_items enable row level security;

-- Comentário: as rubricas são globais do grupo e o projeto ainda opera com política permissiva.
drop policy if exists rubricas_select_all on public.rubricas;
create policy rubricas_select_all on public.rubricas for select using (true);

drop policy if exists rubricas_insert_all on public.rubricas;
create policy rubricas_insert_all on public.rubricas for insert with check (true);

drop policy if exists rubricas_update_all on public.rubricas;
create policy rubricas_update_all on public.rubricas for update using (true) with check (true);

drop policy if exists rubricas_delete_all on public.rubricas;
create policy rubricas_delete_all on public.rubricas for delete using (true);

drop policy if exists rubrica_formula_items_select_all on public.rubrica_formula_items;
create policy rubrica_formula_items_select_all on public.rubrica_formula_items for select using (true);

drop policy if exists rubrica_formula_items_insert_all on public.rubrica_formula_items;
create policy rubrica_formula_items_insert_all on public.rubrica_formula_items for insert with check (true);

drop policy if exists rubrica_formula_items_update_all on public.rubrica_formula_items;
create policy rubrica_formula_items_update_all on public.rubrica_formula_items for update using (true) with check (true);

drop policy if exists rubrica_formula_items_delete_all on public.rubrica_formula_items;
create policy rubrica_formula_items_delete_all on public.rubrica_formula_items for delete using (true);
