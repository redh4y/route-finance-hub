import { Users, AlertTriangle, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { colorBorderClass } from "./utils";
import type { PayerGroup } from "./types";

interface GroupRowProps {
  group: PayerGroup;
  onManage: (group: PayerGroup) => void;
  onDelete: (group: PayerGroup) => void;
}

export function GroupRow({ group, onManage, onDelete }: GroupRowProps) {
  const unmatchedCount = group.unmatched_count ?? 0;

  return (
    <tr
      className="hover:bg-muted/40 transition-colors cursor-pointer group/row"
      onClick={() => onManage(group)}
    >
      {/* Color stripe */}
      <td className="px-5 py-3">
        <div className={`w-1.5 h-8 rounded-full ${colorBorderClass(group.color).replace("border-", "bg-")}`} />
      </td>

      {/* Name + description */}
      <td className="px-3 py-3">
        <p className="font-semibold text-foreground leading-snug">{group.name}</p>
        {group.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[280px]">{group.description}</p>
        )}
      </td>

      {/* Member count */}
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {group.member_count ?? 0}
        </span>
      </td>

      {/* Unmatched */}
      <td className="px-3 py-3 text-center">
        {unmatchedCount > 0 ? (
          <Badge variant="outline" className="text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-700 gap-1">
            <AlertTriangle className="w-3 h-3" />
            {unmatchedCount}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onManage(group)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <Settings2 className="w-3 h-3" /> Gerenciar
          </button>
          <button
            onClick={() => onDelete(group)}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Excluir grupo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
