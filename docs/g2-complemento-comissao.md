# Comissão na fórmula do G2 Complemento

A migration `20261105173000_add_commission_to_g2_complemento.sql` acrescenta
somente `add` da Comissão à fórmula existente de G2. Nenhum código operacional,
exportador, permissão, rubrica ou outra fórmula é alterado.

Identificação: `g2_complemento` ou alias técnico já suportado
`salario_g2_complemento`; também aceita o cadastro real de **code `16`**,
confirmado pelo usuário após consulta somente leitura, exigindo nome legado normalizado `salario g2 complem`
ou `salario g2 complemento`, atividade, natureza calculada e método fórmula.
Para o code 16, acentos, caixa, pontuação trivial e espaços são normalizados
com funções nativas do PostgreSQL, sem extensão adicional. A Comissão mantém a
identificação pelo **code `18`**, base manual ativa do tipo provento.
`display_order` nunca identifica rubricas; nome sozinho não seleciona G2.
Não houve consulta nem alteração de dados reais pelo agente: a migration verifica
as condições do cadastro ao ser aplicada e aborta com diagnóstico se não forem
satisfeitas. O papel de migration precisa ter acesso administrativo às tabelas;
RLS e permissões da aplicação permanecem intactas.

A inclusão usa `max(item_order) + 1`, preservando IDs, operações, ordens e
metadados anteriores. Uma referência `add` já existente é um no-op. Referências
conflitantes/duplicadas, cadastro ausente/ambíguo/inativo/incompatível ou fórmula
vazia causam erro atômico. O lock transacional impede corrida entre validação e
inserção; pode aguardar/bloquear brevemente edições concorrentes de rubricas.

## Validação

- `python supabase/tests/test_g2_commission.py`: PostgreSQL 17 em container
  descartável com `--network=none`, sem portas, removido ao terminar. Reutiliza
  migrations reais das tabelas, enums, constraints e RLS; funções de autenticação
  são stubs locais, sem conexão com Supabase. Requer Docker e `postgres:17-alpine`.
- `npx vitest run src/components/payroll/G2Commission.test.tsx`: motor, tabela real
  da Central, dataset compartilhado e aba Financeiro do workbook Excel; códigos
  canônico, alias técnico e código real 16 com nome legado; comissão de 700
  e zero. Ordens arbitrárias asseguram independência da posição da rubrica.
  Valores persistidos desatualizados não prevalecem.
- Cenário sintético compatível com os totais informados: Salário G 3.300,95,
  Fiscal 2.340,95, INSS 360,00 e Comissão 700,00; demais parcelas zero. Não é cópia
  nem validação do lançamento real do funcionário. G2 passa de 600,00 a 1.300,00;
  Líquido permanece 3.640,95; Fiscal permanece 2.340,95. Comissão zero preserva
  G2 600,00 e o líquido anterior sem comissão.

## Histórico e aplicação

**A migration precisa ser aplicada pelo fluxo autorizado de banco para a
correção funcionar.** Nenhum hardcode da regra foi introduzido no frontend.

`PayrollTable` e `buildReportByCompanyData` usam `calculatePayrollFromEntry`;
`buildFinancialSheetData` apenas lê os valores do dataset. As fórmulas são globais,
sem versionamento por competência. Portanto, regenerar um relatório histórico
com a fórmula atual pode alterar o G2 de folhas antigas com Comissão. A migration
não atualiza `payroll_entries` ou totais persistidos, não executa backfill e não
reescreve arquivos de relatórios anteriormente exportados. Salvar novamente uma
folha segue o fluxo normal da aplicação. Revisar o impacto histórico antes de
aplicar; não presumir congelamento de valores pelo status da folha.

## Governança

Base do refinamento: `origin/main` em `adf5816` (PR #160 integrada).
Migrations existentes conferidas; a única alteração anterior de Comissão no G2
é `20261105173000`. A página pública de PRs consultada antes do refinamento
informou `openCount: 0` (inclui Drafts). A API do GitHub permanece bloqueada pela
política de rede do ambiente.

O usuário confirmou expressamente que a migration **não foi aplicada com sucesso
em nenhum ambiente relevante**. Por isso, este refinamento corrige o arquivo
existente, sem introduzir uma segunda versão ou alterar o histórico de migrations.
Não houve acesso a bancos reais pelo agente. Caso outro ambiente tenha registro
dessa versão aplicada, interromper a publicação e reavaliar a estratégia antes
de substituir a migration nesse ambiente.

Sem merge, deploy, aplicação no Supabase, backfill ou modificação de dados reais.

Resultados do refinamento no arquivo definitivo: **19/19 testes SQL** em
PostgreSQL 17 descartável e **6/6 testes de integração** aprovados. Os testes
cobrem código 16 com nomes compostos/decompostos, caixa e espaços, nomes inválidos,
ambiguidade entre código 16/canônico/alias, código 160 não aceito, inatividade,
método inválido, idempotência e preservação integral das linhas anteriores.
Os casos anteriores de Comissão ausente/ambígua/inativa/incompatível e referências
conflitantes continuam aprovados. ESLint do teste de integração e
`git diff --check` aprovados.

A suíte completa não foi repetida neste refinamento restrito à identificação SQL
e às fixtures. Na PR #160, houve 126 aprovações e duas falhas preexistentes em
`receiptData.test.ts`, fora deste escopo.
