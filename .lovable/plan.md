# Ajuste de Exportação Excel/CSV — Relatório por Empresa

Escopo restrito a `src/lib/reportByCompanyData.ts` (dataset) e `src/lib/reportByCompanyExcel.ts` (exportação). PDF, Central de Folha, cálculo, recibos e layout da tela permanecem intocados.

## 1) Dataset (`reportByCompanyData.ts`)

Estender `ReportByCompanyRow` com campos bancários lidos diretamente do cadastro do funcionário (sem persistência nova, sem inferência):

- `bankName: string`
- `bankBranch: string`
- `bankAccount: string`
- `bankPixKey: string`

Em `buildReportByCompanyData`, ao montar cada linha, preencher esses 4 campos a partir do `employee` já resolvido (`employee?.bankName ?? ""`, etc.). Quando vazio, exporta vazio. Nenhuma alteração em rubricas, totais, ordenação ou regra de batch arquivado. Consolidado herda automaticamente via `companySections`/`rows`.

## 2) Exportação (`reportByCompanyExcel.ts`)

### Formatação pt-BR de valores monetários
Criar helper local `formatBrlNumber(value: number): string` usando `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Resultado: `2.324,20`, `10.000,00`, `0,00`. Sem `R$`.

### Helper de célula CSV
- `safeCsvText(value)`: para texto (nomes, setor, banco, agência, conta, Pix). Mantém o escape de fórmula (`'` na frente quando começa com `= + - @`) e aspas duplas. Garante que `0012`, `70378-8` e `606.547.463-03` saem como texto puro.
- `safeCsvMoney(value)`: aplica `formatBrlNumber` e envolve em aspas. Não usar `safeCsvCell` genérico para dinheiro.

### Estrutura de colunas
Ordem final no header e em cada linha:

1. `Empresa` (apenas no consolidado)
2. `Nome` (Funcionário)
3. `Setor`
4. `Função/Cargo`
5. `Admissão/Registro`
6. `Banco`
7. `Agência`
8. `Conta`
9. `Chave Pix`
10. ...rubricas dinâmicas (valores monetários formatados pt-BR)

CPF fica fora desta entrega (não está em `ReportByCompanyRow` hoje; evitar mudança grande).

Linha de totais:
- Individual: `TOTAL` + 8 colunas vazias (fixas + bancárias) + totais por rubrica formatados em pt-BR.
- Consolidado: `TOTAL GERAL` + 9 colunas vazias (Empresa + fixas + bancárias) + totais por rubrica formatados em pt-BR.

### CSV compatível com Excel pt-BR
- Manter separador `;` e BOM UTF-8 já existentes.
- Adicionar 1ª linha `sep=;` antes do BOM/título para o Excel detectar o separador automaticamente em pt-BR.
- MIME `text/csv;charset=utf-8;` e extensão `.csv` permanecem.

## 3) Testes

- Atualizar `src/lib/reportByCompanyData.test.ts` para cobrir os 4 novos campos bancários nas linhas (incluindo funcionário sem dados bancários → strings vazias).
- Adicionar teste leve em uma suíte nova `src/lib/reportByCompanyExcel.test.ts` validando: (a) `formatBrlNumber(2324.2) === "2.324,20"`, (b) header inclui Banco/Agência/Conta/Chave Pix, (c) agência `0012` preservada, (d) valor monetário formatado em pt-BR, (e) primeira linha contém `sep=;`.

## Critérios de aceite

- PDF, Central de Folha, cálculo e recibos inalterados.
- Excel/CSV individual e consolidado exibem Banco, Agência, Conta, Chave Pix.
- Valores monetários saem como `1.234,56` (nunca `1234.56`, nunca `R$`).
- Campos bancários preservam zeros à esquerda, traços e pontos.
- Build verde; testes do relatório passam.
