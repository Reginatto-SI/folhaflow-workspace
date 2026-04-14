# Análise 12 — Central de Folha — Reposicionamento fino das ações do drawer

## Componente ajustado
- `src/components/payroll/EmployeeDrawer.tsx`

## Mudança aplicada
- Mantido o uso das ações no `SheetHeader`, mas reposicionadas para uma linha **abaixo** dos metadados do colaborador (nome/CPF/empresa/competência).
- Ajustado espaçamento vertical (`mt-2`) para afastar os botões da área do botão de fechar (`X`) e evitar sobreposição visual.
- Adicionados ícones já usados no projeto:
  - `Save` para ação `Salvar`
  - `FileText` para ação `Gerar recibo`
- Mantido o padrão visual compacto (`size="sm"`, `h-8`, `rounded-md`, `px-4`) e responsivo (`flex-wrap`).

## Motivo da mudança
- Após mover as ações para o topo, havia percepção de proximidade com o botão fechar em algumas larguras de tela.
- O ajuste reduz conflito visual no canto superior, preservando visibilidade imediata das ações e ergonomia operacional.

## Impacto visual
- Botões continuam visíveis sem necessidade de rolagem.
- Ações ficam em posição mais baixa dentro do cabeçalho, com leitura mais limpa.
- Ícones reforçam identificação rápida de ação sem aumentar ruído visual.

## Validações feitas
- `Salvar` segue acionando `handleSave` sem alteração de payload/regra.
- `Gerar recibo` permanece secundário (`outline`) e desabilitado, como no comportamento atual.
- Não houve alteração em cálculos, rubricas, totais ou fluxo funcional da folha.
