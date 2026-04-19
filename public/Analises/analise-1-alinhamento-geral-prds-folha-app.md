# Análise 1 — Alinhamento geral dos PRDs do Folha App

## 1. Diagnóstico

- O repositório estava sem os PRDs 11 e 12, gerando lacuna formal para decisões já adotadas sobre modo de visualização e rubricas canônicas.
- O PRD-03 continha afirmações absolutas como “UI não executa cálculo/UI nunca calcula”, conflitantes com o PRD-01, que define cálculo centralizado acionado pela interface.
- O PRD-02 não tinha seção explícita de integração com rubricas canônicas, apesar de já citar exemplos de rubricas derivadas estruturais.
- O PRD-08 tinha regra adicional parcialmente alinhada, mas sem explicitar os três campos canônicos com os identificadores finais do projeto.

## 2. Ajustes aplicados

- **PRD-00**: ajustada diretriz da interface para “acionar e consumir cálculo centralizado sem lógica distribuída”; adicionadas referências aos módulos PRD-11 e PRD-12.
- **PRD-01**: adicionada regra explícita de alinhamento com PRD-03 sobre cálculo centralizado e papel da UI.
- **PRD-02**: adicionada seção “Integração com rubricas canônicas (PRD-12)” e renumeradas seções finais.
- **PRD-03**: removidas afirmações absolutas sobre UI “não calcular”; substituídas por regra de não distribuição de lógica e uso de função centralizada reutilizável.
- **PRD-04 a PRD-10**: adicionada observação curta de compatibilidade documental com PRD-12 quando aplicável.
- **PRD-08**: atualizada regra adicional para citar explicitamente `salario_real`, `g2_complemento`, `salario_liquido`; reforçado consumo direto do resultado do motor e exibição como totais finais.
- **PRD-11**: criado PRD de modo de visualização (clássico vs avançado), com fidelidade no drawer clássico e compactação apenas visual na tabela.
- **PRD-12**: criado PRD de rubricas canônicas com papel estrutural, complementar ao PRD-02 e sem auto-referência indevida.

## 3. Pontos preservados

- Mantida a diretriz de simplicidade operacional e comportamento estilo planilha.
- Mantida separação entre cálculo, dados e exibição já consolidada nos PRDs centrais.
- Mantida base por classificação para agregação em recibos/relatórios, sem introdução de novas regras de negócio além das já decididas.

## 4. Riscos residuais

- Como parte da base documental ainda usa termos legados em português (ex.: “salário fiscal”, “salário G2”), pode haver risco de nomenclatura divergente em implementações futuras se os identificadores técnicos não forem sempre priorizados.
- Recomenda-se revisão periódica de numeração/estrutura dos PRDs quando novos documentos forem adicionados para evitar duplicidade de seções e sobreposição de responsabilidades.

## 5. Resultado final

- Os PRDs foram alinhados com as decisões atuais do projeto Folha App.
- As regras críticas solicitadas (PRD-03, PRD-02, PRD-08, PRD-11 e PRD-12) ficaram explicitadas e coerentes entre si.
- O conjunto documental está mais consistente para uso como fonte oficial por Codex e Lovable.
