# Análise 3 — Duplicação de rubricas derivadas

## Diagnóstico

Foi identificada inconsistência entre o PRD-03 e o PRD-09 no fluxo de duplicação da folha:

- o PRD-03 listava no modal de duplicação as opções “salário real”, “G2 complemento” e “salário líquido”;
- o PRD-09 define que valores derivados não devem ser tratados como base operacional.

Essa divergência criava risco de implementação da UI oferecendo seleção de campos que devem ser sempre recalculados pelo motor.

## Ajuste aplicado

- **PRD-03**: removidas as opções “salário real”, “G2 complemento” e “salário líquido” da lista de grupos de dados (checkbox) do modal de duplicação.
- **PRD-03**: adicionada regra explícita abaixo da lista informando que rubricas derivadas não devem ser apresentadas como opções de duplicação, pois são calculadas pelo motor (PRD-01) e não fazem parte da base operacional duplicável.
- **PRD-09**: reforçada a regra já existente com lista explícita das rubricas canônicas derivadas (`salario_real`, `g2_complemento`, `salario_liquido`) que não podem ser duplicadas como base e devem ser recalculadas após criação da nova folha.

## Resultado

A documentação ficou alinhada entre UI (PRD-03) e regra de negócio de duplicação (PRD-09):

- rubricas derivadas não aparecem mais como itens duplicáveis na Central;
- rubricas derivadas canônicas permanecem tratadas como resultado do motor, com recálculo obrigatório na nova folha.
