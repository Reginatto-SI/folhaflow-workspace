# Análise 4 — Blindagem técnica da duplicação de rubricas derivadas

## Diagnóstico

A regra de não duplicação de rubricas derivadas canônicas já estava documentada nos PRDs, mas a proteção técnica não estava centralizada no backend de duplicação.

Risco identificado:

- mesmo com UI correta, um payload inválido/origem contaminada poderia carregar valores derivados para a nova folha;
- isso poderia persistir `salario_real`, `g2_complemento` e `salario_liquido` como base, contrariando PRD-09 e PRD-12.

## Implementação

A blindagem foi implementada na camada de duplicação backend:

- nova função `public.duplicate_payroll_batch(...)` criada em migration;
- a função resolve os IDs das rubricas canônicas derivadas por código;
- antes de inserir entries da nova folha, remove esses IDs dos payloads `earnings` e `deductions`;
- qualquer valor derivado recebido é ignorado e não persistido;
- os totais da folha duplicada nascem zerados para recálculo posterior pelo motor.

Também foi adicionado teste unitário de proteção do filtro de payload para garantir o cenário de remoção de derivados.

## Garantia

A regra passa a ser garantida mesmo com input inválido:

- não depende da UI;
- não depende de fallback implícito;
- `salario_real`, `g2_complemento` e `salario_liquido` nunca entram como base duplicada;
- os valores só devem reaparecer após recálculo do motor.
