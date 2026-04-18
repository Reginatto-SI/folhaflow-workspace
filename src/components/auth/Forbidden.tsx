import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const Forbidden: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Você não possui permissão para acessar esta área. Caso precise de acesso,
          fale com um administrador do sistema.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate("/central-de-folha")}>
        Voltar para a Central de Folha
      </Button>
    </div>
  );
};

export default Forbidden;
