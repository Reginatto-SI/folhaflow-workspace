# 1. Resumo executivo

A Central de Folha já existe como seção interna montada no `Index.tsx` (não há rota dedicada `/central-folha`, conforme esperado), e o painel lateral de edição é o componente `EmployeeDrawer`.

O problema principal encontrado: **a tela de edição não está acoplada a uma estrutura relacional de itens por rubrica**. Hoje, os valores são persistidos em `payroll_entries` como dois JSONs (`earnings` e `deductions`) indexados por texto do nome da rubrica, sem chave por `rubrica_id`. Isso impede vínculo forte com cadastro oficial (ordem, histórico de renomeação, rastreabilidade por rubrica e aplicação por empresa).

Também há um gap importante de modelagem: a tabela `rubricas` está global (sem `company_id`) e o próprio texto da tela de Rubricas confirma isso. Portanto, o requisito funcional de rubrica dinâmica por empresa **não está plenamente suportado no banco atual**.

---

# 2. Onde a Central de Folha é montada hoje

## Componentes/arquivos
- Tela principal da Central: `src/pages/Index.tsx`
- Tabela/lista de funcionários e totais por linha: `src/components/payroll/PayrollTable.tsx`
- Painel lateral de edição (sheet à direita): `src/components/payroll/EmployeeDrawer.tsx`
- Barra de totais gerais da competência: `src/components/payroll/TotalsBar.tsx`
- Contexto de dados da folha e rubricas (queries Supabase): `src/contexts/PayrollContext.tsx`

## Fluxo de abertura do painel lateral
1. Usuário clica em uma linha da tabela (`PayrollTable` chama `onRowClick(entry)`).
2. Em `Index.tsx`, `handleRowClick` define `selectedEntry` e `drawerOpen=true`.
3. `Index.tsx` renderiza `<EmployeeDrawer open={drawerOpen} entry={selectedEntry} ... />`.
4. `EmployeeDrawer` abre como `SheetContent` lateral direita.

---

# 3. Como os campos atuais estão sendo renderizados

## Fonte dos campos no painel
No `EmployeeDrawer`:
- `Salário Base` é campo explícito (fixo) separado.
- Proventos: renderiza `Object.entries(earnings)`.
- Descontos: renderiza `Object.entries(deductions)`.

Ou seja, **não existe lista hardcoded de “Horas Extras / Bônus / VT / VR / INSS / IRRF” dentro do drawer**. Esses nomes vêm das chaves já presentes em `entry.earnings`/`entry.deductions`.

## Origem real desses `earnings`/`deductions`
Esses dados vêm da tabela `payroll_entries` (colunas JSONB), carregadas pelo `PayrollContext`:
- select de `base_salary, earnings, deductions, notes`
- mapping para `PayrollEntry` com `Record<string, number>`

Portanto:
- não é mock no fluxo atual principal;
- também não é itemização por rubrica relacional;
- é JSON por chave textual.

---

# 4. Situação atual das rúbricas no projeto

## Modelagem existente
Existe módulo de rubricas com persistência real:
- `public.rubricas`
- `public.rubrica_formula_items`

Campos relevantes de `rubricas`:
- `name`
- `code` (único global)
- `category`
- `type` (`provento`/`desconto`)
- `display_order`
- `is_active`
- `entry_mode`
- `allow_manual_override`

## Ordem/código/tipo/ativo
Tudo isso existe e é consumido no front de Rubricas e no contexto.

## Vínculo por empresa
**Não existe `company_id` em `rubricas`.**
A migration e a UI textual apontam rubricas globais compartilhadas.

Conclusão: requisito “rubricas dinâmicas por empresa” não está implementado no schema atual das rubricas.

---

# 5. Gap entre o cadastro de rúbricas e a Central de Folha

Gap objetivo:
1. Cadastro de rubricas é estruturado (inclusive fórmula e ordem), mas
2. Edição da folha não grava itens por `rubrica_id`; grava JSON por nome.

Consequências:
- mudança de nome/código da rubrica pode “quebrar” rastreabilidade histórica;
- não há garantia de ordem por `display_order` no lançamento salvo;
- não há integridade referencial entre item da folha e rubrica cadastrada;
- não há filtro de rubrica por empresa (porque rubrica não tem empresa);
- Central pode exibir chaves antigas de JSON mesmo que rubrica tenha sido inativada/renomeada.

---

# 6. Situação da persistência dos valores da folha

## Como grava hoje
Tabela `payroll_entries`:
- chave de negócio única por `company_id + month + year + employee_id`
- `base_salary` numérico
- `earnings` JSONB
- `deductions` JSONB
- `notes` texto

## Existe itemização por rubrica?
**Não existe** tabela `payroll_entry_items` (ou equivalente) com `rubrica_id`.

## Existe chave por funcionário + competência + rubrica?
**Não existe** no modelo atual.
Existe só por funcionário+competência na linha da folha (`payroll_entries`).

---

# 7. Situação da observação da folha

Existe sim: coluna `notes` em `payroll_entries`.

No front:
- `PayrollContext` mapeia `notes`;
- `EmployeeRowExpansion` já edita `entry.notes` via `updatePayrollEntry`.

