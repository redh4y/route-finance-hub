import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DiagnosticsProvider } from "@/contexts/DiagnosticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Payers from "./pages/Payers";
import Import from "./pages/Import";
import Financial from "./pages/Financial";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialRevenue from "./pages/FinancialRevenue";
import RoutesPage from "./pages/Routes";
import Diagnostics from "./pages/Diagnostics";
import Overdue from "./pages/Overdue";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DiagnosticsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pagadores"
                element={
                  <ProtectedRoute>
                    <Payers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/importar"
                element={
                  <ProtectedRoute>
                    <Import />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute>
                    <Financial />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro/entradas"
                element={
                  <ProtectedRoute>
                    <FinancialRevenue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro/saidas"
                element={
                  <ProtectedRoute>
                    <FinancialExpenses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rotas"
                element={
                  <ProtectedRoute>
                    <RoutesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/atrasos"
                element={
                  <ProtectedRoute>
                    <Overdue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diagnostico"
                element={
                  <ProtectedRoute>
                    <Diagnostics />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DiagnosticsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
