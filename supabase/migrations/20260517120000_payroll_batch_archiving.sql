-- Arquivamento lógico de folhas: preserva payroll_batches e payroll_entries.
-- O status operacional continua separado de arquivamento para evitar ambiguidade.

alter table public.payroll_batches
  add column if not exists is_archived boolean not null default false;

create index if not exists payroll_batches_company_archived_idx
  on public.payroll_batches (company_id, is_archived, year desc, month desc);
