# Análise 16 — Blindagem das rubricas canônicas na Central de Folha

## Objetivo da blindagem
Aplicar um hardening mínimo, seguro e rastreável na resolução de `salario_real`, `g2_complemento` e `salario_liquido`, garantindo consumo unificado entre drawer, tabela e totais, sem alterar motor de cálculo ou arquitetura.

## Diagnóstico do risco residual anterior
A versão anterior já tinha resolvedor compartilhado com fallback legado por nome, porém ainda faltava:
- diagnóstico estruturado (status por rubrica canônica);
- uso explícito dessa mesma resolução no drawer;
- sinalização administrativa discreta em caso de inconsistência cadastral.

## Confirmação sobre o drawer
- O drawer tinha lógica própria de priorização por `code` para ordenar resultados.
- Foi ajustado para consumir os IDs canônicos a partir do mesmo helper compartilhado (`resolveCanonicalDerivedRubricIds`), alinhando a origem da resolução com tabela e totais.
- Resultado: não há lógica paralela de identificação canônica entre os três pontos da Central.

## Estrutura de diagnóstico implementada
No helper compartilhado foi adicionada função de diagnóstico por rubrica canônica:
- `diagnoseCanonicalDerivedRubrics(...)`

Status possíveis por código canônico:
- `resolved_by_code`
- `resolved_by_legacy_name`
- `missing`
- `ambiguous_code`
- `ambiguous_name`

Também foi adicionado:
- `hasCanonicalRubricInconsistency(...)` para consumo simples na UI.

## Como a inconsistência cadastral passa a ser identificada
- Warnings em ambiente DEV foram mantidos e agora passam a ser alimentados pelo diagnóstico estruturado.
- Em caso de ambiguidade (`code`/`name`), o comportamento continua seguro: retorna `null` e não escolhe candidato arbitrário.
- No drawer, foi incluída sinalização discreta no bloco de resultados quando há inconsistência canônica (ex.: fallback legado ativo), sem poluir layout geral.

## O que foi preservado
- Sem refatoração de arquitetura.
- Sem alteração no motor de cálculo (`computeSpreadsheetEntry`).
- Sem migração/banco/painel novo.
- Sem mudança estrutural no layout da Central.
- Compatibilidade legada mantida como transitória.

## Riscos remanescentes
- Ambientes com cadastro legado continuarão exibindo sinalização até correção na origem do cadastro.
- Sem ação administrativa corretiva no cadastro, a dependência de fallback pode persistir.

## Recomendação futura (sem executar agora)
Adicionar validação administrativa no fluxo de manutenção de rubricas para bloquear ou sinalizar fortemente:
- ausência de códigos canônicos obrigatórios;
- duplicidade de código canônico;
- uso prolongado de fallback legado por nome.
