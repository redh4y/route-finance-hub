import { Check, User, Armchair, CreditCard, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = "info" | "seats" | "payment" | "confirmation";

const STEPS: { key: Step; label: string; icon: typeof User }[] = [
  { key: "info", label: "Dados", icon: User },
  { key: "seats", label: "Assentos", icon: Armchair },
  { key: "payment", label: "Pagamento", icon: CreditCard },
  { key: "confirmation", label: "Confirmação", icon: PartyPopper },
];

interface CheckoutStepperProps {
  current: Step;
}

export function CheckoutStepper({ current }: CheckoutStepperProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Etapas do checkout" className="flex items-center w-full">
      {STEPS.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        const isPending = i > currentIdx;
        const Icon = s.icon;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold transition-all border-2",
                  isCompleted && "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20",
                  isActive && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/15 shadow-md shadow-primary/20",
                  isPending && "bg-muted border-border text-muted-foreground"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap transition-colors",
                  isActive && "text-primary font-semibold",
                  isCompleted && "text-foreground",
                  isPending && "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-18px] rounded-full transition-all duration-300",
                  i < currentIdx ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
