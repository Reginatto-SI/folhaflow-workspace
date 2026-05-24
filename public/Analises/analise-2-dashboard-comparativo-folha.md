# Análise 2 — Dashboard Comparativo da Folha (Refinamento)

## 1) Problemas encontrados
1. Filtro de empresa não era aplicado de forma uniforme em todos os blocos.
2. Evolução de 6 meses usava total geral, ignorando empresa selecionada.
3. Composição usava mapeamentos conceitualmente frágeis (`Salário G`/`Salário Fiscal` por labels sem garantir chave estável equivalente).
4. Botão `Exportar` estava clicável sem fluxo implementado.
5. Inicialização de competência comparada podia cair em estado inconsistente (incluindo comparação com a mesma competência).
6. Percentuais com base anterior zero podiam ficar ambíguos.

## 2) Correções aplicadas
- Correção mínima em `src/pages/Dashboard.tsx`, mantendo estrutura da tela.
- Aplicação uniforme do filtro de empresa em métricas, evolução e composição via leitura de `row.total` (all) ou `row.valuesByCompanyId[companyId]` (empresa específica).
- Adoção da Opção A para visão de empresa específica:
  - ocultação funcional de ranking/impacto/principais variações por empresa;
  - mensagem discreta: **"Ranking disponível apenas na visão Todas as empresas."**
- Botão `Exportar` desabilitado com tooltip de etapa futura.
- Inicialização/ajuste de `compareKey` via `useEffect` controlado para preferir competência anterior disponível e evitar comparação automática com a mesma competência.
- Percentuais protegidos para base zero com saída controlada (`—`).

## 3) Como o filtro de empresa afeta cada bloco agora
### Quando `Empresa = Todas as empresas`
- Cards: total geral.
- Evolução: total geral.
- Principais variações: cálculo entre empresas.
- Ranking: exibido com todas as empresas.
- Impacto por empresa: exibido.
- Composição: total geral.

### Quando há empresa específica
- Cards: somente empresa selecionada.
- Evolução: somente empresa selecionada.
- Composição: somente empresa selecionada.
- Principais variações / Ranking / Impacto: ocultados com mensagem de disponibilidade apenas na visão geral.

## 4) Como a composição foi validada
- Composição passou a usar somente chaves estáveis de `ReportSummaryDataset.rows` (`row.key`).
- Mapeamento final:
  - `salario_ctps` → Salário CTPS
  - `g2_complemento` → G2 Complemento
  - `salario_real` → Salário Real
  - `outros_rendimentos` → Outros Rendimentos
  - `__descontos__` → Descontos
  - `salario_liquido` → Salário Líquido
- Itens sem chave estável presente no dataset são omitidos (sem heurística por label).

## 5) Situação final do botão Exportar
- Botão mantido no layout, porém desabilitado.
- Tooltip: **"Exportação do dashboard será implementada em etapa futura."**

## 6) Confirmação de não recálculo
- O dashboard continua sendo apenas leitura/comparação de dados consolidados.
- Não houve alteração no motor de cálculo, Central, Recibos, relatórios PDF/Excel, banco ou RLS.

## 7) Pendências
- Exportação específica do dashboard permanece pendente por escopo.
- Se algum ambiente não possuir rubricas com chaves estáveis da composição, os grupos ausentes não são forçados e ficam omitidos por segurança.
