import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppPermission } from "@/contexts/AuthContext";
import Forbidden from "./Forbidden";

type Props = {
  permission: AppPermission;
  children: React.ReactNode;
};

const PermissionRoute: React.FC<Props> = ({ permission, children }) => {
  const { hasPermission, getDefaultAuthenticatedPath, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    const fallbackPath = getDefaultAuthenticatedPath();
    // Redireciona para uma rota realmente permitida; se não houver rota segura, exibe o bloqueio padrão.
    if (fallbackPath !== "/" && fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }
    return <Forbidden />;
  }

  return <>{children}</>;
};

export default PermissionRoute;
