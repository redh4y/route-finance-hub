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
import Cards from "./pages/Cards";
import Vehicles from "./pages/Vehicles";
import Excursions from "./pages/Excursions";
import ExcursionForm from "./pages/ExcursionForm";
import ExcursionDetail from "./pages/ExcursionDetail";
import Reports from "./pages/Reports";
import Affiliates from "./pages/Affiliates";
import PublicExcursion from "./pages/PublicExcursion";
import LandingPage from "./pages/LandingPage";
import LandingSettings from "./pages/LandingSettings";
import PublicExcursions from "./pages/PublicExcursions";
import PublicSiteSettings from "./pages/PublicSiteSettings";
import Settings from "./pages/Settings";
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
                path="/cartoes"
                element={
                  <ProtectedRoute>
                    <Cards />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/veiculos"
                element={
                  <ProtectedRoute>
                    <Vehicles />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/excursoes"
                element={
                  <ProtectedRoute>
                    <Excursions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/excursoes/nova"
                element={
                  <ProtectedRoute>
                    <ExcursionForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/excursoes/:id"
                element={
                  <ProtectedRoute>
                    <ExcursionDetail />
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
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <Reports />
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
              <Route
                path="/afiliados"
                element={
                  <ProtectedRoute>
                    <Affiliates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/landing-settings"
                element={
                  <ProtectedRoute>
                    <LandingSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/publico"
                element={
                  <ProtectedRoute>
                    <PublicSiteSettings />
                  </ProtectedRoute>
                }
              />
              {/* Public routes - no auth required */}
              <Route path="/site" element={<LandingPage />} />
              <Route path="/public/excursoes" element={<PublicExcursions />} />
              <Route path="/public/excursoes/:token" element={<PublicExcursion />} />
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
