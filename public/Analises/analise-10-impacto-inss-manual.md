# 1. Resumo executivo

A regra oficial dos PRDs foi atualizada para **INSS manual**, mas o sistema ainda mantém um fluxo híbrido com comportamento legado de **INSS calculado automaticamente** no backend. O principal desvio está no RPC `recalculate_payroll_batch`, que calcula `inss_amount` por percentual fixo e regrava líquido em toda execução. Como a Central dispara esse recálculo com frequência (inclusive após salvar), o risco funcional é alto: o valor manual informado no lançamento pode divergir do valor final exibido, e o INSS pode ser descontado duas vezes no líquido.

Conclusão objetiva: o modelo de rubricas já suporta INSS manual como rubrica operacional, porém o motor transitório e a semântica de exibição da Central ainda preservam a lógica antiga de “encargo calculado”.

---

# 2. Regra oficial validada

Com base nos PRDs revisados (`PRD-01` e `PRD-02`):

- INSS é rubrica **operacional**;
- INSS é do tipo **desconto**;
- INSS tem natureza **base**;
- INSS deve ser informado de forma **manual**;
- motor **não calcula** INSS automaticamente;
- motor **não sobrescreve** INSS manual;
- recibos e relatórios devem refletir o valor persistido na folha;
- classificação `inss` é eixo de agregação (não o nome da rubrica).

---

# 3. Pontos já aderentes

1. **Catálogo de classificação contempla `inss` como desconto**.
   - Front e banco têm coerência tipo/classificação para descontos.

2. **Regra “derivada não recebe classificação” está implementada**.
   - Validações em frontend + constraints no banco impedem classificação em rubrica `nature = calculada`.

3. **Cadastro de rubricas permite INSS manual operacional**.
   - É possível cadastrar rubrica `type=desconto`, `nature=base`, `calculationMethod=manual`, `classification=inss`.

4. **Drawer permite editar descontos manualmente**.
   - O lançamento de descontos é persistido em `deductions` por `rubric.id`, preservando rastreabilidade.

5. **Recibos, relatórios e duplicação ainda não estão implementados no runtime atual**.
   - Na UI atual, botões estão desabilitados e marcados como “sprint futura”, então não há recalculador paralelo nesses módulos neste momento.

---

# 4. Pontos incompatíveis encontrados

## 4.1 Cálculo automático de INSS ativo no backend
- **Descrição objetiva**: o RPC de recálculo calcula `inss_amount` por regra fixa (8% da base fiscal).
- **Arquivo(s)**:
  - `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql`
  - `supabase/migrations/20260419140000_block3_backend_recalculation_minimal.sql` (versão anterior com mesmo padrão)
- **Função/serviço**: `public.recalculate_payroll_batch`.
- **Impacto real**: viola regra oficial de INSS manual; gera valor derivado independente do lançamento operacional.
- **Severidade**: **Alta (crítica funcional)**.
- **PRD violado**: PRD-01 §5 (regra crítica INSS), PRD-02 §4.3.

## 4.2 Sobrescrita de INSS no recálculo
- **Descrição objetiva**: toda execução do recálculo faz `update ... set inss_amount = ...`.
- **Arquivo(s)**:
  - `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql`
- **Função/serviço**: `public.recalculate_payroll_batch`.
- **Impacto real**: qualquer valor manual persistido para INSS não é a referência final para o campo exibido como INSS backend.
- **Severidade**: **Alta**.
- **PRD violado**: PRD-01 (motor não pode sobrescrever valor manual).

## 4.3 Possível dupla incidência no líquido
- **Descrição objetiva**: `deductions_total` soma todo JSON de descontos; `net_salary` ainda subtrai `inss_amount` adicionalmente.
- **Arquivo(s)**:
  - `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql`
- **Função/serviço**: `public.recalculate_payroll_batch`.
- **Impacto real**: se INSS manual estiver em `deductions`, o líquido pode descontar INSS duas vezes.
- **Severidade**: **Alta**.
- **PRD violado**: PRD-01 §6 Etapa 2 + Etapa 4 (descontos operacionais consolidados sem recomputação paralela de INSS).

