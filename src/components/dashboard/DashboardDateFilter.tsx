import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "@/hooks/useEnhancedDashboard";

interface Props {
  range: DateRange;
  onChange: (r: DateRange) => void;
  onResetToCurrentMonth: () => void;
}

export function DashboardDateFilter({ range, onChange, onResetToCurrentMonth }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
        <Input
          type="date"
          value={range.startDate}
          onChange={(e) => onChange({ ...range, startDate: e.target.value })}
          className="w-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
        <Input
          type="date"
          value={range.endDate}
          onChange={(e) => onChange({ ...range, endDate: e.target.value })}
          className="w-full"
        />
      </div>
      <Button variant="outline" size="sm" onClick={onResetToCurrentMonth} className="whitespace-nowrap">
        <CalendarDays className="h-4 w-4 mr-1.5" />
        Mês atual
      </Button>
    </div>
  );
}
