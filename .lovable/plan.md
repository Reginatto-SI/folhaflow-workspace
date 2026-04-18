

## Plano: `/rubricas` — aderência ao PRD-02 + segurança real

### Diagnóstico

**Backend (RLS)**
- `rubricas` e `rubrica_formula_items`: policies abertas (`USING true`). Qualquer cliente lê e escreve sem permissão.

**Schema**
- Faltam colunas do PRD-02: `nature` (`base|calculada`), `calculation_method` (`manual|valor_fixo|percentual|formula`), `classification`, `fixed_value`, `percentage_value`, `percentage_base_rubrica_id`.
- `category` (texto livre) e `entry_mode` (`manual|formula`) cobrem só parcialmente o contrato.

**Tipos / UI / Context**
- `Rubric` usa `category` e `mode` (`manual|formula`) — não reflete PRD-02.
- Tela `/rubricas`: 2 abas (Dados/Fórmula); sem aba Classificação; sem `valor_fixo`/`percentual`; categoria como texto; importar/exportar simulados.
- `EmployeeDrawer` usa heurística por nome (`isBaseRubric`) e fallback `getLegacyValue` por código/nome — comentado como transitório, mantemos isolado.

**Dados existentes (16 rubricas)** — preciso definir mapeamento para `classification` (o texto da `category` atual mapeia razoavelmente: Salário→`salario_ctps`/`salario_g`, INSS→`inss`, Horas Extras→`horas_extras`, Adicionais→`ferias_terco`, Outros→catch-all manual). Como mapping automático é frágil e a regra do PRD é "classificação não depende do nome", **vou seedar `classification = NULL`** e exigir preenchimento na primeira edição. O frontend bloqueia salvar sem classificação; a coluna fica nullable com aviso visual ("Sem classificação") até admin corrigir cada rubrica. Critério da fase 10 do PRD: "definir classificação gradualmente".

---

### 1. Migração SQL

```sql
-- Enums canônicos
create type public.rubric_nature as enum ('base','calculada');
create type public.rubric_method as enum ('manual','valor_fixo','percentual','formula');
create type public.rubric_classification as enum (
  'salario_ctps','salario_g','outros_rendimentos','horas_extras',
  'salario_familia','ferias_terco','insalubridade',
  'inss','emprestimos','adiantamentos','vales','faltas'
);

-- Novas colunas (todas nullable nesta fase para não quebrar dados legados)
alter table public.rubricas
  add column nature public.rubric_nature,
  add column calculation_method public.rubric_method,
  add column classification public.rubric_classification,
  add column fixed_value numeric,
  add column percentage_value numeric,
  add column percentage_base_rubrica_id uuid references public.rubricas(id);

-- Backfill defensivo a partir do entry_mode legado
update public.rubricas set
  calculation_method = case entry_mode when 'formula' then 'formula' else 'manual' end,
  nature = case entry_mode when 'formula' then 'calculada' else 'base' end
where calculation_method is null;

-- Código único
create unique index if not exists rubricas_code_unique on public.rubricas (lower(code));

-- RLS real (substituir policies abertas)
drop policy rubricas_select_all on public.rubricas;
drop policy rubricas_insert_all on public.rubricas;
drop policy rubricas_update_all on public.rubricas;
drop policy rubricas_delete_all on public.rubricas;

create policy "rubricas view" on public.rubricas for select to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubricas insert" on public.rubricas for insert to authenticated
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubricas update" on public.rubricas for update to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'))
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
-- Sem DELETE policy → exclusão física bloqueada (alinhado ao padrão do projeto).

-- Mesmo padrão para itens de fórmula
drop policy rubrica_formula_items_select_all on public.rubrica_formula_items;
drop policy rubrica_formula_items_insert_all on public.rubrica_formula_items;
drop policy rubrica_formula_items_update_all on public.rubrica_formula_items;
drop policy rubrica_formula_items_delete_all on public.rubrica_formula_items;

create policy "rubrica items view" on public.rubrica_formula_items for select to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items insert" on public.rubrica_formula_items for insert to authenticated
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items update" on public.rubrica_formula_items for update to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'))
  with check (public.has_permission(auth.uid(), 'rubricas.manage'));
create policy "rubrica items delete" on public.rubrica_formula_items for delete to authenticated
  using (public.has_permission(auth.uid(), 'rubricas.manage'));
```

> Observação: rota `/rubricas` já está protegida por `rubricas.manage` no `App.tsx`. RLS apenas reforça no backend (não confiar só na UI).

---

### 2. Tipos (`src/types/payroll.ts`)