No `EmployeeDrawer` atual, a observação **não está exposta**.
Logo, o conceito existe no banco e no contexto, mas não está integrado ao painel lateral de edição principal.

---

# 8. Estratégia recomendada de correção mínima

## Objetivo
Migrar da lateral “baseada em chaves JSON por nome” para “baseada em rubricas cadastradas” com menor risco.

## Etapas pequenas e seguras

1. **Ajuste de leitura/rendereização no drawer (sem migration inicial):**
   - montar lista visual a partir de `rubrics` ativas ordenadas por `display_order`;
   - separar por blocos (bases principais, proventos, descontos) por metadados de rubrica;
   - popular valor inicial de cada input lendo JSON atual por fallback (`rubrica.name`, e opcionalmente `rubrica.code` para transição).

2. **Padronizar chave de persistência no JSON para `rubrica.id` (fase de transição):**
   - ao salvar, gravar em `earnings/deductions` por id da rubrica (não por nome);
   - manter fallback de leitura por nome por um período para compatibilidade de dados legados.

3. **Incluir observação no drawer:**
   - reaproveitar `notes` já existente em `payroll_entries`;
   - salvar junto com valores.

4. **Só depois (se confirmado necessário): migration estrutural para itemização relacional:**
   - criar tabela de itens por rubrica (`payroll_entry_items`) com unique (`payroll_entry_id`, `rubrica_id`);
   - manter `payroll_entries` para cabeçalho e totais.

5. **Vínculo por empresa das rubricas (lacuna de produto/modelagem):**
   - opção A (mínima): `rubricas.company_id` nullable + estratégia de globais;
   - opção B: tabela de associação `company_rubricas`.

Sem resolver esse ponto, não há como cumprir 100% o requisito “rubricas por empresa”.

---

# 9. Impactos no front-end

Componentes impactados (sem reescrever arquitetura):
- `src/pages/Index.tsx`
  - garantir passagem correta de `rubrics` ao drawer e corrigir inconsistências de props identificadas.
- `src/components/payroll/EmployeeDrawer.tsx`
  - renderização por rubricas ordenadas;
  - layout em cards/grid (até 4 colunas);
  - bloco de resumo;
  - campo observação.
- `src/contexts/PayrollContext.tsx`
  - normalização de leitura/escrita dos valores por chave de rubrica (fase transicional).

Opcional de suporte:
- `src/components/payroll/PayrollTable.tsx` e `TotalsBar.tsx` podem continuar somando agregados sem mudança estrutural na fase 1.

---

# 10. Impactos no banco/modelagem

## O que já existe e pode ser reaproveitado
- `payroll_entries` cobre cabeçalho (empresa, competência, funcionário) e observação.
- `rubricas` já possui ordem/tipo/ativo e fórmula.

## O que falta para aderência total do requisito
1. **Rubrica por empresa:** atualmente ausente.
2. **Persistência itemizada por rubrica_id:** atualmente ausente.

## Migration: precisa ou não?
- **Correção mínima imediata de UX/dados:** pode começar sem migration (mudança de render + convenção de chave no JSON).
- **Correção robusta/definitiva:** exige migration para itemização por rubrica e modelagem de escopo por empresa.

---

# 11. Riscos e validações

## Riscos
- Regressão em dados legados salvos por nome de rubrica.
- Divergência de totais se coexistirem chaves antigas e novas.
- Quebra de compatibilidade ao inativar/renomear rubricas.
- Ambiguidade de rubricas com mesmo nome em cenários futuros multiempresa.

## Checklist de validação
- [ ] Abrir drawer em funcionário com dados legados e novos.
- [ ] Confirmar ordem de exibição por `display_order`.
- [ ] Confirmar separação visual por tipo (`provento`/`desconto`) e bloco superior.
- [ ] Validar cálculos de bruto/descontos/líquido após edição.
- [ ] Validar persistência e reabertura do mesmo lançamento.
- [ ] Validar observação por funcionário/competência.
- [ ] Validar filtros de empresa/competência na Central.
- [ ] Validar comportamento com rubrica inativa.

---

# 12. Recomendação final

**Conclusão técnica:** dá para iniciar com correção mínima de renderização + persistência transicional sem reescrever a tela inteira. Porém, a base atual ainda está **incompleta** para suportar integralmente a Central de Folha real no padrão solicitado, porque faltam:

1. escopo de rubricas por empresa no modelo;
2. itemização relacional por rubrica (`rubrica_id`) na persistência da folha.

Se o objetivo é decisão segura de produto/engenharia:
- curto prazo: corrigir UX e acoplamento com cadastro real de rubricas;
- médio prazo: concluir modelagem para empresa + itens por rubrica.

---

## Pontos de incerteza encontrados e que precisam confirmação

1. Em `Index.tsx`, o uso de props do drawer apresenta inconsistências (referências não definidas como `rubrics/handleCreate` no estado atual do arquivo). Isso sugere que o branch pode conter código parcialmente integrado; vale confirmar a versão em produção.
2. Não há, neste repositório, query de “rubricas por empresa”, reforçando que o requisito multiempresa para rubricas ainda não foi finalizado no backend.
