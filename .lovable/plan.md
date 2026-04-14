

# Plano: Rota oficial `/central-de-folha`

## Problema

A Central de Folha está montada em duas rotas (`/` e `/central-de-folha`) com a mesma instância de `<Index />`. O sidebar e o `routeLabels` apontam para `/`, causando inconsistência de estado ativo e título. A rota aninhada `path="*"` com `Routes` interno pode gerar conflitos ao resolver `/central-de-folha`.

## Mudanças (3 arquivos, ~10 linhas)

### 1. `src/App.tsx`
- Rota `/` → `<Navigate to="/central-de-folha" replace />`
- Manter apenas `<Route path="/central-de-folha" element={<Index />} />`
- Importar `Navigate` de `react-router-dom`

### 2. `src/components/layout/AppLayout.tsx`
- `mainNavItems`: `to: "/"` → `to: "/central-de-folha"`
- `routeLabels`: trocar chave `"/"` por `"/central-de-folha"`
- Remover `end={item.to === "/"}` do NavLink (não há mais rota raiz)

### 3. `src/pages/Index.tsx`
- Sem alteração (componente não depende de pathname)

## Resultado
- `/central-de-folha` é a rota oficial e única da Central de Folha
- `/` redireciona instantaneamente para `/central-de-folha`
- Sidebar, título e breadcrumb ficam consistentes
- Nenhum loop, nenhum loading preso, nenhuma duplicação

