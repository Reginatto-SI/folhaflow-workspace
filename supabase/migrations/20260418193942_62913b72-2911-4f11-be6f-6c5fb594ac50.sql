-- PRD-02: rubricas calculadas (derivadas) não recebem classificação técnica.
-- Elas são OUTPUT do motor de cálculo, não inputs operacionais.

-- 1. Substitui CHECK que exigia classificação para qualquer ativa.
--    Agora: ativa SEM classificação só é permitida se for calculada.
ALTER TABLE public.rubricas
  DROP CONSTRAINT IF EXISTS rubricas_active_requires_classification;

ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_active_base_requires_classification
  CHECK (
    is_active = false
    OR nature = 'calculada'
    OR classification IS NOT NULL
  ) NOT VALID;

-- 2. Nova regra: calculada NUNCA pode ter classificação (defesa em profundidade).
ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_calculada_no_classification
  CHECK (
    nature IS DISTINCT FROM 'calculada'
    OR classification IS NULL
  );