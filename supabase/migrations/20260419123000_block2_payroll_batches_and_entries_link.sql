-- Bloco 2 da fase 1 da Central de Folha:
-- cria a estrutura formal mínima de folha (payroll_batches) e o vínculo mínimo
-- com payroll_entries, mantendo compatibilidade com o modelo atual.
--
-- Importante: esta etapa NÃO implementa recálculo backend nem duplicação de folha.

-- 1) Cabeçalho formal da folha por empresa + competência.
-- Esta tabela representa a folha formal da empresa em determinado mês/ano,
-- como base mínima da fase 1. Status inicia simples em 'draft'.
create table if not exists public.payroll_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year integer not null check (year >= 2000),
  status text not null default 'draft' check (status in ('draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_batches_company_month_year_unique unique (company_id, month, year)
);

create index if not exists payroll_batches_company_month_year_idx
  on public.payroll_batches (company_id, month, year);

drop trigger if exists set_payroll_batches_updated_at on public.payroll_batches;
create trigger set_payroll_batches_updated_at
before update on public.payroll_batches
for each row execute function public.set_updated_at();

alter table public.payroll_batches enable row level security;

-- Reaproveita o modelo de permissão do bloco 1: operação de folha exige `folha.operar`.
drop policy if exists "payroll batches by folha.operar select" on public.payroll_batches;
drop policy if exists "payroll batches by folha.operar insert" on public.payroll_batches;
drop policy if exists "payroll batches by folha.operar update" on public.payroll_batches;
drop policy if exists "payroll batches by folha.operar delete" on public.payroll_batches;

create policy "payroll batches by folha.operar select"
  on public.payroll_batches for select
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll batches by folha.operar insert"
  on public.payroll_batches for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll batches by folha.operar update"
  on public.payroll_batches for update
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'))
  with check (public.has_permission(auth.uid(), 'folha.operar'));

create policy "payroll batches by folha.operar delete"
  on public.payroll_batches for delete
  to authenticated
  using (public.has_permission(auth.uid(), 'folha.operar'));

-- 2) Vínculo mínimo em payroll_entries sem remover colunas antigas.
-- Mantemos company_id/month/year nesta fase para transição segura e sem quebra brusca.
alter table public.payroll_entries
  add column if not exists payroll_batch_id uuid;

create index if not exists payroll_entries_payroll_batch_id_idx
  on public.payroll_entries (payroll_batch_id);

-- 3) Backfill conservador:
-- - cria batches a partir dos agrupamentos existentes (company_id, month, year)
-- - preenche payroll_batch_id por correspondência exata desses campos
-- Estratégia defensiva: ON CONFLICT evita duplicidade e não remove constraints legadas.
insert into public.payroll_batches (company_id, month, year, status)
select distinct pe.company_id, pe.month, pe.year, 'draft'
from public.payroll_entries pe
where pe.company_id is not null
on conflict (company_id, month, year) do nothing;

update public.payroll_entries pe
set payroll_batch_id = pb.id
from public.payroll_batches pb
where pe.company_id = pb.company_id
  and pe.month = pb.month
  and pe.year = pb.year
  and pe.payroll_batch_id is null;

-- FK adicionada após backfill para reduzir risco operacional na transição.
alter table public.payroll_entries
  drop constraint if exists payroll_entries_payroll_batch_id_fkey;

alter table public.payroll_entries
  add constraint payroll_entries_payroll_batch_id_fkey
  foreign key (payroll_batch_id)
  references public.payroll_batches(id)
  on delete restrict;
