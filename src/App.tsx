import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Leads from "./pages/Leads";
import Audit from "./pages/Audit";
import PublicExcursion from "./pages/PublicExcursion";
import LandingPage from "./pages/LandingPage";
import LandingSettings from "./pages/LandingSettings";
import PublicExcursions from "./pages/PublicExcursions";
import PublicSiteSettings from "./pages/PublicSiteSettings";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import AdminPanel from "./pages/AdminPanel";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";
import DriversPage from "./pages/Drivers";
import InspectionChecklists from "./pages/InspectionChecklists";
import WhatsappPage from "./pages/Whatsapp";
import BoletoLinksPage from "./pages/BoletoLinks";
import PublicBoletoLinksPage from "./pages/PublicBoletoLinks";
import BoletoAccessLogsPage from "./pages/BoletoAccessLogs";
import AddressMatch from "./pages/AddressMatch";
import OAuthCallback from "./pages/OAuthCallback";

// Attendance module
import StudentLogin from "./pages/attendance/StudentLogin";
import StudentDashboard from "./pages/attendance/StudentDashboard";
import StudentCheckIn from "./pages/attendance/StudentCheckIn";
import StudentHistory from "./pages/attendance/StudentHistory";
import StudentProfile from "./pages/attendance/StudentProfile";
import StudentHelp from "./pages/attendance/StudentHelp";
import AttendanceAdmin from "./pages/attendance/AttendanceAdmin";
import PollDashboard from "./pages/PollDashboard";
import ReviewInbox from "./pages/ReviewInbox";

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
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<Navigate to="/site" replace />} />
              <Route
                path="/dashboard"
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
                path="/boletos-links"
                element={
                  <ProtectedRoute>
                    <BoletoLinksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs/2via-boletos"
                element={
                  <ProtectedRoute>
                    <BoletoAccessLogsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/auditoria"
                element={
                  <ProtectedRoute>
                    <Audit />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/whatsapp"
                element={
                  <ProtectedRoute>
                    <WhatsappPage />
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
                path="/leads"
                element={
                  <ProtectedRoute>
                    <Leads />
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
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manutencao"
                element={
                  <ProtectedRoute>
                    <Maintenance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manutencao/motoristas"
                element={
                  <ProtectedRoute>
                    <DriversPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manutencao/inspecao"
                element={
                  <ProtectedRoute>
                    <InspectionChecklists />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/match-enderecos"
                element={
                  <ProtectedRoute>
                    <AddressMatch />
                  </ProtectedRoute>
                }
              />
              {/* Attendance admin */}
              <Route
                path="/presenca/admin"
                element={
                  <ProtectedRoute>
                    <AttendanceAdmin />
                  </ProtectedRoute>
                }
              />
              {/* Review Inbox */}
              <Route
                path="/revisao"
                element={
                  <ProtectedRoute>
                    <ReviewInbox />
                  </ProtectedRoute>
                }
              />
              {/* Poll dashboard */}
              <Route
                path="/enquetes"
                element={
                  <ProtectedRoute>
                    <PollDashboard />
                  </ProtectedRoute>
                }
              />
              {/* Public routes - no auth required */}
              <Route path="/site" element={<LandingPage />} />
              <Route path="/public/excursoes" element={<PublicExcursions />} />
              <Route path="/public/excursoes/:token" element={<PublicExcursion />} />
              <Route path="/2-via-boletos" element={<PublicBoletoLinksPage />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              {/* Student attendance (public, no admin auth) */}
              <Route path="/presenca/login" element={<StudentLogin />} />
              <Route path="/presenca" element={<StudentDashboard />} />
              <Route path="/presenca/checkin" element={<StudentCheckIn />} />
              <Route path="/presenca/historico" element={<StudentHistory />} />
              <Route path="/presenca/perfil" element={<StudentProfile />} />
              <Route path="/presenca/ajuda" element={<StudentHelp />} />
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
