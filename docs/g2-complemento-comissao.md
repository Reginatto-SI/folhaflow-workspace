# Comissão na fórmula do G2 Complemento

A migration `20261105173000_add_commission_to_g2_complemento.sql` acrescenta
somente `add` da Comissão à fórmula existente de G2. Nenhum código operacional,
exportador, permissão, rubrica ou outra fórmula é alterado.

Identificação: `g2_complemento` ou alias técnico já suportado
`salario_g2_complemento`; Comissão pelo **code `18`**, confirmado nos testes
existentes de recibos e PDF. `display_order` e nomes visuais não identificam
rubricas. Não houve consulta nem alteração de dados reais: a migration verifica
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
  canônico e legado, comissão de 700 e zero. Labels/ordens arbitrários asseguram
  identificação técnica. Valores persistidos desatualizados não prevalecem.
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

Base: `origin/main` em `372631081b2c9022ab9a1fe2cc0a5617a15de4f3`.
Migrations existentes conferidas; última versão anterior `20260704120000`;
nenhuma migration existente acrescenta Comissão ao G2. A página pública de PRs
consultada antes da criação informou `openCount: 0` (inclui Drafts). A API do
GitHub estava bloqueada pela política de rede do ambiente. Nenhuma migration
anterior foi reescrita; não foi consultado o histórico de aplicação de produção.
A nova numeração não conflita com migrations da main consultada.

Sem merge, deploy, aplicação no Supabase, backfill ou modificação de dados reais.

Resultados nesta alteração: 12/12 testes SQL e 4/4 novos testes de integração
aprovados. Suíte completa: 126 aprovados, 2 falhos preexistentes em
`receiptData.test.ts` (base salarial esperada 3.284,07 versus 7.000,00; label
`Premio/Desemp.` versus `Prêmio/Desemp.`). ESLint do novo teste e `git diff --check`
aprovados. As falhas preexistentes já haviam sido identificadas no onboarding.
