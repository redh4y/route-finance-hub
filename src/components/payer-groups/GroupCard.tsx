import { User, Settings2, Trash2 } from "lucide-react";
import { colorBorderClass, formatCents } from "./utils";
import type { PayerGroup } from "./types";

interface GroupRowProps {
  group: PayerGroup;
  routePricing: Record<string, number | null>;
  onManage: (group: PayerGroup) => void;
  onDelete: (group: PayerGroup) => void;
}

export function GroupRow({ group, routePricing, onManage, onDelete }: GroupRowProps) {
  const priceForRoute = group.route != null ? routePricing[group.route] : undefined;

  return (
    <tr className="hover:bg-[#f8faff] transition-colors group">
      {/* Color stripe */}
      <td className="px-4 py-3">
        <div className={`w-1 h-8 rounded-full ${colorBorderClass(group.color).replace("border-", "bg-")}`} />
      </td>

      {/* Name + description */}
      <td className="px-4 py-3">
        <p className="font-semibold text-[#001e40] leading-snug">{group.name}</p>
        {group.description && (
          <p className="text-xs text-[#94a3b8] truncate max-w-[240px]">{group.description}</p>
        )}
      </td>

      {/* Member count */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#515f74]">
          <User className="w-3.5 h-3.5" />
          {group.member_count ?? 0}
        </span>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-bold text-[#001e40]">
          {priceForRoute != null ? formatCents(priceForRoute)?.replace(",00", "") : "—"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onManage(group)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#e5eeff] text-[#001e40] rounded-lg hover:bg-[#001e40] hover:text-white transition-all"
          >
            <Settings2 className="w-3 h-3" /> Gerenciar
          </button>
          <button
            onClick={() => onDelete(group)}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir grupo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
