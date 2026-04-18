

## Diagnóstico: o que já existe vs. o que falta

| Item da análise | Estado atual | Ação |
|---|---|---|
| Badge "Derivada" na tabela | ✅ existe (linhas 961-965) | nada |
| Aba Classificação esconde para calculada | ✅ existe (linhas 729-738) | nada |
| Validação ciclo em fórmula | ✅ existe (`getCircularError`) | nada |
| Validação rubrica não depende de si mesma (fórmula) | ✅ existe (linha 277) | nada |
| Validação ciclo em **percentual** | ❌ falta | **adicionar** |
| Validação percentual ≠ própria rubrica | ⚠️ existe via filtro de UI, mas não no validateForm | **adicionar** validação explícita |
| Aviso visual ao abrir rubrica derivada (mensagem topo modal) | ❌ falta | **adicionar** |
| Label "Editar" muda para "Visualizar/Configuração" em derivadas | ❌ falta | **ajustar** |
| Bloquear alterar `nature` em rubrica existente | ❌ permite trocar | **bloquear** em modo edição |
| Aviso ao criar rubrica calculada | ❌ falta | **adicionar** |
| Ordem de cálculo duplicada | ❌ não valida | **avisar** (não bloquear — empate resolvido por id) |
| Referência a rubrica inativa (percentual/fórmula) | ❌ não filtra | **filtrar** itens inativos do combobox |
| Referência a derivada em fórmula/percentual | ❌ não filtra | **filtrar** derivadas (evita ambiguidade até motor existir) |

## Mudanças propostas (escopo: só `src/pages/Rubrics.tsx`)

### 1. Validação de ciclo no método **percentual**
Estender `getCircularError` para considerar percentual. Hoje retorna `null` quando método ≠ formula. Trocar por:
- Se `percentual` → tratar `percentageBaseRubricId` como única "dependência" no grafo da rubrica em edição.
- Se `formula` → comportamento atual.

### 2. Validações explícitas em `validateForm` para percentual
- `percentageBaseRubricId !== editing?.id` (defesa, mesmo com filtro de UI).
- Chamar `getCircularError` também para percentual.

### 3. Filtros nos comboboxes de referência (fórmula + percentual)
Criar `referenceableRubrics` derivado:
- exclui rubrica em edição
- exclui `isActive === false`
- exclui `nature === "calculada"` (ambiguidade até motor existir)

Aplicar nos 2 lugares (linhas 595 e 647). `emptyMessage` informa o motivo.

### 4. UX de rubrica derivada no modal
- **Header dinâmico**: se `editing && editing.nature === "calculada"` → título "Visualizar rubrica derivada"; senão mantém "Editar rubrica" / "Nova rubrica".
- **Banner topo do modal** (sempre que `form.nature === "calculada"`): caixa amarela neutra com texto: "Esta rubrica é gerada pelo sistema (saída do motor de cálculo) e não deve ser usada como entrada manual."
- **Label do dropdown**: trocar "Editar" → "Visualizar" quando `rubric.nature === "calculada"` (linha 999).

### 5. Bloquear alteração de `nature` em rubrica existente
Em modo edição (`editing !== null`), **desabilitar** o `Select` de Natureza com tooltip explicativo. Motivo: mudar natureza de uma rubrica já em uso quebra contrato (derivada vira input ou vice-versa). Para mudar, criar nova rubrica.

### 6. Aviso de ordem duplicada (não bloqueia)
Em `validateForm`, se `order` colide com outra rubrica ativa (`!== editing?.id`), mostrar **toast warning** mas permitir salvar. Listagem (linha 947) já ordena por `order`; adicionar tiebreak por `id` para determinismo: `.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))`.

### 7. Comentário PRD-02 atualizado no header

## O que NÃO será feito
- Mexer no banco (constraint de unicidade de ordem) — análise pede "mais simples"; aviso + tiebreak já resolve.
- Tocar Central de Folha, motor, recibos.
- Remover capacidade de criar derivadas (análise pede manter cadastro técnico).
- Remover filtro de classificação por tipo (já correto).

## Arquivo alterado
- `src/pages/Rubrics.tsx` — único arquivo. ~80 linhas alteradas, sem mudança estrutural.

## Resultado esperado
- Derivadas ficam visualmente e funcionalmente claras como "saída do sistema".
- Percentual herda mesma robustez de fórmula contra ciclos.
- Comboboxes de referência só oferecem rubricas seguras (ativas, não-derivadas, ≠ própria).
- Natureza imutável após criação evita corrupção de contrato.
- Ordem duplicada deixa de gerar ambiguidade silenciosa.
- CRUD existente continua funcionando.

