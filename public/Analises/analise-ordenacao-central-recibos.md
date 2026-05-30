# Análise — Ordenação, busca e recibos na Central de Folha

## Arquivos alterados

- `src/pages/Index.tsx`
- `src/components/payroll/PayrollTable.tsx`
- `src/components/payroll/PayrollFilters.tsx`
- `public/Analises/analise-ordenacao-central-recibos.md`

## Diagnóstico do problema encontrado

A Central de Folha exibia os lançamentos na ordem recebida em memória, sem uma ordenação explícita de apresentação depois dos filtros operacionais. Com isso, a lista podia variar conforme a ordem retornada/carregada, e a geração de recibos em lote também podia herdar essa ordem.

A busca da Central considerava apenas o nome do funcionário, sem normalizar CPF. Assim, buscas com CPF pontuado, sem pontuação ou por trecho numérico não encontravam funcionários.

A tabela também não possuía estado de ordenação por cabeçalho para as colunas operacionais solicitadas.

## Solução aplicada

A solução foi mantida local à Central de Folha e à tabela já existente, sem criar nova arquitetura, novo motor de cálculo, nova tabela, migration ou alteração de persistência.

Foram adicionados:

- estado simples de ordenação na página da Central;
- normalização local de CPF para busca/ordenação;
- ordenação de apresentação depois dos filtros;
- cabeçalhos clicáveis reaproveitando o cabeçalho atual da tabela;
- ordenação independente A-Z antes de abrir a visualização dos recibos em lote.

## Como a ordenação padrão foi implementada

Após aplicar os filtros atuais da Central — busca, setor, função e status de conferência — a lista passa por uma ordenação estável de apresentação.

Quando o usuário ainda não escolheu uma ordenação manual, a ordenação efetiva é:

- coluna: `Funcionário`;
- direção: crescente;
- comparação: `Intl.Collator("pt-BR", { sensitivity: "base", numeric: true })`;
- funcionários sem nome são posicionados ao final.

Essa ordenação não altera dados persistidos e não depende da ordem retornada pelo banco.

## Como a ordenação por cabeçalhos foi implementada

A tabela existente recebeu cabeçalhos clicáveis para:

- Funcionário;
- CPF;
- Setor;
- Função;
- Salário Real;
- G2 Complemento;
- Salário Líquido.

O primeiro clique em uma coluna define ordenação crescente. Cliques seguintes na mesma coluna alternam entre crescente e decrescente.

Os valores monetários são comparados pelo número bruto calculado pela mesma função já usada na Central (`calculatePayrollFromEntry`), e não pela string formatada em `R$`.

O CPF é ordenado pelo valor normalizado apenas com dígitos.

O cabeçalho mostra um indicador discreto (`▲`, `▼` ou `↕`) sem mudar o padrão visual geral da tabela.

## Como a busca por CPF foi implementada

A busca continua sendo o mesmo campo existente, apenas ampliado.

Para nome:

- mantém busca parcial;
- ignora maiúsculas/minúsculas.

Para CPF:

- remove tudo que não for número tanto da busca quanto do CPF cadastrado;
- aceita CPF com pontuação, sem pontuação ou trecho numérico.

Exemplos atendidos:

- `02017348180`;
- `020.173.481-80`;
- `173481`.

O placeholder foi ajustado para `Buscar por nome ou CPF...`.

## Como a ordem dos recibos foi garantida

A geração em lote continua usando os lançamentos já filtrados da Central, porém antes de abrir a visualização/geração dos recibos é criada uma lista independente ordenada por nome do funcionário A-Z.

Essa ordenação dos recibos:

- não usa a página atual da paginação;
- não usa a ordenação manual atual da tabela;
- não depende da ordem do banco;
- não recalcula valores;
- apenas reorganiza a sequência dos lançamentos já existentes para montagem das páginas do recibo.

## Checklist de validação

- [x] PRDs funcionais lidos antes da alteração.
- [x] Ordenação padrão por funcionário A-Z aplicada após os filtros da Central.
- [x] Cabeçalho `Funcionário` alterna A-Z/Z-A.
- [x] Cabeçalho `CPF` ordena por CPF normalizado.
- [x] Cabeçalhos `Setor` e `Função` ordenam por texto.
- [x] Cabeçalhos `Salário Real`, `G2 Complemento` e `Salário Líquido` ordenam numericamente.
- [x] Busca por nome continua parcial e sem diferenciar maiúsculas/minúsculas.
- [x] Busca por CPF funciona com ou sem pontuação e por trecho numérico.
- [x] Filtros continuam sendo aplicados antes da ordenação.
- [x] Ordenação manual permanece aplicada ao novo conjunto filtrado.
- [x] Recibos em lote são ordenados por funcionário A-Z independentemente da ordenação da tabela.
- [x] Layout fixo do recibo não foi alterado.
- [x] Rodapé do recibo não foi alterado.
- [x] Nenhuma migration, RLS, autenticação ou persistência foi alterada.

## Confirmação sobre cálculo da folha

Nenhum cálculo da folha foi alterado.

A alteração não cria nova fonte de verdade e não recalcula valores de recibo. A Central e os recibos continuam usando os valores/entradas já existentes e a função de cálculo já usada pela própria Central apenas para leitura/ordenação dos valores exibidos.
