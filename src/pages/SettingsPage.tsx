import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const SettingsPage = () => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-semibold">Configurações</h2>
      <p className="text-sm text-muted-foreground">Preferências gerais do sistema.</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" /> Geral
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Configurações adicionais serão disponibilizadas nas próximas versões.
      </CardContent>
    </Card>
  </div>
);

export default SettingsPage;
