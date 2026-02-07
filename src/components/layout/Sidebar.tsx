import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  TrendingUp,
  MapPin,
  FileText,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Bus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { 
    label: "Dashboard", 
    path: "/", 
    icon: LayoutDashboard 
  },
  { 
    label: "Pagadores", 
    path: "/pagadores", 
    icon: Users 
  },
  { 
    label: "Importar", 
    path: "/importar", 
    icon: Upload 
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
    icon: MapPin 
  },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">Tavares</h1>
          <p className="text-xs text-sidebar-foreground/60">Financeiro</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.path}>
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
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
            <DollarSign className="h-4 w-4 text-sidebar-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-sidebar-foreground">Sistema Financeiro</p>
            <p className="text-xs text-sidebar-foreground/50">v1.0.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
