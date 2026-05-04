import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Upload, Users, ShieldOff } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

import { DashboardStats } from "@/components/payer-groups/DashboardStats";
import { RouteSection } from "@/components/payer-groups/RouteSection";
import { JsonImportSidebar } from "@/components/payer-groups/JsonImportSidebar";
import { CreateGroupDialog } from "@/components/payer-groups/CreateGroupDialog";
import { ManageGroupDialog } from "@/components/payer-groups/ManageGroupDialog";
import { RouteManagerDialog } from "@/components/payer-groups/RouteManagerDialog";
import { IgnoreListCard } from "@/components/payer-groups/IgnoreListCard";
import type { PayerGroup, PayerLite } from "@/components/payer-groups/types";

export default function PayerGroupsPage() {
  const qc = useQueryClient();
  const [managingGroup, setManagingGroup] = useState<PayerGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRouteManager, setShowRouteManager] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");

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
        <div className="p-3 sm:p-6 max-w-[1400px] mx-auto min-h-screen">
          {/* Header */}
          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                Grupos de Viagem
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Organize grupos, rotas e vincule alunos automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowRouteManager(true)}
                className="px-4 py-2 border border-border text-muted-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <MapPin className="h-4 w-4" /> Rotas
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> Novo Grupo
              </button>
            </div>
          </header>

          <DashboardStats />

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-muted/50">
              <TabsTrigger value="groups" className="gap-2 data-[state=active]:bg-background">
                <Users className="h-4 w-4" /> Grupos & Rotas
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2 data-[state=active]:bg-background">
                <Upload className="h-4 w-4" /> Importar JSON
              </TabsTrigger>
              <TabsTrigger value="ignore" className="gap-2 data-[state=active]:bg-background">
                <ShieldOff className="h-4 w-4" /> Ignorados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="mt-0">
              <RouteSection
                onManage={setManagingGroup}
                onManageRoutes={() => setShowRouteManager(true)}
              />
            </TabsContent>

            <TabsContent value="import" className="mt-0">
              <JsonImportSidebar />
            </TabsContent>

            <TabsContent value="ignore" className="mt-0">
              <div className="max-w-2xl">
                <IgnoreListCard />
              </div>
            </TabsContent>
          </Tabs>
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
