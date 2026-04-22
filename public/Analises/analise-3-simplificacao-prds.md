# Análise 3 — Simplificação dos PRDs

## Diagnóstico

Os PRDs anteriores tinham excesso de detalhamento, duplicações e regras conflitantes para um sistema que deve operar como planilha de Excel com cálculo imediato.

Problemas identificados:
- complexidade acima da necessidade operacional;
- presença de fluxos manuais de cálculo;
- descrições com múltiplas etapas desnecessárias;
- ambiguidade sobre responsabilidade de cálculo;
- inconsistência entre módulos.

## Ação executada

Foi aplicada simplificação completa em todos os arquivos de `public/PRD`, mantendo apenas regras essenciais do modelo operacional real:
- frontend calcula em tempo real;
- backend apenas persiste;
- comportamento previsível;
- sem recálculo manual;
- sem regras que não existiriam em planilha operacional.

Também foi criado o PRD base obrigatório:
- `PRD-00B — Modelo Operacional Simplificado`.

## Ajustes obrigatórios confirmados

- PRD-01: cálculo apenas no frontend, imediato ao digitar, fórmulas com soma/subtração.
- PRD-03: removido botão/fluxo de recalcular; edição direta com atualização automática.
- PRD-02: regras de rubricas simplificadas para cálculo simples.
- PRD-09: duplicação direta de estrutura e valores básicos, sem estratégias A/B.
- PRD-08: relatórios apenas refletem a folha, sem lógica adicional.
- PRD-10: permissões simplificadas por tela.

## Resultado

Os PRDs agora estão:
- curtos;
- diretos;
- consistentes entre si;
- alinhados ao comportamento real do Folha App (estilo Excel operacional).
