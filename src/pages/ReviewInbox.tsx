import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Users, DollarSign, Inbox } from "lucide-react";
import { formatCentsToBRL } from "@/lib/formatters";

type ReviewCategory = "all" | "payers" | "financial";

interface ReviewItem {
  id: string;
  type: "payer" | "financial";
  title: string;
  subtitle: string;
  reasons: string[];
  updatedAt: string;
}

const REASON_LABELS: Record<string, string> = {
  MISSING_GROUP: "Grupo DRE ausente",
  MISSING_SUBGROUP: "Subgrupo DRE ausente",
  MISSING_PAYMENT_METHOD: "Método de pagamento ausente",
  COST_WITHOUT_VEHICLE: "Custo sem veículo vinculado",
  DUPLICATE_DOCUMENT: "Documento duplicado",
  INVALID_DOCUMENT: "Documento inválido",
  ADDRESS_MISMATCH: "Endereço inconsistente",
};

export default function ReviewInbox() {
  const [tab, setTab] = useState<ReviewCategory>("all");
  const queryClient = useQueryClient();

  const { data: payerItems = [], isLoading: loadingPayers } = useQuery({
    queryKey: ["review-payers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payers")
        .select("id, name, document, review_reason, review_status, updated_at")
        .eq("needs_review", true)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((p): ReviewItem => ({
        id: p.id,
        type: "payer",
        title: p.name,
        subtitle: p.document || "Sem documento",
        reasons: p.review_reason ? [p.review_reason] : ["Revisão pendente"],
        updatedAt: p.updated_at,
      }));
    },
  });

  const { data: financialItems = [], isLoading: loadingFinancial } = useQuery({
    queryKey: ["review-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount_cents, type, review_reasons, updated_at")
        .eq("needs_review", true)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((f): ReviewItem => ({
        id: f.id,
        type: "financial",
        title: f.description,
        subtitle: `${f.type} · ${formatCentsToBRL(f.amount_cents)}`,
        reasons: f.review_reasons || ["Revisão pendente"],
        updatedAt: f.updated_at,
      }));
    },
  });

  const resolvePayer = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("payers")
        .update({ needs_review: false, review_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-payers"] });
      toast.success("Pagador atualizado");
    },
  });

  const resolveFinancial = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({ needs_review: false, status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-financial"] });
      toast.success("Lançamento atualizado");
    },
  });

  const allItems = [...payerItems, ...financialItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const displayItems =
    tab === "payers" ? payerItems : tab === "financial" ? financialItems : allItems;

  const isLoading = loadingPayers || loadingFinancial;

  const handleResolve = (item: ReviewItem, status: string) => {
    if (item.type === "payer") {
      resolvePayer.mutate({ id: item.id, status });
    } else {
      resolveFinancial.mutate({ id: item.id, status });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inbox de Revisão</h1>
            <p className="text-muted-foreground text-sm">
              Registros que precisam de atenção operacional
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {allItems.length} pendentes
            </Badge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewCategory)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              Todos ({allItems.length})
            </TabsTrigger>
            <TabsTrigger value="payers" className="gap-1.5">
              <Users className="h-4 w-4" />
              Pagadores ({payerItems.length})
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5">
              <DollarSign className="h-4 w-4" />
              Financeiro ({financialItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Carregando...
                </CardContent>
              </Card>
            ) : displayItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
                  <p className="text-foreground font-medium">Tudo limpo!</p>
                  <p className="text-sm text-muted-foreground">
                    Nenhum registro pendente de revisão.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {displayItems.map((item) => (
                  <Card key={`${item.type}-${item.id}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center justify-between py-4 px-5 gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`mt-0.5 rounded-full p-1.5 ${
                          item.type === "payer"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent text-accent-foreground"
                        }`}>
                          {item.type === "payer" ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            <DollarSign className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.reasons.map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">
                                {REASON_LABELS[r] || r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleResolve(item, "REJEITADO")}
                          disabled={resolvePayer.isPending || resolveFinancial.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Rejeitar</span>
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => handleResolve(item, "APROVADO")}
                          disabled={resolvePayer.isPending || resolveFinancial.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Aprovar</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
