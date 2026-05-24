# Análise completa — bug de piscada do drawer após marcar/desmarcar conferência

## 1) Resumo do problema

Na tela `/central-de-folha`, após marcar/desmarcar `conferido` em um lançamento e abrir rapidamente o drawer de outro funcionário, o drawer abre com piscadas/reidratações dos campos.

O comportamento observado é compatível com **múltiplas mudanças de referência do objeto `entry` recebido pelo `EmployeeDrawer`** durante janela curta de tempo (otimista + retorno do update + prévia do drawer), combinadas com efeitos internos que:

- reidratam formulário (`setRubricValues`, `setRubricQuantities`, `setNotes`);
- disparam `onPreviewChange` logo na abertura;
- recalculam a lista base da Central (`centralEntries`) que também alimenta o `selectedEntryForDrawer`.

Resultado prático: o drawer pode receber versões sucessivas do mesmo registro em poucos renders e executar hidratação/reprévia mais de uma vez no ciclo de abertura.

---

## 2) Fluxo completo de estado

## 2.1 Clique no botão de conferência (tabela)

1. `PayrollTable` chama `onToggleConferido(entry)` no clique do botão da coluna Conf. (com `stopPropagation`).
2. Em `Index`, `handleToggleConferido`:
   - lê estado atual via `optimisticConferidoByEntryId[entry.id] ?? entry.conferido`;
   - grava otimista em `optimisticConferidoByEntryId`;
   - marca lock em `updatingConferidoIds`;
   - chama `updatePayrollEntry(entry.id, { conferido: next })`.

## 2.2 Recomputações imediatas no Index (antes do backend responder)

Com a atualização otimista:

- `centralEntries` recalcula (porque depende de `optimisticConferidoByEntryId`);
- `filteredEntries` recalcula (depende de `centralEntries`);
- `pagedEntries` recalcula (via `usePagination(filteredEntries)`);
- `checkedCount` recalcula (depende de `centralEntries`);
- `selectedEntryForDrawer` recalcula (depende de `centralEntries` e `selectedEntry`).

Ou seja, há **rerender amplo da Central** mesmo sendo alteração operacional de 1 campo.

## 2.3 Retorno do `updatePayrollEntry`

No contexto:

1. `updatePayrollEntry` persiste no Supabase.
2. Recebe row atualizada e faz `setAllPayrollEntries(prev => prev.map(...))`.

Esse `map` gera novo array e troca o objeto da entrada alterada.

No Index:

- `payrollEntries` (derivado do contexto) muda referência;
- `centralEntries` recalcula de novo;
- `filteredEntries`, `pagedEntries`, `checkedCount`, `selectedEntryForDrawer` recalculam de novo;
- ao fim, `optimisticConferidoByEntryId` é limpo, disparando mais um ciclo.

**Conclusão do fluxo:** uma única marcação de conferência pode induzir vários ciclos de recomputação e troca de referências em cascata.

---

## 3) Abertura do drawer durante update pendente

Cenário crítico:

1. Usuário clicou em conferido no registro A (update pendente).
2. Usuário clica linha do registro B.
3. `handleRowClick` faz `setSelectedEntry(entryDaLinhaB)` e `setDrawerOpen(true)`.
4. `selectedEntryForDrawer` não usa diretamente esse snapshot; ele tenta buscar em `centralEntries` por `id` e retorna o objeto encontrado (ou fallback `selectedEntry`).

Como `centralEntries` está mudando durante o pendente (otimista/limpeza/retorno backend), o objeto de B pode trocar referência várias vezes mesmo sem alteração funcional de B.

Assim, o `EmployeeDrawer` pode receber sequência de props para `entry` no momento da abertura.

---

## 4) Papel do `livePreviewEntry`

`centralEntries` também é influenciado por `livePreviewEntry`:

- se `livePreviewEntry` existe, o item correspondente em `centralEntries` é substituído por `{ ...livePreviewEntry, conferido: entry.conferido }`.

No drawer:

- `useEffect` de preview chama `onPreviewChange` quando `open && !isCreateMode && entry`;
- ao abrir, isso acontece cedo (logo após hidratação inicial começar);
- `handlePreviewChange` em `Index` seta `livePreviewEntry`;
- isso recalcula `centralEntries` (agora com override do item em edição);
- isso recalcula `selectedEntryForDrawer`.

