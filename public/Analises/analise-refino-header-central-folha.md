# Análise — Refino do Header da Central de Folha

## Problema visual anterior

O header da `/central-de-folha` concentrava muitos elementos visíveis ao mesmo tempo (status, ações primárias e secundárias, sugestão textual da data e botão de aplicar sugestão), criando competição visual e perda de hierarquia operacional.

## Nova composição do header

A composição foi simplificada para duas áreas horizontais:

- **Esquerda:** `Empresa`, `Competência` e `Data de pagamento`.
- **Direita:** ação principal `Novo lançamento` e menu de opções `...`.

Com isso, o botão primário da rotina diária passou a ter destaque claro e as ações secundárias ficaram agrupadas sem poluir o cabeçalho.

## Distribuição esquerda/direita

### Esquerda
- Empresa (combobox existente)
- Competência (combobox existente)
- Data de pagamento (input date)

### Direita
- Novo lançamento
- Menu `...` contendo:
  - Gerar recibos
  - Gerar relatório (mantido desabilitado, como já estava)
  - Criar nova folha
  - Status da folha
  - Arquivar folha atual
  - Indicador de folha arquivada (badge), quando aplicável

## Sugestão da Data de pagamento no campo

A sugestão passou a aparecer diretamente no valor do input de data para folhas sem `payment_date`, usando o helper oficial já existente (`getSuggestedPaymentDate`) e sem texto auxiliar abaixo do campo.

Com isso:
- não há mais frase "Usada nos recibos de pagamento.";
- não há botão "Usar sugestão";
- o campo já aparece preenchido visualmente com a data sugerida (dia 5 do mês seguinte à competência), podendo ser editado normalmente.

## Organização do menu de opções

As ações secundárias da folha foram movidas para o menu `...`, preservando as mesmas funcionalidades e validações já existentes.

## Testes executados

- Build de validação do projeto (`npm run build`).
- Revisão de fluxo no código para garantir que `Gerar recibos` continua salvando data pendente antes da geração (`savePaymentDateIfNeeded` chamado antes de `onGenerateReceipts`).

## Confirmação de escopo

Não houve alteração em:
- cálculo da folha;
- rubricas;
- compra de férias/dias;
- salário real, G2 complemento e salário líquido;
- tabela de funcionários;
- cards de resumo;
- AppLayout.

As mudanças foram restritas ao header da Central de Folha e à documentação desta análise.
