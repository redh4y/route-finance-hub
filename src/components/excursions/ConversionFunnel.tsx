import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, UserCheck, QrCode, DollarSign, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

type FunnelStep = { label: string; value: number; icon: typeof Eye; color: string; bgColor: string };

export function ConversionFunnel() {
  const [excursionId, setExcursionId] = useState<string>("ALL");
  const [affiliateId, setAffiliateId] = useState<string>("ALL");

  const { data: excursions = [] } = useQuery({
    queryKey: ["funnel-excursions"],
    queryFn: async () => {
      const { data } = await supabase.from("excursions").select("id,name").order("departure_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: affiliates = [] } = useQuery({
    queryKey: ["funnel-affiliates"],
    queryFn: async () => {
      const { data } = await supabase.from("affiliates").select("id,name").eq("status", "ATIVO");
      return data || [];
    },
  });

  const { data: funnel, isLoading } = useQuery({
    queryKey: ["conversion-funnel", excursionId, affiliateId],
    queryFn: async () => {
      const sb = supabase as any;

      // Views from tracking events
      let viewsQ = sb.from("public_tracking_events").select("id", { count: "exact", head: true }).eq("event_name", "view_site");
      if (excursionId !== "ALL") viewsQ = viewsQ.eq("excursion_id", excursionId);
      if (affiliateId !== "ALL") viewsQ = viewsQ.eq("affiliate_ref", affiliateId);
      const { count: views } = await viewsQ;

      // Leads
      let leadsQ = sb.from("public_excursion_leads").select("id", { count: "exact", head: true });
      if (excursionId !== "ALL") leadsQ = leadsQ.eq("excursion_id", excursionId);
      if (affiliateId !== "ALL") leadsQ = leadsQ.eq("affiliate_id", affiliateId);
      const { count: leads } = await leadsQ;

      // PIX generated (orders with pix_code)
      let pixQ = sb.from("public_orders").select("id", { count: "exact", head: true }).not("pix_code", "is", null);
      if (excursionId !== "ALL") pixQ = pixQ.eq("excursion_id", excursionId);
      if (affiliateId !== "ALL") pixQ = pixQ.eq("affiliate_id", affiliateId);
      const { count: pixGenerated } = await pixQ;

      // Paid
      let paidQ = sb.from("public_orders").select("id,amount_paid_cents", { count: "exact" }).eq("status", "VENDIDO");
      if (excursionId !== "ALL") paidQ = paidQ.eq("excursion_id", excursionId);
      if (affiliateId !== "ALL") paidQ = paidQ.eq("affiliate_id", affiliateId);
      const { data: paidData, count: paid } = await paidQ;
      const totalRevenue = (paidData || []).reduce((s: number, o: any) => s + (o.amount_paid_cents || 0), 0);

      return {
        views: views || 0,
        leads: leads || 0,
        pixGenerated: pixGenerated || 0,
        paid: paid || 0,
        totalRevenue,
      };
    },
  });

  const steps: FunnelStep[] = [
    { label: "Visitas", value: funnel?.views || 0, icon: Eye, color: "text-blue-400", bgColor: "bg-blue-500/15" },
    { label: "Leads", value: funnel?.leads || 0, icon: UserCheck, color: "text-amber-400", bgColor: "bg-amber-500/15" },
    { label: "PIX Gerado", value: funnel?.pixGenerated || 0, icon: QrCode, color: "text-purple-400", bgColor: "bg-purple-500/15" },
    { label: "Pagos", value: funnel?.paid || 0, icon: DollarSign, color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
  ];

  const maxVal = Math.max(...steps.map((s) => s.value), 1);

  const convRate = (from: number, to: number) => {
    if (from === 0) return "–";
    return `${((to / from) * 100).toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Funil de Conversão
          </CardTitle>
          <div className="flex gap-2">
            <Select value={excursionId} onValueChange={setExcursionId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Todas excursões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas excursões</SelectItem>
                {excursions.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={affiliateId} onValueChange={setAffiliateId}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Todos afiliados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos afiliados</SelectItem>
                {affiliates.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, i) => {
              const widthPct = Math.max((step.value / maxVal) * 100, 8);
              const prevVal = i > 0 ? steps[i - 1].value : step.value;
              const rate = i > 0 ? convRate(prevVal, step.value) : "–";
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.bgColor} ${step.color} shrink-0`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{step.label}</span>
                        <div className="flex items-center gap-2">
                          {i > 0 && (
                            <span className="text-[11px] text-muted-foreground">{rate}</span>
                          )}
                          <span className="text-sm font-bold tabular-nums">{step.value.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className={`h-full rounded-full ${step.bgColor.replace("/15", "/60")}`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Summary */}
            <div className="pt-4 mt-2 border-t flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Conversão geral: </span>
                <span className="font-bold text-primary">{convRate(funnel?.views || 0, funnel?.paid || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Receita total: </span>
                <span className="font-bold">{formatCurrency(funnel?.totalRevenue || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