Mesmo sem loop infinito explícito, existe **ciclo de realimentação** entre Drawer → Preview → Lista Central → Entry do Drawer durante abertura.

---

## 5) Papel do `EmployeeDrawer` (efeitos e gatilhos)

## 5.1 Hidratação de formulário

Efeito principal de hidratação depende de:

- `open`
- `isCreateMode`
- `activeRubricsOrdered`
- `entryFormSeed`

Quando dispara e `open=true`, ele chama:

- `setRubricValues(...)`
- `setRubricQuantities(...)`
- `setNotes(...)`

Logo, qualquer variação de `entryFormSeed` ou `activeRubricsOrdered` durante abertura pode reidratar novamente.

## 5.2 `entryFormSeed`

Seed usa `JSON.stringify` de:

- `id`
- `notes`
- `earnings`
- `deductions`
- `rubricMeta`

Não inclui `conferido`, então toggle puro de conferido **não deveria** sozinho resetar formulário.

Porém, se o `entry` recebido alterna entre versões com diferenças nesses campos (ex.: versão base, versão com preview, versão retornada do backend), o seed muda e rehidrata.

## 5.3 Efeito de preview

Outro efeito chama `onPreviewChange({...entry, ...buildPayrollEntryDraft()})` com deps:

- `buildPayrollEntryDraft`
- `entry?.id`
- `entry?.conferido`
- `open`
- etc.

Ou seja, troca de `entry.conferido` no objeto recebido também pode disparar nova emissão de preview — apesar conferido não participar de cálculo.

---

## 6) Hipóteses avaliadas

## H1. `selectedEntryForDrawer` derivado de `centralEntries` troca referência várias vezes

**Status:** muito provável.

Porque `centralEntries` muda por:

- otimista de conferido;
- limpeza do otimista;
- retorno de `setAllPayrollEntries`;
- preview do drawer.

E `selectedEntryForDrawer` depende diretamente de `centralEntries`.

## H2. `centralEntries` mistura preview do drawer com conferido otimista

**Status:** muito provável e estrutural.

No mesmo array convivem:

- preocupação operacional (`conferido`);
- preocupação de edição/preview financeira (`livePreviewEntry`).

Essa mistura amplia superfície de rerender cruzado.

## H3. `onPreviewChange` cria ciclo de atualização na abertura

**Status:** provável.

Há um ciclo curto: Drawer abre → emite preview → Index atualiza `livePreviewEntry` → `centralEntries` muda → `selectedEntryForDrawer` pode mudar.

## H4. `EmployeeDrawer` hidrata mais de uma vez na abertura

**Status:** provável em cenários de mudança de seed/referência durante o open.

## H5. `activeRubricsOrdered` mudando e disparando rehidratação

**Status:** possível, mas menos provável como causa principal do bug descrito (cenário acionado por conferido).

## H6. `updatePayrollEntry` atualiza lista inteira e gera rerender em massa

**Status:** verdadeiro (comportamento existente), contribuinte relevante.

## H7. `handleRowClick` usa objeto da linha durante update pendente

**Status:** contribui.

O snapshot da linha entra em `selectedEntry`, mas depois é substituído por lookup dinâmico em `centralEntries` via `selectedEntryForDrawer`.

## H8. `entryFormSeed` muda por serialização/ordem

**Status:** possível em borda (objetos), mas não parece causa primária.

## H9. `livePreviewEntry` deveria ser isolado de conferido

**Status:** sim, forte candidato de mitigação.

---

## 7) Hipótese mais provável (causa raiz)

A causa mais provável é a **combinação** abaixo:

1. `selectedEntryForDrawer` é derivado de `centralEntries` (fonte altamente volátil durante toggle + preview);
2. `centralEntries` agrega no mesmo fluxo estados de natureza diferente (`conferido` otimista e `livePreviewEntry`);
3. `EmployeeDrawer` dispara `onPreviewChange` logo ao abrir, alimentando nova rodada de recomputação;
4. o contexto substitui objeto após persistência (`setAllPayrollEntries`), adicionando nova troca de referência.

