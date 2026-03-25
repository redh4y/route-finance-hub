import * as React from "react";
import { cn } from "@/lib/utils";

export function mapBillingStatus(status: string, dueDate?: string | null): "paid" | "open" | "overdue" | "cancelled" | "review" {
  switch (status) {
    case "PAID":
      return "paid";
    case "OPEN": {
      const today = new Date().toISOString().split("T")[0];
      if (dueDate && dueDate < today) return "overdue";
      return "open";
    }
    case "CANCELADO":
      return "cancelled";
    case "NEEDS_REVIEW":
      return "review";
    default:
      return "open";
  }
}

type StatusType = "paid" | "open" | "overdue" | "cancelled" | "review" | "active" | "inactive";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  label?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  paid: { label: "Pago", className: "badge-paid" },
  open: { label: "Em Aberto", className: "badge-open" },
  overdue: { label: "Vencido", className: "badge-overdue" },
  cancelled: { label: "Cancelado", className: "badge-cancelled" },
  review: { label: "Revisão", className: "badge-review" },
  active: { label: "Ativo", className: "badge-active" },
  inactive: { label: "Inativo", className: "badge-inactive" },
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, label, className, ...props }, ref) => {
    const config = statusConfig[status];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
          config.className,
          className
        )}
        {...props}
      >
        {label || config.label}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge };

// Utility function to map payer status to StatusType
export function mapPayerStatus(status: string): StatusType {
  return status === "ATIVO" ? "active" : "inactive";
}
