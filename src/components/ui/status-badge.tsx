import { cn } from "@/lib/utils";

type StatusType = "paid" | "open" | "cancelled" | "review" | "active" | "inactive";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  paid: { label: "Pago", className: "badge-paid" },
  open: { label: "Em Aberto", className: "badge-open" },
  cancelled: { label: "Cancelado", className: "badge-cancelled" },
  review: { label: "Revisão", className: "badge-review" },
  active: { label: "Ativo", className: "badge-active" },
  inactive: { label: "Inativo", className: "badge-inactive" },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {label || config.label}
    </span>
  );
}

// Utility function to map billing status to StatusType
export function mapBillingStatus(status: string): StatusType {
  switch (status) {
    case "PAID":
      return "paid";
    case "OPEN":
      return "open";
    case "CANCELADO":
      return "cancelled";
    case "NEEDS_REVIEW":
      return "review";
    default:
      return "open";
  }
}

// Utility function to map payer status to StatusType
export function mapPayerStatus(status: string): StatusType {
  return status === "ATIVO" ? "active" : "inactive";
}
