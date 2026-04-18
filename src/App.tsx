import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PayrollProvider } from "@/contexts/PayrollContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PermissionRoute from "@/components/auth/PermissionRoute";
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
                          {/* PayrollProvider must wrap AppLayout because AppLayout consumes usePayroll */}
                          <Route path="/" element={<Navigate to="/central-de-folha" replace />} />
                          <Route
                            path="/central-de-folha"
                            element={
                              <PermissionRoute permission="folha.operar">
                                <Index />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/empresas"
                            element={
                              <PermissionRoute permission="empresas.view">
                                <Companies />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/funcionarios"
                            element={
                              <PermissionRoute permission="funcionarios.view">
                                <Employees />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/setores"
                            element={
                              <PermissionRoute permission="estrutura.view">
                                <Departments />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/funcoes-cargos"
                            element={
                              <PermissionRoute permission="estrutura.view">
                                <JobRoles />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/rubricas"
                            element={
                              <PermissionRoute permission="rubricas.manage">
                                <Rubrics />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/usuarios"
                            element={
                              <PermissionRoute permission="usuarios.manage">
                                <UsersAdmin />
                              </PermissionRoute>
                            }
                          />
                          <Route
                            path="/configuracoes"
                            element={
                              <PermissionRoute permission="configuracoes.manage">
                                <SettingsPage />
                              </PermissionRoute>
                            }
                          />
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
