import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Users, FileSpreadsheet, Settings, ChevronDown } from "lucide-react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const navItems = [
  { to: "/", label: "Central de Folha", icon: FileSpreadsheet },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companies, selectedCompany, setSelectedCompany, selectedMonth, setSelectedMonth } = usePayroll();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <h1 className="text-lg font-bold tracking-tight">FolhaFlow</h1>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
          FolhaFlow v1.0
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Select
              value={selectedCompany?.id || ""}
              onValueChange={(v) => {
                const c = companies.find((c) => c.id === v);
                if (c) setSelectedCompany(c);
              }}
            >
              <SelectTrigger className="w-[240px] h-9">
                <SelectValue placeholder="Selecione empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={`${selectedMonth.month}-${selectedMonth.year}`}
              onValueChange={(v) => {
                const [m, y] = v.split("-").map(Number);
                setSelectedMonth({ month: m, year: y });
              }}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2026].flatMap((year) =>
                  Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={`${i + 1}-${year}`} value={`${i + 1}-${year}`}>
                      {MONTHS[i]} {year}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
