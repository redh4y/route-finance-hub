import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon, ExternalLink, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

export interface AdminIndicator {
  label: string;
  value: number | string;
  variant?: "default" | "success" | "warning" | "destructive";
  tooltip?: string;
}

export interface AdminAction {
  label: string;
  path: string;
  icon?: LucideIcon;
}

export interface AdminFeature {
  label: string;
  path: string;
}

interface AdminGroupCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  features: AdminFeature[];
  indicators: AdminIndicator[];
  actions: AdminAction[];
  index?: number;
}

const variantMap: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function AdminGroupCard({
  title,
  description,
  icon: Icon,
  iconColor = "text-accent",
  features,
  indicators,
  actions,
  index = 0,
}: AdminGroupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
    >
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
              <CardDescription className="mt-1 text-xs leading-relaxed">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 pt-0">
          {/* Indicators */}
          {indicators.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {indicators.map((ind) => (
                <span key={ind.label} className="inline-flex items-center gap-1">
                  {ind.tooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${variantMap[ind.variant ?? "default"]}`}
                        >
                          {ind.value} {ind.label}
                          <HelpCircle className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                        {ind.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${variantMap[ind.variant ?? "default"]}`}
                    >
                      {ind.value} {ind.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Features list */}
          <div className="flex flex-wrap gap-1.5">
            {features.map((f) => (
              <Link
                key={f.path}
                to={f.path}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {actions.map((action) => (
              <Button key={action.path} variant="outline" size="sm" asChild className="h-8 text-xs">
                <Link to={action.path}>
                  {action.icon && <action.icon className="mr-1.5 h-3.5 w-3.5" />}
                  {action.label}
                  <ExternalLink className="ml-1 h-3 w-3 opacity-40" />
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
