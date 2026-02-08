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
  LogOut,
  Bug,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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
    label: "Cartoes",
    path: "/cartoes",
    icon: CreditCard,
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

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">Tavares</h1>
          <p className="text-xs text-sidebar-foreground/60">Financeiro</p>
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item, index) => (
          <motion.div 
            key={item.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {item.children ? (
              <div className="space-y-1">
                <div className={cn(
                  "nav-item cursor-default",
                  isActive(item.path) && "text-sidebar-foreground"
                )}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        "nav-item",
                        location.pathname === child.path && "active"
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                to={item.path}
                className={cn(
                  "nav-item",
                  isActive(item.path) && !item.children && "active"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )}
          </motion.div>
        ))}
      </nav>

      {/* Footer with user info and logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
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
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
