import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, DollarSign, ShoppingCart, Users2, Link2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function AffiliatePortal() {
  const { token } = useParams<{ token: string }>();

  const { data: affLink, isLoading } = useQuery({
    queryKey: ["affiliate-portal", token],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("affiliate_excursions")
        .select("id,affiliate_id,affiliate_token,excursion_id,affiliates(id,name,commission_type,commission_value),excursions(id,name,destination,departure_at,seat_price_cents,public_token)")
        .eq("affiliate_token", token)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const affiliateId = affLink?.affiliate_id;
  const excursionId = affLink?.excursion_id;

  const { data: commissions = [] } = useQuery({
    queryKey: ["affiliate-commissions", affiliateId, excursionId],
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("affiliate_commissions")
        .select("id,amount_sold_cents,commission_cents,status,created_at")
        .eq("affiliate_id", affiliateId)
        .eq("excursion_id", excursionId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!affiliateId && !!excursionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-3 w-full max-w-lg px-4">
          <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
          <div className="h-48 bg-muted rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  if (!affLink) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <Users2 className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
          <h1 className="text-xl font-bold mb-2">Link não encontrado</h1>
          <p className="text-muted-foreground text-sm">Verifique o link com o administrador.</p>
        </div>
      </div>
    );
  }

  const affiliate = affLink.affiliates;
  const excursion = affLink.excursions;
  const totalSold = commissions.reduce((s: number, c: any) => s + (c.amount_sold_cents || 0), 0);
  const totalCommission = commissions.reduce((s: number, c: any) => s + (c.commission_cents || 0), 0);
  const confirmedCommission = commissions.filter((c: any) => c.status === "CONFIRMADA").reduce((s: number, c: any) => s + (c.commission_cents || 0), 0);
  const pendingCommission = totalCommission - confirmedCommission;

  const refUrl = excursion?.public_token
    ? `${window.location.origin}/public/excursoes/${excursion.public_token}?ref=${affLink.affiliate_token}`
    : null;

  const copyLink = () => {
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl);
    toast.success("Link copiado!");
  };

  const stats = [
    { label: "Total Vendas", value: formatCurrency(totalSold), icon: ShoppingCart, color: "text-primary" },
    { label: "Comissão Total", value: formatCurrency(totalCommission), icon: DollarSign, color: "text-emerald-500" },
    { label: "Confirmada", value: formatCurrency(confirmedCommission), icon: TrendingUp, color: "text-emerald-500" },
    { label: "Pendente", value: formatCurrency(pendingCommission), icon: DollarSign, color: "text-amber-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Portal do Afiliado</h1>
          <p className="text-muted-foreground">{affiliate?.name}</p>
          <Badge variant="outline" className="mt-2">{excursion?.name} — {excursion?.destination}</Badge>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-[11px] text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Referral link */}
        {refUrl && (
          <Card className="mb-6 border-dashed">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Seu link de indicação</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{refUrl}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Commissions table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Comissões</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma venda registrada ainda</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(c.amount_sold_cents)}</TableCell>
                      <TableCell className="font-mono font-semibold text-sm">{formatCurrency(c.commission_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "CONFIRMADA" ? "default" : c.status === "PAGA" ? "default" : "secondary"} className="text-[10px]">
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
