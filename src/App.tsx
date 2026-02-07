import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Payers from "./pages/Payers";
import Import from "./pages/Import";
import Financial from "./pages/Financial";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialRevenue from "./pages/FinancialRevenue";
import RoutesPage from "./pages/Routes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pagadores" element={<Payers />} />
          <Route path="/importar" element={<Import />} />
          <Route path="/financeiro" element={<Financial />} />
          <Route path="/financeiro/entradas" element={<FinancialRevenue />} />
          <Route path="/financeiro/saidas" element={<FinancialExpenses />} />
          <Route path="/rotas" element={<RoutesPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
