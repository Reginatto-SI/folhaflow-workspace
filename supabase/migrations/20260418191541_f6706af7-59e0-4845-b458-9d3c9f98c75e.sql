-- PRD-02 — defesa em profundidade.

-- Estas valem imediatamente para todas as linhas (todas atendem):
ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_active_requires_nature
  CHECK (is_active = false OR nature IS NOT NULL);

ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_active_requires_method
  CHECK (is_active = false OR calculation_method IS NOT NULL);

ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_type_classification_coherence
  CHECK (
    classification IS NULL
    OR (
      classification IN ('inss','emprestimos','adiantamentos','vales','faltas')
      AND type = 'desconto'
    )
    OR (
      classification IN ('salario_ctps','salario_g','outros_rendimentos','horas_extras','salario_familia','ferias_terco','insalubridade')
      AND type = 'provento'
    )
  );

-- Classificação obrigatória para rubricas ativas: NOT VALID para preservar 4 itens
-- legados pendentes (Salário Fiscal e 3 fórmulas) até o admin classificá-los pela UI.
-- A constraint vale para qualquer INSERT/UPDATE a partir de agora.
ALTER TABLE public.rubricas
  ADD CONSTRAINT rubricas_active_requires_classification
  CHECK (is_active = false OR classification IS NOT NULL)
  NOT VALID;