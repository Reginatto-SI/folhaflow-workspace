# Análise 2 — Ajustes de consistência conceitual dos PRDs

## Diagnóstico

- O PRD-00 ainda trazia a frase "motor desacoplado da interface", gerando ambiguidade frente ao PRD-01, que define cálculo centralizado executado no frontend para resposta imediata.
- O PRD-09 listava rubricas canônicas derivadas (`salario_real`, `g2_complemento`, `salario_liquido`) como grupos duplicáveis, o que conflita com o princípio de derivação via motor.
- Havia excesso de referência ao PRD-12 em módulos que não consomem rubricas diretamente (PRD-04, PRD-05, PRD-06 e PRD-10).
- No PRD-08, a semântica de "classificação como única fonte" precisava explicitar formalmente a exceção dos derivados canônicos.

## Ajustes aplicados

- **PRD-00**: substituído o trecho "motor desacoplado da interface" por redação alinhada ao PRD-01: cálculo centralizado em função única reutilizável no frontend; UI sem lógica distribuída.
- **PRD-09**:
  - removidos `salario_real`, `g2_complemento` e `salario_liquido` da lista de grupos duplicáveis;
  - adicionada regra explícita de que rubricas canônicas derivadas não devem ser duplicadas e devem ser sempre recalculadas pelo motor após criação da nova folha.
- **PRD-04, PRD-05, PRD-06 e PRD-10**: removida a seção "Observação de alinhamento documental" com referência ao PRD-12.
- **PRD-08**: adicionada regra semântica explicitando que a classificação é a fonte de agregação para rubricas operacionais, enquanto os derivados canônicos são exceção e vêm diretamente do motor.

## Riscos evitados

- Evita conflito interpretativo entre visão geral do produto e comportamento real do motor (frontend centralizado).
- Evita duplicação indevida de campos derivados, reduzindo risco de divergência entre folha duplicada e resultado recalculado.
- Evita poluição documental por referências cruzadas não essenciais, mantendo o escopo de cada PRD mais claro.
- Evita ambiguidade no módulo de relatórios sobre quando usar classificação e quando consumir valores derivados diretamente.

## Resultado final

- PRD-00 e PRD-01 ficaram semanticamente alinhados quanto ao cálculo centralizado no frontend.
- PRD-09 deixou de tratar rubricas derivadas canônicas como duplicáveis e reforçou recálculo obrigatório.
- PRD-08 passou a explicitar corretamente a exceção dos derivados canônicos frente à regra de classificação.
- A documentação ficou mais limpa e objetiva com a remoção de referências excessivas ao PRD-12 nos módulos não pertinentes.
