ALTER TABLE public.rubricas
  ADD COLUMN IF NOT EXISTS uses_complementary_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complementary_quantity_label text;

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS rubric_meta jsonb NOT NULL DEFAULT '{}'::jsonb;