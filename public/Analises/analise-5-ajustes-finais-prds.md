### Diagnóstico

Foram identificados três pontos de inconsistência documental:

- No PRD-07, a frase de que a classificação era a única fonte de agregação ficou incompleta após a introdução de campos canônicos derivados (salario_real, g2_complemento, salario_liquido), gerando conflito semântico com PRDs que tratam o motor como fonte final desses totais.
- No PRD-00, havia ambiguidade entre o modelo conceitual em camadas e a implementação atual, que executa o cálculo no frontend.
- Nos PRDs 07 e 09, existiam blocos redundantes de alinhamento documental com o PRD-12, repetindo diretriz já incorporada ao conteúdo principal.

### Ajustes aplicados

- PRD-07 (`## 13. Comentários obrigatórios`): inserido, imediatamente após a afirmação sobre agregação por classificação, um bloco explícito definindo que os campos derivados canônicos (`salario_real`, `g2_complemento`, `salario_liquido`) não devem ser agrupados por classificação e devem vir diretamente do motor de cálculo (PRD-01) como totais finais do recibo.
- PRD-00 (`## 6. Arquitetura funcional (alto nível)`): adicionado trecho após a descrição das camadas informando que, na versão atual, o processamento de cálculo ocorre no frontend e o backend permanece focado em persistência e suporte operacional.
- PRD-07 e PRD-09: removido integralmente o bloco `## Observação de alinhamento documental` (incluindo a frase sobre compatibilidade com PRD-12), eliminando redundância sem alterar o restante da estrutura.

### Resultado final

Os PRDs ficaram semanticamente alinhados com os ajustes solicitados:

- PRD-07 agora distingue corretamente agregação por classificação versus totais derivados canônicos vindos do motor.
- PRD-00 explicita a realidade arquitetural atual sem conflitar com a organização conceitual em camadas.
- PRD-07 e PRD-09 não mantêm mais a redundância documental com PRD-12.

Nenhuma alteração adicional foi aplicada fora do escopo definido (PRD-00, PRD-07 e PRD-09, além do entregável de análise).