## 4.4 Central reforça semântica de INSS calculado
- **Descrição objetiva**: o drawer exibe bloco “Valores calculados (backend)” com campo “INSS” oriundo de `entry.inssAmount`.
- **Arquivo(s)**:
  - `src/components/payroll/EmployeeDrawer.tsx`
- **Componente**: `EmployeeDrawer`.
- **Impacto real**: comunica ao usuário que INSS pertence ao output calculado, não ao input manual.
- **Severidade**: **Média/Alta** (risco de operação equivocada).
- **PRD violado**: PRD-01 §5 e PRD-03 (coerência da central com motor/regra vigente).

## 4.5 Recalculo é disparado automaticamente após salvar/criar lançamento
- **Descrição objetiva**: após `updatePayrollEntry` e após `addPayrollEntry`, a UI chama `recalculatePayrollBatch()` automaticamente.
- **Arquivo(s)**:
  - `src/pages/Index.tsx`
- **Componente/fluxo**: `Index` (`handleSave`, `handleCreatePayrollEntry`).
- **Impacto real**: acelera propagação do cálculo automático de INSS, mesmo sem ação explícita de revisão gerencial.
- **Severidade**: **Média**.
- **PRD violado**: indiretamente PRD-01 §5 (porque recálculo atual ainda calcula INSS).

## 4.6 Cadastro não força “INSS = manual” de forma específica
- **Descrição objetiva**: embora permita cenário correto, o contrato não impõe regra específica para `classification=inss` exigir `nature=base` e `calculationMethod=manual`.
- **Arquivo(s)**:
  - `src/contexts/PayrollContext.tsx`
  - `supabase/migrations/20260418191541_f6706af7-59e0-4845-b458-9d3c9f98c75e.sql`
  - `src/pages/Rubrics.tsx`
- **Função/serviço**: `validateRubricPayload` + constraints de coerência tipo/classificação.
- **Impacto real**: risco de configuração inconsistente de INSS no cadastro (ex.: INSS base com método não manual).
- **Severidade**: **Média**.
- **PRD violado**: PRD-02 §4.3 (método manual obrigatório para INSS).

## 4.7 Mock de dados mantém INSS inconsistente (não runtime principal)
- **Descrição objetiva**: em `mockRubrics`, INSS está `nature="calculada"` com `classification="inss"`.
- **Arquivo(s)**:
  - `src/data/mock.ts`
- **Impacto real**: não afeta produção (fonte principal é Supabase), mas pode induzir testes/entendimento incorreto.
- **Severidade**: **Baixa**.
- **PRD violado**: PRD-02 §4.3 / §5.1.

---

# 5. Fluxos analisados

## 5.1 Motor (backend/RPC)
- Existe cálculo automático de INSS ativo em `recalculate_payroll_batch`.
- O recálculo atual persiste `inss_amount` derivado e recalcula líquido com este campo.
- Há sobrescrita sistemática do campo derivado em toda execução.

## 5.2 Rubricas
- Estrutura de classificação e natureza está madura e aderente para separar input/output.
- `inss` está no catálogo de descontos.
- Gap: falta regra explícita “se classificação=inss então método manual + natureza base”.

## 5.3 Central
- Drawer permite lançamento manual de descontos (incluindo INSS via rubrica base).
- Porém exibe INSS backend como “calculado”, reforçando semântica antiga.
- Save/create disparam recálculo backend imediatamente.

## 5.4 Recibos
- Fluxo de recibo não implementado no runtime (botão desabilitado no drawer).
- Não foi encontrado código de geração de recibo ativo para validar consumo de INSS manual.

## 5.5 Relatórios
- Fluxo de relatórios não implementado no runtime (botão desabilitado no header).
- Não foi encontrado código de consolidação analítica/consolidada ativo para validar agrupamento real de `inss`.

## 5.6 Duplicação
- Não há implementação funcional identificada (apenas PRD e comentários de escopo).
- Não foi encontrado serviço/edge function/RPC de duplicação para verificar tratamento de INSS na prática.

---

# 6. Riscos de corrigir parcialmente

## Se corrigir só UI (Central)
- O backend continuará calculando/sobrescrevendo `inss_amount`.
- Tabela e totais podem continuar divergindo do lançamento manual esperado.
- Persistirá risco de dupla incidência no líquido.

