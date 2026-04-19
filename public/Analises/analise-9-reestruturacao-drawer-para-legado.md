# Análise 9 — Reestruturação do drawer para o padrão visual do legado

## O que foi removido

- Removido o bloco técnico **"Campos derivados (readonly)"** do drawer.
- Removidas renderizações intermediárias que geravam seções redundantes/vazias para **Proventos** e **Descontos**.
- Removida a separação visual de **Rubricas-base** como card próprio, para evitar quebra da leitura operacional do legado.

## O que foi reorganizado

A estrutura visual do drawer em `/central-de-folha` agora segue a ordem operacional do sistema legado:

1. **Proventos**
   - O bloco agrega rubricas-base + proventos operacionais no mesmo agrupamento visual.
   - Mantido grid compacto com labels acima e campos abaixo.
2. **Descontos**
   - Mantido em bloco próprio com mesma lógica de densidade/legibilidade.
3. **Resultados**
   - Mantido apenas um único bloco final visível com:
     - Salário Real
     - G2 Complemento
     - Salário Líquido
   - Valores continuam vindo das rubricas derivadas reais já calculadas no fluxo existente.
4. **Observação**
   - Mantida abaixo dos resultados.

## Como a estrutura agora replica o legado

- A leitura da tela volta a ser linear e familiar para o usuário operacional:
  **Proventos → Descontos → Resultados → Observação → Ações**.
- Foi eliminada a exposição de seção técnica para usuário final.
- Foi eliminada duplicidade visual entre derivados e resultados.
- A UI mantém o mesmo fluxo de cálculo existente, sem regras paralelas novas na camada de apresentação.

## Arquivos alterados

- `src/components/payroll/EmployeeDrawer.tsx`
- `public/Analises/analise-9-reestruturacao-drawer-para-legado.md`

## Como validar manualmente

1. Abrir `/central-de-folha`.
2. Abrir o drawer de um funcionário/competência com rubricas ativas.
3. Validar que:
   - Não existe mais o card **Campos derivados (readonly)**.
   - O primeiro bloco operacional é **Proventos** (incluindo salários base e proventos).
   - O segundo bloco operacional é **Descontos**.
   - Existe apenas um bloco final de **Resultados** com 3 indicadores.
   - **Observação** permanece abaixo de resultados.
4. Alterar valores de rubricas editáveis e confirmar que os resultados exibidos continuam consistentes com o cálculo já existente.
5. Salvar e confirmar persistência sem regressão no fluxo.
