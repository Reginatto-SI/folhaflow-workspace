# Análise — Proteção contra tradução automática em recibos e relatórios

## Diagnóstico

- Sintoma relatado: navegadores com tradução automática podem alterar visualmente textos em português antes da impressão/salvamento do PDF pelo diálogo nativo.
- Onde ocorre: HTML principal, visualização de recibos para impressão e telas de relatórios.
- Causa provável: ausência de `translate="no"`, `lang="pt-BR"`, classe `notranslate` e meta `google=notranslate` nos pontos críticos do DOM.

## Correção aplicada

- HTML principal marcado como `lang="pt-BR"` e `translate="no"`.
- Head com `<meta name="google" content="notranslate" />`.
- Body, root React, visualização de recibo, canvas de impressão e telas/tabelas de relatórios protegidos com `notranslate`, `translate="no"` e `lang="pt-BR"`.
- Geradores PDF via jsPDF seguem usando strings pt-BR e formatação `pt-BR`; nenhum cálculo foi alterado.
- O valor por extenso é gerado por utilitário local do sistema (`src/lib/numberToWords.ts`), com vocabulário fixo em português do Brasil; não depende de API externa, DOM traduzido, navegador ou locale ambíguo.

## Validação manual documentada

1. Abrir o sistema no Chrome ou Edge com tradução automática ativada para português/inglês.
2. Gerar um recibo pela Central de Folha ou pelo Drawer do colaborador.
3. Confirmar na visualização e no diálogo de impressão/salvar PDF que o valor por extenso permanece exatamente em português do Brasil, por exemplo `oitocentos e trinta e três reais e trinta e três centavos` para R$ 833,33.
4. Confirmar na visualização e no diálogo de impressão/salvar PDF que permanecem exatamente em português do Brasil:
   - Valor por Extenso
   - Discriminação das Verbas
   - Salário Bruto
   - Diárias/Gratificações
   - 1/3 de férias
   - Hora extras
   - Prêmio/Desemp.
   - INSS
   - Emprést. Consig.
   - Adiant. Gerencial
   - Vale/Desconto
   - Descontos/Faltas
   - Líquido a receber
5. Abrir `/relatorios/por-empresa` e `/relatorios/resumo-completo` com tradução automática ativa.
6. Gerar PDF dos relatórios e confirmar que títulos, rubricas, acentos e valores por extenso/monetários permanecem em pt-BR.

## Escopo preservado

- Não houve alteração em cálculo da folha.
- Não houve recálculo ou lógica paralela de valores no recibo.
- Não houve alteração na estrutura de cálculo do PRD-01.
- A alteração é exclusivamente de proteção de idioma/tradução automática e robustez textual de visualização/impressão.
