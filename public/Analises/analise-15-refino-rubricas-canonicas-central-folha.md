# Análise 15 — Refino da resolução de rubricas canônicas na Central de Folha

## Objetivo da análise
Refinar a correção anterior de sincronização entre drawer, tabela e totais, mantendo compatibilidade legada, mas reduzindo risco arquitetural do fallback por nome para rubricas canônicas.

## Causa do risco arquitetural atual
A versão anterior corrigiu o bug de zero na grade/totais ao aceitar fallback por nome (`name`) quando o `code` canônico não estava correto. Isso resolveu operação imediata, porém criou risco de normalizar uma heurística de nome como prática permanente.

Riscos identificados:
- mascarar erro de cadastro de `code` canônico;
- permitir ambiguidades silenciosas quando houver múltiplas rubricas com mesmo nome legado;
- reduzir rastreabilidade de inconsistências de configuração.

## Ajuste mínimo aplicado
1. Mantida resolução principal por `code` canônico (`salario_real`, `g2_complemento`, `salario_liquido`).
2. Mantido fallback por `name` apenas como compatibilidade legada explícita.
3. Adicionado warning controlado em ambiente de desenvolvimento para:
   - resolução por fallback legado;
   - ambiguidade por código canônico duplicado;
   - ambiguidade por nome legado.
4. Em caso de ambiguidade, comportamento seguro/determinístico: não escolhe candidato arbitrário e retorna `null` para aquela rubrica.
5. Tabela e totais seguem consumindo o mesmo resolvedor compartilhado, sem lógica paralela.

## O que foi preservado
- `computeSpreadsheetEntry(...)` e fluxo de cálculo central não foram alterados.
- Sem alteração de layout/UX da Central.
- Sem mudança de arquitetura.
- Sem mover cálculo para backend.
- Compatibilidade legada mantida.

## Riscos remanescentes
- Enquanto existirem cadastros legados com `code` incorreto, o sistema continuará dependendo de fallback por nome em alguns casos.
- Em produção, warning não aparece; por isso, correção cadastral continua recomendada para eliminar dependência de compatibilidade.

## Cenários validados
- `code` canônico correto: resolve por `code`.
- legado com `name` correto e `code` incorreto: resolve por fallback e emite warning (dev).
- sem rubrica canônica encontrada: retorna `null` sem inventar valor.
- ambiguidade de candidatos: retorna `null` para preservar previsibilidade.
- consistência de consumo: tabela e totais seguem o mesmo resolvedor.

## Recomendação futura (sem executar agora)
- Evoluir para validação administrativa de cadastro de rubricas que bloqueie ou sinalize de forma forte códigos canônicos ausentes/duplicados no fluxo de configuração, reduzindo gradualmente necessidade do fallback por nome.
