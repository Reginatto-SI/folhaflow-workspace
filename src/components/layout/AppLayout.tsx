import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  BriefcaseBusiness,
  FolderTree,
  ChevronDown,
  Users,
  FileSpreadsheet,
  Settings,
  NotebookText,
  Bell,
  LogOut,
  UserCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { usePayroll } from "@/contexts/PayrollContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVersionCheck } from "@/hooks/useVersionCheck";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const APP_VERSION = "1.0";

// Formata o ISO injetado em build-time como "DD/MM/AAAA HH:mm" (PT-BR).
function formatBuildDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

import type { AppPermission } from "@/contexts/AuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Building2;
  permission: AppPermission;
};

const mainNavItems: NavItem[] = [
  { to: "/central-de-folha", label: "Central de Folha", icon: FileSpreadsheet, permission: "folha.operar" },
];

const cadastrosNavItems: NavItem[] = [
  { to: "/empresas", label: "Empresas", icon: Building2, permission: "empresas.view" },
  { to: "/funcionarios", label: "Funcionários", icon: Users, permission: "funcionarios.view" },
  { to: "/setores", label: "Setores", icon: FolderTree, permission: "estrutura.view" },
  { to: "/funcoes-cargos", label: "Funções/Cargos", icon: BriefcaseBusiness, permission: "estrutura.view" },
  { to: "/rubricas", label: "Rubricas", icon: NotebookText, permission: "rubricas.manage" },
  { to: "/usuarios", label: "Usuários", icon: UserCircle, permission: "usuarios.manage" },
];

const secondaryNavItems: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings, permission: "configuracoes.manage" },
];

const routeLabels: Record<string, string> = {
  "/central-de-folha": "Central de Folha",
  "/empresas": "Empresas",
  "/funcionarios": "Funcionários",
  "/setores": "Setores",
  "/funcoes-cargos": "Funções/Cargos",
  "/rubricas": "Rubricas",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
};

// Valores reais virão de __BUILD_TIME__ / __BUILD_ID__ (injetados pelo Vite).
const BUILD_TIME_ISO = __BUILD_TIME__;
const BUILD_ID = __BUILD_ID__;
const BUILD_DATETIME = formatBuildDateTime(BUILD_TIME_ISO);

function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const collapsed = state === "collapsed";

  // Filtra os menus pelo conjunto de permissões do usuário logado.
  const visibleMain = mainNavItems.filter((i) => hasPermission(i.permission));
  const visibleCadastros = cadastrosNavItems.filter((i) => hasPermission(i.permission));
  const visibleSecondary = secondaryNavItems.filter((i) => hasPermission(i.permission));

  const isCadastrosRoute = visibleCadastros.some((item) => location.pathname.startsWith(item.to));
  const [cadastrosOpen, setCadastrosOpen] = React.useState(isCadastrosRoute);

  React.useEffect(() => {
    if (isCadastrosRoute) {
      setCadastrosOpen(true);
    }
  }, [isCadastrosRoute]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:px-2">
        {/* O logo colapsado ficava deslocado porque o header mantinha padding horizontal de layout expandido (px-4). */}
        {/* Ajuste mínimo: no modo icon, reaproveitamos o mesmo "encaixe" horizontal (px-2) usado pelos botões do menu. */}
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          {collapsed ? (
            // Mantemos o mesmo box 8x8 dos itens colapsados para alinhar visualmente no mesmo eixo dos ícones.
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              DF
            </div>
          ) : (
            // Estado expandido: usa a logo oficial já disponível em /public.
            <img src="/logo_Branca_Laranja.svg" alt="Delicious Fish" className="h-8 w-auto shrink-0" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.to}
                      end
                      className="flex items-center gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Grupo "Cadastros" oculto se o usuário não tem nenhum item permitido. */}
              {visibleCadastros.length > 0 && (
                <Collapsible open={cadastrosOpen} onOpenChange={setCadastrosOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Cadastros"
                        isActive={isCadastrosRoute}
                        className="text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      >
                        <Building2 className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Cadastros</span>}
                        {!collapsed && (
                          <ChevronDown
                            className={`ml-auto h-4 w-4 transition-transform ${cadastrosOpen ? "rotate-180" : ""}`}
                          />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleCadastros.map((item) => (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton asChild isActive={location.pathname.startsWith(item.to)}>
                              <NavLink to={item.to} className="text-sidebar-foreground/70 hover:text-sidebar-foreground">
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {visibleSecondary.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.to}
                      className="flex items-center gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        {!collapsed && (
          // Versão + build ID curto + data/hora real do build (auto-atualizado a cada deploy).
          // Tooltip mostra o ISO completo para diagnóstico rápido.
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default leading-tight">
                  <p className="text-xs text-sidebar-foreground/60">
                    v{APP_VERSION} <span className="text-sidebar-foreground/40">({BUILD_ID})</span>
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/40">{BUILD_DATETIME}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                <p className="text-xs">Build ID: {BUILD_ID}</p>
                <p className="text-xs">{BUILD_TIME_ISO}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companies, selectedCompany, setSelectedCompany, selectedMonth, setSelectedMonth } = usePayroll();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Detecta novos deploys e oferece "Atualizar agora" via toast persistente.
  useVersionCheck();
  // Evita fallback com o nome da marca em texto visível no header.
  const pageTitle = routeLabels[location.pathname] || "";

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center border-b bg-card px-4 gap-4">
          {/* Left: trigger + page title */}
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: notifications + avatar */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{profile?.name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => void handleLogout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
