import React from "react";
import { useAuth, type AppPermission } from "@/contexts/AuthContext";
import Forbidden from "./Forbidden";

type Props = {
  permission: AppPermission;
  children: React.ReactNode;
};

const PermissionRoute: React.FC<Props> = ({ permission, children }) => {
  const { hasPermission, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Forbidden />;
  }

  return <>{children}</>;
};

export default PermissionRoute;