Essa combinação produz jitter visual/reidratação intermitente, principalmente no timing “toggle e abrir outro em seguida”.

---

## 8) Evidências no código

- `centralEntries` mistura otimista de conferido + live preview.
- `selectedEntryForDrawer` busca em `centralEntries` por `id` a cada recomputação.
- `handleToggleConferido` faz 3 fases de estado local (set otimista, limpeza, lock) + chamada assíncrona.
- `updatePayrollEntry` no contexto faz `setAllPayrollEntries(map)` após retorno.
- `EmployeeDrawer` hidrata por `entryFormSeed`/`activeRubricsOrdered` quando `open`.
- `EmployeeDrawer` também chama `onPreviewChange` já no open, e depende de `entry?.conferido`.

---

## 9) Riscos de cada caminho de correção

## Opção A — manter `selectedEntry` estável para o drawer + `conferido` separado

**Benefício:** reduz troca de referência do objeto financeiro/editável do drawer.

**Risco:** baixo/médio (ajuste de contratos de props).

## Opção B — separar completamente estado de conferência do estado financeiro

**Benefício:** arquiteturalmente correto.

**Risco:** médio (pode tocar mais pontos que o necessário agora).

## Opção C — impedir `onPreviewChange` na abertura inicial até hidratar

**Benefício:** corta ciclo inicial de realimentação.

**Risco:** baixo se bem guardado por flag local (`hydratedRef`).

## Opção D — hidratar drawer 1 vez por `entry.id` e ignorar mudanças globais enquanto aberto

**Benefício:** elimina rehidratação repetida por ruído externo.

**Risco:** médio (pode esconder updates legítimos do mesmo registro se necessário).

## Opção E — abordagem mínima combinada

**Sugestão:** combinação A + C (e opcionalmente remover `entry?.conferido` das deps de preview).

**Risco:** baixo e localizada.

---

## 10) Recomendação de correção mínima mais segura

Sem refatoração ampla, a menor correção segura recomendada é:

1. **Estabilizar o objeto base do drawer por seleção** (snapshot por `entry.id` no clique da linha), evitando derivar `entry` diretamente de `centralEntries` durante abertura/edição.
2. **Passar `conferido` ao drawer em canal separado** (ou resolver apenas para botão), sem reescrever payload financeiro do `entry` no drawer.
3. **Gatilhar `onPreviewChange` somente após hidratação inicial concluída** para aquele `entry.id` (barreira simples de inicialização).
4. **Remover dependência de `entry?.conferido` no efeito de preview**, porque conferido não altera cálculo.

Isso atende as regras funcionais: conferido continua rápido/otimista e não interfere no conteúdo financeiro do drawer.

---

## 11) O que NÃO deve ser feito

- Não bloquear abertura do drawer durante salvamento de conferido (impacta operação).
- Não remover atualização otimista sem necessidade (piora UX).
- Não refatorar arquitetura da Central inteira.
- Não misturar novamente conferido com estado financeiro editável do drawer.
- Não acoplar cálculo/rubricas ao toggle operacional.

---

## 12) Checklist de validação manual

1. Abrir Central com múltiplos lançamentos.
2. Marcar conferido no registro A e imediatamente abrir drawer do B.
3. Confirmar ausência de piscada/reidratação visual.
4. Repetir cenário inverso (desmarcar A e abrir C).
5. Com drawer aberto em B, alternar conferido em A pela tabela (se possível no fluxo) e verificar estabilidade do drawer de B.
6. Editar rubrica em B e confirmar preview/totais continuam em tempo real.
7. Salvar B e validar persistência normal.
8. Conferir que recibo/relatórios não mudaram por causa de conferido.
9. Repetir com filtro “Conferidos/Pendentes” ativo.
10. Repetir com paginação (mudança de página) para garantir estabilidade.

---

## Conclusão executiva

O bug não parece estar no cálculo, mas no **acoplamento de estados de apresentação/preview/conferência** e na volatilidade de referência do `entry` do drawer durante updates assíncronos.

A correção mínima e mais segura é **estabilizar a fonte de dados do drawer e desacoplar conferido do objeto financeiro em edição**, além de impedir emissão de preview na fase de hidratação inicial.
