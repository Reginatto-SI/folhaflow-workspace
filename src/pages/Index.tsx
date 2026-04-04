import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollTable from "@/components/payroll/PayrollTable";

const Index = () => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Central de Folha</h2>
        <p className="text-sm text-muted-foreground mt-1">Edite os valores diretamente na tabela. Use TAB e setas para navegar.</p>
      </div>
      <TotalsBar />
      <PayrollTable />
    </div>
  );
};

export default Index;