## Se corrigir só backend
- A UI continuará comunicando “INSS calculado” no drawer/indicadores.
- Operação pode interpretar incorretamente a origem do valor.
- Sem ajuste de semântica visual, ainda haverá suporte operacional confuso.

## Se corrigir só Rubricas
- Mesmo com cadastro perfeito, o recálculo continuará criando INSS derivado.
- Regra de negócio seguirá quebrada no fechamento da folha.

---

# 7. Ordem mínima recomendada de correção

1. **Backend primeiro (obrigatório)**
   - Eliminar cálculo automático de `inss_amount` no RPC.
   - Garantir que líquido use apenas a consolidação de descontos operacionais persistidos.

2. **Central em seguida (coerência semântica)**
   - Ajustar labels/blocos que ainda tratam INSS como calculado.
   - Garantir que visualização mostre INSS da folha manual persistida.

3. **Reforço de contrato em Rubricas (defesa em profundidade)**
   - Adicionar validação específica para `classification=inss` exigir `nature=base` + `calculationMethod=manual`.

4. **Somente depois ativar/ajustar módulos dependentes**
   - Recibos, relatórios e duplicação devem nascer já consumindo INSS manual como fonte única.

---

# 8. O que NÃO deve ser alterado

- Estrutura canônica de classificação já implementada (catálogo `inss` incluso).
- Separação conceitual entre rubricas base e derivadas.
- Persistência por `rubric.id` nos payloads de `earnings`/`deductions`.
- RLS/permissões já existentes para operação de folha e gestão de rubricas.
- Estratégia de “UI não recalcula localmente” (manter backend como fonte de verdade, após ajustar regra de INSS nele).

---

# 9. Dúvidas remanescentes

1. O campo `inss_amount` deve:
   - ser removido do modelo transitório, ou
   - continuar existindo apenas como espelho do valor manual agregado por classificação `inss`?

2. Na composição de `deductions`, o padrão final será:
   - sempre por `rubric.id` (atual), ou
   - também por chave de classificação agregada para consumo de recibos/relatórios?

3. Na duplicação futura, INSS deve vir:
   - desmarcado por padrão (mais conservador), ou
   - marcado quando a origem for manual recorrente validada pelo usuário?

---

# 10. Checklist final

- [x] motor analisado
- [x] central analisada
- [x] recibos analisados (estado atual: não implementado)
- [x] relatórios analisados (estado atual: não implementado)
- [x] duplicação analisada (estado atual: não implementado)
- [x] aderência aos PRDs validada

---

## Respostas objetivas às 10 perguntas obrigatórias

1. **Existe cálculo automático de INSS ainda ativo no backend?**
   - **Sim**.

2. **Existe sobrescrita de INSS durante recálculo?**
   - **Sim** (`inss_amount` é regravado no RPC).

3. **O modelo de rubricas atual já suporta INSS manual corretamente?**
   - **Parcialmente sim** (suporta), mas **sem trava específica obrigatória** para `classification=inss` ser manual/base.

4. **A Central de Folha ainda comunica INSS como valor calculado?**
   - **Sim** (bloco “Valores calculados (backend)” com campo INSS).

5. **O recibo usa o valor manual da folha ou algum valor derivado/legado?**
   - **Indeterminado no runtime atual** (módulo ainda não implementado).

6. **Os relatórios usam a classificação `inss` corretamente?**
   - **Indeterminado no runtime atual** (módulo ainda não implementado).

7. **A duplicação trata INSS de forma coerente com a nova regra?**
   - **Indeterminado no runtime atual** (fluxo não implementado).

8. **Quais pontos precisam de correção obrigatória?**
   - RPC de recálculo (cálculo/sobrescrita de INSS), semântica da Central sobre INSS calculado, trava específica no cadastro para INSS manual.

9. **Quais pontos estão corretos e não devem ser mexidos?**
   - Catálogo/classificação, separação base vs derivada, gravação por `rubric.id`, RLS/permissões e princípio backend-first.

10. **Qual é a menor sequência segura de implementação depois desta análise?**
   - Backend (RPC) → Central (semântica/exibição) → Rubricas (trava INSS manual) → módulos futuros (recibos/relatórios/duplicação).
