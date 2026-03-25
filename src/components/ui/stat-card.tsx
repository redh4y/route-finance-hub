import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

type StatCardVariant = "default" | "positive" | "negative" | "warning" | "neutral";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  href?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: StatCardVariant;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, subtitle, icon: Icon, href, trend, variant = "default", className, ...props }, ref) => {
    const variantStyles: Record<StatCardVariant, string> = {
      default: "",
      positive: "finance-card-positive",
      negative: "finance-card-negative",
      warning: "finance-card-warning",
      neutral: "finance-card-neutral",
    };

    const iconBgStyles: Record<StatCardVariant, string> = {
      default: "bg-muted",
      positive: "bg-success/10",
      negative: "bg-destructive/10",
      warning: "bg-warning/10",
      neutral: "bg-accent/10",
    };

    const iconColorStyles: Record<StatCardVariant, string> = {
      default: "text-muted-foreground",
      positive: "text-success",
      negative: "text-destructive",
      warning: "text-warning",
      neutral: "text-accent",
    };

    const inner = (
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="stat-label">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn(trend.isPositive ? "stat-change-positive" : "stat-change-negative")}>
              {trend.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBgStyles[variant])}>
            <Icon className={cn("h-6 w-6", iconColorStyles[variant])} />
          </div>
        )}
      </div>
    );

    if (href) {
      return (
        <Link
          to={href}
          className={cn("finance-card block transition-opacity hover:opacity-80", variantStyles[variant], className)}
        >
          {inner}
        </Link>
      );
    }

    return (
      <div ref={ref} className={cn("finance-card", variantStyles[variant], className)} {...props}>
        {inner}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";

export { StatCard };
