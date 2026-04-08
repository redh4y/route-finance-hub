import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { supabase } from "@/integrations/supabase/client";

import { DashboardStats } from "@/components/payer-groups/DashboardStats";
import { RouteSection } from "@/components/payer-groups/RouteSection";
import { JsonImportSidebar } from "@/components/payer-groups/JsonImportSidebar";
import { RoutePricingCard } from "@/components/payer-groups/RoutePricingCard";
import { CreateGroupDialog } from "@/components/payer-groups/CreateGroupDialog";
import { ManageGroupDialog } from "@/components/payer-groups/ManageGroupDialog";
import { RouteManagerDialog } from "@/components/payer-groups/RouteManagerDialog";
import type { PayerGroup, PayerLite } from "@/components/payer-groups/types";

export default function PayerGroupsPage() {
  const qc = useQueryClient();
  const [managingGroup, setManagingGroup] = useState<PayerGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRouteManager, setShowRouteManager] = useState(false);

  const { data: allPayers = [] } = useQuery<PayerLite[]>({
    queryKey: ["payers-lite-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payers")
        .select("id,name,document_digits,status")
        .eq("status", "ATIVO")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PayerLite[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["payer_groups"] });
    qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
  };

  return (
    <MainLayout>
      <PageTransition>
        <div
          style={{ fontFamily: "Inter, sans-serif" }}
          className="p-2 sm:p-4 max-w-[1600px] mx-auto bg-[#f8f9ff] text-[#0b1c30] min-h-screen"
        >
          {/* Header */}
          <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1
                style={{ fontFamily: "Manrope, sans-serif" }}
                className="text-3xl md:text-[3.5rem] font-extrabold leading-tight text-[#001e40] tracking-tight"
              >
                Grupos de Viagem
              </h1>
              <p className="text-lg text-[#515f74] font-medium max-w-2xl mt-2">
                Organize grupos operacionais, rotas e listas de cobrança de alunos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRouteManager(true)}
                className="px-5 py-2.5 border-2 border-[#dce9ff] text-[#515f74] rounded-xl font-semibold flex items-center gap-2 hover:bg-[#eff4ff] transition-colors"
              >
                <MapPin className="h-4 w-4" /> Gerenciar Rotas
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 bg-[#001e40] text-[#ffffff] rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Plus className="h-5 w-5" /> Novo Grupo
              </button>
            </div>
          </header>

          <DashboardStats />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <div className="xl:col-span-8">
              <RouteSection onManage={setManagingGroup} />
            </div>

            <aside className="xl:col-span-4 space-y-6 sticky top-[120px]">
              <JsonImportSidebar />
              <RoutePricingCard onManageRoutes={() => setShowRouteManager(true)} />
            </aside>
          </div>
        </div>

        <CreateGroupDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={invalidateAll}
        />

        {managingGroup && (
          <ManageGroupDialog
            group={managingGroup}
            allPayers={allPayers}
            onClose={() => { setManagingGroup(null); invalidateAll(); }}
          />
        )}

        <RouteManagerDialog
          open={showRouteManager}
          onClose={() => setShowRouteManager(false)}
        />
      </PageTransition>
    </MainLayout>
  );
}
