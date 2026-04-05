import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PayrollProvider } from "@/contexts/PayrollContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Companies from "./pages/Companies";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import JobRoles from "./pages/JobRoles";
import Rubrics from "./pages/Rubrics";
import SettingsPage from "./pages/SettingsPage";
import UsersAdmin from "./pages/UsersAdmin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <PayrollProvider>
                    <SidebarProvider>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/empresas" element={<Companies />} />
                          <Route path="/funcionarios" element={<Employees />} />
                          <Route path="/setores" element={<Departments />} />
                          <Route path="/funcoes-cargos" element={<JobRoles />} />
                          <Route path="/rubricas" element={<Rubrics />} />
                          <Route path="/usuarios" element={<UsersAdmin />} />
                          <Route path="/configuracoes" element={<SettingsPage />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </SidebarProvider>
                  </PayrollProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