Estender `Rubric` mantendo campos legados com comentário de compatibilidade:
```ts
export type RubricNature = "base" | "calculada";
export type RubricMethod = "manual" | "valor_fixo" | "percentual" | "formula";
export type RubricClassification = /* enum literal acima */;

export interface Rubric {
  id: string;
  name: string;
  code: string;
  type: "provento" | "desconto";
  // PRD-02 — contrato canônico
  nature: RubricNature;
  calculationMethod: RubricMethod;
  classification: RubricClassification | null; // nullable só na transição; UI bloqueia salvar como null
  order: number;
  isActive: boolean;
  // Campos condicionais
  fixedValue?: number;
  percentageValue?: number;
  percentageBaseRubricId?: string | null;
  formulaItems: RubricFormulaItem[];
  // Compat temporária — não usar em lógica nova
  category?: string;
  mode?: "manual" | "formula"; // derivado de calculationMethod
  allowManualOverride: boolean;
}
```

---

### 3. Context (`src/contexts/PayrollContext.tsx`)

- `mapRubricRowToModel`: ler novos campos, derivar `mode` legado a partir de `calculation_method`.
- `mapRubricInsertToRow` / `mapRubricUpdateToRow`: gravar `nature`, `calculation_method`, `classification`, `fixed_value`, `percentage_value`, `percentage_base_rubrica_id`. Continuar gravando `entry_mode` (`manual` se método ≠ `formula`, senão `formula`) para compat até remover a coluna em fase futura.
- `validateRubricPayload`: exigir `classification`, validar campos por método (`valor_fixo`→`fixedValue>=0`; `percentual`→`percentageValue>0` + `percentageBaseRubricId`; `formula`→itens válidos). Manter validação de circularidade existente.

### 4. UI (`src/pages/Rubrics.tsx`)

Reaproveitando layout/tabela/KPIs/filtros existentes, **3 abas** no modal:

- **Dados**: Nome, Código, Tipo, Natureza (`base|calculada`), Ordem, Ativa.
- **Cálculo**: Método (`manual|valor_fixo|percentual|formula`) + campos dinâmicos:
  - `valor_fixo` → input "Valor base" (R$).
  - `percentual` → input "Percentual (%)" + combo "Rubrica de referência".
  - `formula` → composição existente (já implementada).
  - `manual` → sem campos extras.
  - Checkbox "Permitir edição manual na folha" disponível em `valor_fixo`/`percentual`/`formula`.
- **Classificação**: combobox **obrigatório** com enum filtrado pelo `tipo` selecionado + texto explicativo: "Define agrupamento em recibos e relatórios. Não depende do nome."

Tabela: substituir coluna "Categoria" por "Classificação" (badge); coluna "Modo" mostra método. Manter filtros de tipo/status; remover filtro `mode` legado e adicionar filtro por classificação.

Importar/exportar: marcar como **"em desenvolvimento"** (badge no botão + toast informativo). Não remover botão para preservar layout.

### 5. Compatibilidade transitória

- `EmployeeDrawer.isBaseRubric` (heurística por nome): manter, mas trocar prioridade para `rubric.nature === "base"` quando presente; cair na heurística só se `nature` for null. Comentário atualizado.
- `getLegacyValue`: mantido (lida com payloads antigos por código/nome). Isolado, comentado como compat.
- Não tocar agrupamento da Central de Folha além desse ajuste defensivo mínimo.

### 6. Mock (`src/data/mock.ts`)

Atualizar para incluir `nature`/`calculationMethod`/`classification` válidos (apenas para tipagem; mock não é usado em runtime em produção, mas mantém build TS verde).

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | enums, colunas, backfill, unique code, RLS por permissão |
| `src/types/payroll.ts` | contrato `Rubric` PRD-02 + flags compat |
| `src/contexts/PayrollContext.tsx` | mapeamentos, validações, derivação `mode` |
| `src/pages/Rubrics.tsx` | 3 abas, classificação obrigatória, métodos dinâmicos, badge "em desenvolvimento" import/export |
| `src/components/payroll/EmployeeDrawer.tsx` | usar `nature` quando disponível; heurística só como fallback |
| `src/data/mock.ts` | ajustar mock para novo contrato |

---

### Resultado

- RLS real: sem `rubricas.manage`, ninguém lê/escreve rubricas.
- Contrato PRD-02 vivo: `nature`, `calculation_method`, `classification`, campos condicionais.
- UI 3 abas + métodos dinâmicos + classificação obrigatória.
- Heurística por nome isolada e documentada como compat temporária.
- Código único garantido no banco.
- Importar/exportar deixa de "fingir" funcionalidade.

### Compatibilidade temporária (anotada no código)
- `category` / `entry_mode` continuam gravados em paralelo até motor/recibos migrarem para `classification` + `calculation_method`.
- `EmployeeDrawer.isBaseRubric` cai em heurística só quando `nature` ausente.
- `classification` nullable até admin classificar as 16 rubricas existentes — UI exige ao editar.

### Fora de escopo (próxima fase)
- Remover colunas legadas `category` e `entry_mode`.
- Reescrever motor/Central de Folha para agrupar por `classification`.
- Importação real de planilha de rubricas.

