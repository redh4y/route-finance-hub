import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const navItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Pagadores",
    path: "/pagadores",
    icon: Users,
  },
  {
    label: "Importar",
    path: "/importar",
    icon: Upload,
  },
  {
    label: "Cartões",
    path: "/cartoes",
    icon: CreditCard,
  },
  {
    label: "Veiculos",
    path: "/veiculos",
    icon: Truck,
  },
  {
    label: "Financeiro",
    path: "/financeiro",
    icon: TrendingUp,
    children: [
      { label: "DRE", path: "/financeiro", icon: FileText },
      { label: "Entradas", path: "/financeiro/entradas", icon: ArrowUpCircle },
      { label: "Saídas", path: "/financeiro/saidas", icon: ArrowDownCircle },
    ],
  },
  {
    label: "Rotas",
    path: "/rotas",
    icon: MapPin,
  },
  {
    label: "Atrasos",
    path: "/atrasos",
    icon: MessageCircle,
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
  const financeiroOpen = true;

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-sidebar-foreground truncate">Tavares</h1>
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
              <Collapsible open={financeiroOpen}>
                <div className={cn(
                  "nav-item w-full justify-between cursor-default",
                  isActive(item.path) && "text-sidebar-foreground"
                )}>
                  <span className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform shrink-0 rotate-180" />
                </div>
                <CollapsibleContent>
                  <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1 mt-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={handleNavClick}
                        className={cn(
                          "nav-item",
                          location.pathname === child.path && "active"
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
                  isActive(item.path) && !item.children && "active"
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
