import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  CheckCircle2,
  TrendingUp,
  MapPin,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Bus,
  CreditCard,
  Truck,
  LogOut,
  Bug,
  MessageCircle,
  ChevronDown,
  BarChart3,
  Users2,
  Settings2,
  LayoutGrid,
  Wrench,
  FileText as ClipboardIcon,
  Users as DriversIcon,
  Vote,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Painel Admin",
    path: "/admin",
    icon: LayoutGrid,
  },
  {
    label: "Inbox Revisão",
    path: "/revisao",
    icon: AlertTriangle,
  },
  {
    label: "Gestão de Alunos",
    path: "/pagadores",
    icon: Users,
    children: [
      { label: "Pagadores", path: "/pagadores", icon: Users },
      { label: "Importar", path: "/importar", icon: Upload },
      { label: "Atrasos", path: "/atrasos", icon: MessageCircle },
      { label: "2a via boletos", path: "/boletos-links", icon: FileText },
      { label: "Logs 2a via", path: "/logs/2via-boletos", icon: FileText },
      { label: "Rotas", path: "/rotas", icon: MapPin },
      { label: "Match Endereços", path: "/match-enderecos", icon: MapPin },
    ],
  },
  {
    label: "Financeiro",
    path: "/financeiro",
    icon: TrendingUp,
    children: [
      { label: "DRE", path: "/financeiro", icon: FileText, exact: true },
      { label: "Entradas", path: "/financeiro/entradas", icon: ArrowUpCircle },
      { label: "Saídas", path: "/financeiro/saidas", icon: ArrowDownCircle },
      { label: "Conciliação", path: "/conciliacao", icon: CheckCircle2 },
    ],
  },
  {
    label: "Cartões",
    path: "/cartoes",
    icon: CreditCard,
  },
  {
    label: "Veículos",
    path: "/veiculos",
    icon: Truck,
  },
  {
    label: "Manutenção",
    path: "/manutencao",
    icon: Wrench,
    children: [
      { label: "Chamados", path: "/manutencao", icon: Wrench, exact: true },
      {
        label: "Motoristas",
        path: "/manutencao/motoristas",
        icon: DriversIcon,
      },
      { label: "Inspeção", path: "/manutencao/inspecao", icon: ClipboardIcon },
    ],
  },
  {
    label: "Comercial",
    path: "/excursoes",
    icon: Users2,
    children: [
      { label: "Excursões", path: "/excursoes", icon: Bus },
      { label: "Afiliados", path: "/afiliados", icon: Users2 },
      { label: "Leads", path: "/leads", icon: Users },
    ],
  },
  {
    label: "WhatsApp",
    path: "/whatsapp",
    icon: MessageCircle,
  },
  {
    label: "Enquetes",
    path: "/enquetes",
    icon: Vote,
  },
  {
    label: "Presença",
    path: "/presenca/admin",
    icon: CheckCircle2,
  },
  {
    label: "Configurações",
    path: "/configuracoes",
    icon: Settings2,
  },
  {
    label: "Relatórios",
    path: "/relatorios",
    icon: BarChart3,
  },
  {
    label: "Auditoria",
    path: "/auditoria",
    icon: FileText,
  },
  {
    label: "Diagnóstico",
    path: "/diagnostico",
    icon: Bug,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isChildActive = (child: { path: string; exact?: boolean }) => {
    if (child.exact) return location.pathname === child.path;
    return (
      location.pathname === child.path ||
      location.pathname.startsWith(`${child.path}/`)
    );
  };

  const isGroupActive = (children: Array<{ path: string; exact?: boolean }>) =>
    children.some((child) => isChildActive(child));

  const handleLogout = async () => {
    await signOut();
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border shrink-0"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden">
          <img
            src="/favicon.png"
            alt="Tavares"
            className="h-10 w-10 object-cover"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-sidebar-foreground truncate">
            Tavares
          </h1>
          <p className="text-xs text-sidebar-foreground/60">Financeiro</p>
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {item.children ? (
              <Collapsible
                open={isGroupActive(item.children) || !!openGroups[item.path]}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [item.path]: !prev[item.path],
                      }))
                    }
                    className={cn(
                      "nav-item w-full justify-between",
                      isGroupActive(item.children) && "text-sidebar-foreground",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform shrink-0",
                        (isGroupActive(item.children) ||
                          !!openGroups[item.path]) &&
                          "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1 mt-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={handleNavClick}
                        className={cn(
                          "nav-item",
                          isChildActive(child) && "active",
                        )}
                      >
                        <child.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Link
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  "nav-item",
                  isActive(item.path) && !item.children && "active",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )}
          </motion.div>
        ))}
      </nav>

      {/* Footer with user info and logout */}
      <div className="shrink-0 p-4 border-t border-sidebar-border">
        {user && (
          <div className="mb-3 px-3">
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">Sair</span>
        </Button>
      </div>
    </aside>
  );
}
