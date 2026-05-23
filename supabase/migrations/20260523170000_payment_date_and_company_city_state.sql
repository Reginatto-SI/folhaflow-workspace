alter table public.companies
  add column if not exists city text,
  add column if not exists state text;

alter table public.payroll_batches
  add column if not exists payment_date date;
