# Análise 7 — Refinamento visual da Central de Folha

## O que foi melhorado

1. **Densidade visual da Central**
   - Redução de paddings e alturas em header, barra de totais, filtros e tabela.
   - Objetivo: reduzir rolagem e acelerar leitura operacional sem mudar comportamento.

2. **Drawer de edição mais próximo do legado**
   - Blocos de **Proventos** e **Descontos** com agrupamento visual mais explícito (fundo leve + borda suave).
   - Labels de desconto reforçados em vermelho, mantendo semântica visual esperada pelo usuário legado.

3. **Campos derivados com aparência readonly mais clara**
   - Campos derivados foram mantidos como readonly, mas com fundo mais escuro e contraste maior.
   - Objetivo: evidenciar que são resultados calculados, não entradas manuais.

4. **Linha crítica de resultados**
   - Substituição da prévia genérica por bloco compacto de resultados com destaque para:
     - Salário Real
     - G2 Complemento
     - Salário Líquido
   - Contraste e hierarquia reforçados para leitura imediata de valores finais.

5. **Tipografia e alinhamento**
   - Reforço de `font-medium`/`font-semibold` em valores monetários.
   - Ajustes finos de grid e espaçamento para reduzir desalinhamento entre colunas e campos.

6. **Botões**
   - Mantida a posição original.
   - Ajuste de altura/largura e espaçamento para sensação de ferramenta operacional mais compacta.

## Comparação antes/depois

### Antes
- Tela funcional, porém com espaçamento mais amplo que o necessário.
- Grupos de dados importantes menos evidentes visualmente.
- Campos derivados sem distinção forte de leitura.
- Resultado final com menor destaque em relação aos campos de entrada.

### Depois
- Leitura mais rápida por redução de “respiro vazio”.
- Proventos e descontos com agrupamento visual claro (padrão próximo ao legado).
- Derivados destacados como resultado readonly.
- Linha de resultado final compacta e mais hierárquica.

## Decisões visuais tomadas

- **Não houve redesign estrutural**: mesma organização funcional e mesmos fluxos.
- **Mudança mínima e segura**: somente ajustes de classe/estilo e hierarquia visual.
- **Sem alteração de cálculo**: todos os valores continuam vindo do mesmo fluxo já validado.

## Pontos que ainda podem evoluir

1. Padronizar tokens específicos de densidade operacional no design system (ex.: `compact-input`, `compact-section`).
2. Validar com usuários legados se há necessidade de microajuste adicional em contraste de labels de descontos.
3. Avaliar destaque condicional para líquido (positivo/negativo) mantendo acessibilidade.
