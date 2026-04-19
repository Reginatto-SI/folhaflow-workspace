# Análise 17 — Refino da mensagem de diagnóstico das rubricas canônicas no drawer

## Objetivo do microrefino
Melhorar a comunicação de inconsistência no drawer da Central de Folha usando o diagnóstico estruturado já existente, sem alterar arquitetura, cálculo ou fluxo operacional.

## Limitação da mensagem anterior
A mensagem antiga era única e genérica (“compatibilidade legada ativa”), mas o diagnóstico já suportava múltiplos cenários diferentes (legado, ausência e ambiguidade).

## Regra adotada para comunicação por cenário
A mensagem agora é derivada dos status do diagnóstico canônico:

- **Apenas fallback legado (`resolved_by_legacy_name`)**:
  - "Rubricas canônicas em compatibilidade legada. Revise o cadastro."
- **Ausência (`missing`)**:
  - "Rubricas canônicas obrigatórias não foram encontradas. Revise o cadastro."
- **Conflito (`ambiguous_code` ou `ambiguous_name`)**:
  - "Há conflito no cadastro das rubricas canônicas. Revise o cadastro."
- **Combinação de estados distintos**:
  - "Há inconsistências no cadastro das rubricas canônicas. Revise o cadastro."

## O que foi preservado
- Sem mudança no motor de cálculo.
- Sem alteração no helper estrutural de resolução.
- Sem mudança de layout geral da Central.
- Mensagem continua curta e discreta no bloco de resultados.
- Correção continua orientada à origem (cadastro de rubricas), sem expor detalhes técnicos ao usuário final.

## Riscos remanescentes
- A mensagem mais precisa melhora orientação, mas não corrige o cadastro automaticamente.
- Ambientes legados continuarão exigindo revisão administrativa até normalização dos códigos canônicos.
