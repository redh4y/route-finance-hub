import { useQuery } from "@tanstack/react-query";
import { Users, Layers, AlertTriangle, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GroupMember, PayerGroup } from "./types";

export function DashboardStats() {
  const { data: groups = [] } = useQuery<PayerGroup[]>({
    queryKey: ["payer_groups", "with_counts"],
    queryFn: async () => {
      const [groupsResult, countsResult, unmatchedResult] = await Promise.all([
        (supabase as any)
          .from("payer_groups")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("payer_group_members")
          .select("group_id")
          .eq("active", true),
        (supabase as any)
          .from("payer_group_members")
          .select("group_id,match_status")
          .eq("active", true)
          .in("match_status", ["unmatched", "review_ignored"]),
      ]);
      if (groupsResult.error) throw groupsResult.error;
      const countMap: Record<string, number> = {};
      for (const row of countsResult.data ?? []) {
        countMap[row.group_id] = (countMap[row.group_id] ?? 0) + 1;
      }
      const unmatchedMap: Record<string, number> = {};
      for (const row of unmatchedResult.data ?? []) {
        unmatchedMap[row.group_id] = (unmatchedMap[row.group_id] ?? 0) + 1;
      }
      return (groupsResult.data ?? []).map((g: PayerGroup) => ({
        ...g,
        member_count: countMap[g.id] ?? 0,
        unmatched_count: unmatchedMap[g.id] ?? 0,
      }));
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
  const linkedStudents = groups.reduce((acc, g) => acc + (g.member_count ?? 0), 0);
  const uniqueStudents = new Set(allMembers.map((m) => m.payer_id)).size;

  const payerCountMap: Record<string, number> = {};
  for (const m of allMembers) {
    if (m.payer_id) payerCountMap[m.payer_id] = (payerCountMap[m.payer_id] || 0) + 1;
  }
  const duplicates = Object.values(payerCountMap).filter((v) => v > 1).length;

  const stats = [
    { label: "Grupos", value: totalGroups, icon: Layers, color: "text-primary" },
    { label: "Vínculos", value: linkedStudents, icon: Users, color: "text-blue-600" },
    { label: "Alunos Únicos", value: uniqueStudents, icon: GitBranch, color: "text-emerald-600" },
    {
      label: "Duplicados",
      value: duplicates,
      icon: AlertTriangle,
      color: duplicates > 0 ? "text-amber-600" : "text-muted-foreground",
      alert: duplicates > 0,
    },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-3 p-4 rounded-xl border bg-card ${s.alert ? "border-amber-200 bg-amber-50/30" : "border-border"}`}
        >
          <div className={`shrink-0 ${s.color}`}>
            <s.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
