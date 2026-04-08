import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GroupMember, PayerGroup } from "./types";

export function DashboardStats() {
  const { data: groups = [] } = useQuery<PayerGroup[]>({
    queryKey: ["payer_groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_groups")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allMembers = [] } = useQuery<GroupMember[]>({
    queryKey: ["payer_group_members_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_group_members")
        .select("payer_id, group:payer_groups!inner(active)")
        .eq("active", true)
        .eq("payer_groups.active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalGroups = groups.length;
  const linkedStudents = allMembers.length;
  const uniqueStudents = new Set(allMembers.map((m) => m.payer_id)).size;

  const payerCountMap: Record<string, number> = {};
  for (const m of allMembers) {
    if (m.payer_id) payerCountMap[m.payer_id] = (payerCountMap[m.payer_id] || 0) + 1;
  }
  const duplicates = Object.values(payerCountMap).filter((v) => v > 1).length;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
      <StatCard label="Total Grupos" value={totalGroups} />
      <StatCard label="Alunos Vinculados" value={linkedStudents} />
      <StatCard label="Alunos Únicos" value={uniqueStudents} />
      <StatCard
        label="Duplicados"
        value={duplicates}
        badge={duplicates > 0 ? { text: "Atenção", className: "bg-[#ffdad6] text-[#93000a]" } : undefined}
      />
      <StatCard
        label="Sem Boleto (Mês)"
        value={0}
        badge={{ text: "Pendente", className: "bg-[#ffdbca] text-[#723610]" }}
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: number;
  badge?: { text: string; className: string };
}) {
  return (
    <div className="bg-[#ffffff] p-6 rounded-xl border border-[#eff4ff] shadow-sm flex flex-col justify-between">
      <div>
        <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-1">{label}</p>
        <p className="text-4xl font-black text-[#001e40]">{value}</p>
      </div>
      {badge && (
        <span
          className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit uppercase ${badge.className}`}
        >
          {badge.text}
        </span>
      )}
    </div>
  );
}
