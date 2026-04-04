import React from "react";
import { useLocation } from "react-router-dom";
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

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const mainNavItems = [
  { to: "/", label: "Central de Folha", icon: FileSpreadsheet },
];

const cadastrosNavItems = [
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/setores", label: "Setores", icon: FolderTree },
  { to: "/funcoes-cargos", label: "Funções/Cargos", icon: BriefcaseBusiness },
  { to: "/rubricas", label: "Rubricas", icon: NotebookText },
];

const secondaryNavItems = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const routeLabels: Record<string, string> = {
  "/": "Central de Folha",
  "/empresas": "Empresas",
  "/funcionarios": "Funcionários",
  "/setores": "Setores",
  "/funcoes-cargos": "Funções/Cargos",
  "/rubricas": "Rubricas",
  "/configuracoes": "Configurações",
};

function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const isCadastrosRoute = cadastrosNavItems.some((item) => location.pathname.startsWith(item.to));
  const [cadastrosOpen, setCadastrosOpen] = React.useState(isCadastrosRoute);

  React.useEffect(() => {
    // Mantém o grupo "Cadastros" aberto automaticamente durante a navegação nas rotas filhas.
    if (isCadastrosRoute) {
      setCadastrosOpen(true);
    }
  }, [isCadastrosRoute]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            F
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              FolhaFlow
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className="flex items-center gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Grupo hierárquico de cadastros para reduzir ruído visual no menu principal. */}
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
                      {cadastrosNavItems.map((item) => (
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

              {secondaryNavItems.map((item) => (
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
          <p className="text-xs text-sidebar-foreground/50">FolhaFlow v1.0</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companies, selectedCompany, setSelectedCompany, selectedMonth, setSelectedMonth } = usePayroll();
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] || "FolhaFlow";

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
                      U
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">Usuário</p>
                  <p className="text-xs text-muted-foreground">usuario@email.com</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
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
