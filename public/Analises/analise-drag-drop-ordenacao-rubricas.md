# Análise — Drag-and-drop de ordenação de rubricas

## Diagnóstico da estrutura atual

1. **Tabela/campo da ordem**
   - A ordem operacional das rubricas é persistida na tabela `public.rubricas`, coluna `display_order` (mapeada no frontend para `rubric.order`).

2. **Constraint/validação de duplicidade de ordem**
   - No schema inicial de rubricas, `display_order` possui `NOT NULL` + `CHECK (display_order >= 0)`.
   - Não existe índice/constraint `UNIQUE` para `display_order` nas migrations atuais.
   - Na UI antiga, a própria tela aceitava ordem duplicada com desempate por `id` na ordenação.

3. **Onde `/rubricas` lista e ordena**
   - A listagem de rubricas vem do contexto (`usePayroll`) e na tela `/rubricas` era ordenada por `order` e depois por `id`.

4. **Onde o modal edita “Ordem de cálculo”**
   - O campo ficava na aba **Dados** do modal de criar/editar rubrica e era editável via `<Input type="number">`.

5. **Telas/funções que consomem a ordem**
   - Cadastro de rubricas: tabela em `/rubricas` usa `order` para ordenação visual.
   - Central de Folha: catálogo de rubricas carregado do backend ordenado por `display_order`.
   - Recibo e Relatórios: seguem as rubricas da folha sem recalcular (PRD-07/PRD-08), portanto refletem a ordem persistida da base.

6. **Padrão de drag-and-drop existente**
   - Não foi encontrado padrão já aplicado de drag-and-drop no projeto.

7. **Componente/hook/biblioteca reutilizável**
   - Não há biblioteca dedicada de DnD instalada (ex.: dnd-kit, react-beautiful-dnd).
   - Foi adotado DnD nativo do HTML para manter mudança mínima e sem trocar stack.

## Arquivos alterados

- `src/contexts/PayrollContext.tsx`
- `src/pages/Rubrics.tsx`

## Estratégia usada para evitar duplicidade e colisão

Implementada reordenação em **duas fases** no contexto:

1. Fase temporária: grava todos os itens com `display_order` alto (`100001+`), garantindo valores distintos sem colisão intermediária.
2. Fase final: grava sequência contínua `1..N` conforme posição final após o drop.

Essa abordagem evita persistência ingênua item a item na sequência final e mantém ordem contínua.

## Como funciona o drag-and-drop

- Foi adicionado handle visual com ícone discreto (`GripVertical`) na coluna de nome.
- O usuário arrasta pelo handle e solta sobre a linha de destino.
- Ao soltar:
  - a lista é reordenada;
  - o frontend chama `reorderRubrics([...ids])`;
  - o backend persiste sequência contínua `1..N`;
  - exibe toast de sucesso.
- Em erro:
  - a operação não confirma persistência;
  - exibe toast de erro com mensagem clara.

## Campo “Ordem de cálculo” no modal

- O campo foi mantido visível para compatibilidade e contexto do usuário.
- Agora está **somente leitura** (`disabled` + `readOnly`).
- Foi adicionada ajuda textual: “A ordem é definida pela posição da rubrica na listagem.”

## Testes executados

- `npm run test`
- `npm run build`

## Validação manual sugerida

1. Reordenar uma rubrica para cima e confirmar sequência contínua.
2. Reordenar uma rubrica para baixo e confirmar ausência de duplicidade.
3. Recarregar `/rubricas` e validar persistência.
4. Abrir modal e confirmar campo de ordem apenas leitura.
5. Validar Central/Recibo/Relatórios continuam consistentes na ordem visual.

## Confirmações de escopo

- Não houve alteração no motor de cálculo.
- Não houve alteração direta de regras de Recibo.
- Não houve alteração direta de regras de Relatórios.
- Não houve alteração de rubricas canônicas.
- A mudança ficou restrita ao fluxo de ordenação operacional de rubricas.

## Refinamento — proteção contra filtros ativos

### Risco identificado

Na implementação inicial, o `orderedRubricIds` era montado a partir de `sortedFilteredRubrics` (lista renderizada com filtros). Isso criava risco de reordenação parcial quando havia filtros ativos.

### Decisão aplicada

Para manter comportamento simples e previsível, a reordenação por drag-and-drop agora só é permitida sem filtros ativos.

### Como foi impedida a reordenação parcial

- A tabela continua filtrável para consulta.
- O drag handle fica desabilitado quando existe qualquer filtro ativo.
- A UI exibe orientação: **"Limpe os filtros para reordenar as rubricas."**
- A função de drop também bloqueia execução se `hasActiveFilters` for verdadeiro (defesa dupla).
- Quando permitido, o `orderedRubricIds` é montado da lista completa ordenada (`sortedAllRubrics`) e não da lista filtrada.

### Persistência em duas fases — risco residual e comportamento da UI

1. **Risco de falha parcial entre fases**: existe risco teórico se houver erro após parte da fase temporária/final (várias chamadas sequenciais ao backend).
2. **Comportamento em erro**: a UI mantém toast de erro claro e não aplica atualização local de estado quando a persistência falha.
3. **Restauração visual**: como o estado local só é atualizado após sucesso completo, a tabela permanece na ordem anterior no frontend em caso de falha.
4. **Mensagem ao usuário**: permanece `Não foi possível atualizar a ordem das rubricas.` com log técnico no console.

### Validação manual sugerida (foco filtros)

1. Sem filtro ativo: drag habilitado e persistência normal.
2. Com busca/filtro de status/tipo/método/classificação: drag desabilitado e mensagem para limpar filtros.
3. Após limpar filtros: drag habilitado novamente.

### Confirmação de escopo

- Sem alteração de cálculo da folha.
- Sem alteração funcional de recibos.
- Sem alteração funcional de relatórios.
