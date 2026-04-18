

## Diagnóstico honesto do estado atual

A análise do usuário está **parcialmente desatualizada**. Verifiquei o estado real:

| Item da análise | Status real |
|---|---|
| RLS permissiva em `rubricas` | ✅ Já corrigido (`has_permission('rubricas.manage')`) |
| `category`/`mode` em vez do PRD | ✅ Schema novo já existe (`nature`, `calculation_method`, `classification`) |
| Classificação não obrigatória | ✅ UI já bloqueia salvar sem classificação |
| Sem aba Classificação | ✅ 3 abas implementadas |
| Falta `valor_fixo`/`percentual` | ✅ Já implementado com campos dinâmicos |
| Importar/exportar simulado | ✅ Marcado "em desenvolvimento" + toast |
| Heurística por nome | ⚠️ **Ainda presente** como fallback em `EmployeeDrawer` |
| Inconsistência banco/types/frontend | ⚠️ Pequenos resíduos (campo `category` ainda gravado com fallback) |
| 16 rubricas legadas sem classificação | ⚠️ Existem (banco confirma), UI alerta mas não bloqueia uso |

**Conclusão:** o grosso do PRD-02 já está implementado. Falta uma "sprint de limpeza" pequena, não uma reestruturação. A migração do agrupamento da Central de Folha por `classification` é um item maior e deve ficar para outra sprint (depende de ter as 16 rubricas classificadas primeiro).

---

## Proposta: 1 sprint pequena de limpeza (Sprint 3 do plano original)

Mudança mínima, alto valor estrutural. Sem reescrever nada.

### 1. `EmployeeDrawer.tsx` — eliminar heurística por nome
- Como **todas** as 16 rubricas hoje já têm `nature` preenchido no banco, o fallback heurístico (linhas 75-78) é código morto que reforça anti-padrão.
- **Remover** o ramo heurístico. Manter apenas: `rubric.nature === "base"`. Se `nature` vier `null` (improvável), assume `false` (= não-base) — comportamento seguro.
- Comentário atualizado deixando claro: "PRD-02: nome da rubrica nunca define comportamento."

### 2. `PayrollContext.tsx` — limpeza no insert/update de rubrica
- Linha 277: parar de derivar `category` a partir de `classification || "geral"` (mascarava ausência). Gravar `category = classification ?? "indefinido"` apenas para satisfazer `NOT NULL` legado, com comentário claro de que é exclusivamente para compatibilidade da coluna antiga.
- Adicionar comentário de bloco no topo do mapeamento explicando: contrato canônico = `nature` + `calculation_method` + `classification`; `category` e `entry_mode` são **só** para compatibilidade da coluna até remoção em sprint futura.

### 3. `types/payroll.ts` — marcar legado como `@deprecated`
- Adicionar JSDoc `@deprecated` em `category` e `mode` no tipo `Rubric` para o TypeScript já avisar quem tentar consumir esses campos em código novo.

### 4. Aviso visual de classificação pendente em massa
- Tela `/rubricas` já tem KPI "Sem classificação". Adicionar **banner de aviso** no topo da página (só aparece se `kpis.semClassificacao > 0`) com texto curto: "X rubricas sem classificação técnica. Edite cada uma para definir antes da geração de recibos e relatórios."
- Sem bloqueio de uso (não há recibo/relatório ainda) — só visibilidade.

### 5. Comentários de segurança e PRD nos pontos certos
- Cabeçalho de `Rubrics.tsx`: bloco de comentário explicando regras críticas do PRD-02 (classificação obrigatória, nome ≠ comportamento, RLS por permissão).
- Topo de `mapRubricInsertToRow`: motivo de segurança e contrato.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/payroll/EmployeeDrawer.tsx` | remover fallback heurístico em `isBaseRubric`; comentário PRD-02 |
| `src/contexts/PayrollContext.tsx` | comentário de contrato; ajuste defensivo no `category` legado |
| `src/types/payroll.ts` | `@deprecated` em `category` e `mode` |
| `src/pages/Rubrics.tsx` | banner de aviso para classificação pendente; cabeçalho de regras PRD-02 |

---

## O que **NÃO** será feito agora (e por quê)

| Não fazer | Razão |
|---|---|
| Migrar agrupamento da Central de Folha para `classification` | Depende das 16 rubricas estarem classificadas primeiro; é mudança grande no `EmployeeDrawer.groupedRubrics`; risco alto sem ganho imediato |
| Remover colunas `category` / `entry_mode` do banco | Quebra dados legados de `payroll_entries` que ainda referenciam por código/nome |
| Implementar importar/exportar real | Fora do escopo do PRD-02; já marcado "em desenvolvimento" |
| Remover `getLegacyValue` em `EmployeeDrawer` | Necessário enquanto entries antigos existirem com chaves por código/nome |

---

## Resultado esperado

- Heurística por nome **eliminada** do fluxo ativo (só permanece `getLegacyValue` documentado).
- Contrato `Rubric` formalmente sinaliza campos legados como deprecated.
- Admin é avisado visualmente das rubricas pendentes de classificação.
- Comentários estruturais nos pontos críticos para evitar regressão.
- Zero impacto em fluxos atuais (criar/editar/folha continuam funcionando).

**Próxima sprint (futura, não agora):** classificar as 16 rubricas + migrar agrupamento da Central de Folha para `classification`.

