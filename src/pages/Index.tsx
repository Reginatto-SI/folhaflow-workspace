import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollTable from "@/components/payroll/PayrollTable";

const Index = () => {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Central de Folha</h2>
        <p className="text-sm text-muted-foreground">Edite os valores diretamente na tabela. Use TAB e setas para navegar.</p>
      </div>
      <TotalsBar />
      <PayrollTable />
    </div>
  );
};

export default Index;
