

## Sprint de saneamento final — `/rubricas`

### Estado real (lido no banco agora)

- **16 rubricas**, **0 com `classification`** preenchida. Todas têm `nature` + `calculation_method`.
- Nenhuma usa `valor_fixo` ou `percentual` hoje (só `manual` e `formula`).
- Validação no `PayrollContext` checa `classification !== undefined` mas **não bloqueia `null`** — gap real de persistência.
- RLS já restringe por `rubricas.manage`. UI já tem banner de pendência.

### Mapping proposto (revisão humana antes de aplicar)

Mapeamento por **evidência forte e direta**, ato único de saneamento (não vira código heurístico):

| Cód | Nome | Classificação proposta | Confiança |
|---|---|---|---|
| 1 | Salário CTPS | `salario_ctps` | alta |
| 2 | Salário G | `salario_g` | alta |
| 3 | Salário Fiscal | **pendente** | ambíguo (não está no catálogo) |
| 4 | (+) Outros Rendim. | `outros_rendimentos` | alta |
| 5 | (+) Horas Extras | `horas_extras` | alta |
| 6 | (+) 1/3 de férias | `ferias_terco` | alta |
| 7 | (+) Insalub. 20% | `insalubridade` | alta |
| 8 | (+) Salário Familia | `salario_familia` | alta |
| 9 | (-) INSS | `inss` | alta |
| 10 | (-) Emprést. Consig. | `emprestimos` | alta |
| 11 | (-) Adiant Geren. | `adiantamentos` | alta (mas **type=provento** — incoerente, ver §3) |
| 12 | (-) Vales/Descontos | `vales` | alta |
| 13 | (-) Faltas/Descontos | `faltas` | alta |
| 14 | Salário Real (fórmula) | **pendente** | derivada — sem slot canônico claro |
| 15 | Salário G2 complem. (fórmula) | **pendente** | derivada |
| 16 | Salário Líquido (fórmula) | **pendente** | derivada |

**Pendências reais (4):** 3, 14, 15, 16 — admin precisa decidir.

### Mudanças (mínimas, em 4 frentes)

#### 1. Migration de saneamento (data fix, sem schema)
- `UPDATE rubricas` setando `classification` para os 12 itens de mapping evidente acima.
- Os 4 ambíguos permanecem `NULL` → aparecem no banner como pendência real.
- **Correção de incoerência**: rubrica #11 "(-) Adiant Geren." está marcada como `type=provento` mas é claramente desconto. Trocar para `type='desconto'` no mesmo update.

#### 2. `PayrollContext.validateRubricPayload` — fechar o gap
- Trocar `if (rubric.classification !== undefined && !rubric.classification)` por checagem que bloqueia `null`/`undefined` em **insert** (`Omit<Rubric,"id">`) e em update quando `classification === null`.
- Adicionar bloqueio: se `isActive === true` (ou rubrica nova), `classification` é obrigatória. Se `isActive === false`, permite salvar sem classificação (rubrica inativa não entra em folha).
- Adicionar validação coerência tipo×classificação: `inss/emprestimos/adiantamentos/vales/faltas` só para `type=desconto`; demais só para `type=provento`. Erro claro se incoerente.
- Bloquear `nature`/`calculation_method` ausentes em insert (hoje aceita).

#### 3. Schema constraint de defesa em profundidade (opcional, baixo risco)
- Adicionar `CHECK` no banco: `is_active = false OR classification IS NOT NULL`. Garante que persistência rejeita rubrica ativa sem classificação mesmo via API direta.
- Adicionar `CHECK` de coerência tipo×classificação espelhando a validação do app.

#### 4. UI `Rubrics.tsx` — transparência reforçada
- Banner atual: melhorar texto para "X rubricas ativas sem classificação canônica. **Bloqueia evolução de Recibos e Relatórios.** Edite cada uma."
- Tabela: badge vermelha "Pendente" na coluna Classificação quando `null`.
- Manter aviso de "em desenvolvimento" em importar/exportar.

### O que NÃO será feito (e por quê)
- Migrar Central de Folha → fora de escopo, depende desta sprint primeiro.
- Recibos / Relatórios → não iniciar.
- Remover `category`/`entry_mode` → ainda referenciados por entries antigos via `getLegacyValue`.
- Mapeamento automático dos 4 ambíguos → admin precisa decidir, não inventar.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | UPDATE de 12 classifications + correção type da #11 + 2 CHECK constraints |
| `src/contexts/PayrollContext.tsx` | `validateRubricPayload` mais estrito (insert/update, coerência tipo×classificação, ativa exige classificação) |
| `src/pages/Rubrics.tsx` | banner reforçado + badge "Pendente" na coluna |

### Resumo final que será entregue após execução

1. **Saneadas:** 12 rubricas classificadas, 1 corrigida de tipo.
2. **Pendentes:** 4 rubricas (Salário Fiscal + 3 fórmulas de salário) — visíveis no banner, admin decide.
3. **Bloqueado a partir de agora:** insert/update de rubrica ativa sem `classification`, sem `nature`, sem `calculation_method`, ou com classificação incoerente com `type`. CHECK no banco como defesa em profundidade.
4. **Legado mantido (compat):** colunas `category`, `entry_mode`, `getLegacyValue` em `EmployeeDrawer`. Comentados.
5. **NÃO liberado ainda:** Central de Folha (depende dos 4 pendentes), Recibos, Relatórios.
6. **Critério final:** base **parcialmente pronta** — só estará 100% pronta quando admin classificar os 4 ambíguos restantes pela UI.

