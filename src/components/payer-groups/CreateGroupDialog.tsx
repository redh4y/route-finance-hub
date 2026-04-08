import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GROUP_COLORS, colorBadgeClass } from "./utils";
import type { RouteConfig } from "./types";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGroupDialog({ open, onClose, onCreated }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");
  const [route, setRoute] = useState("__none__");
  const [saving, setSaving] = useState(false);

  const { data: routeConfigRows = [] } = useQuery<RouteConfig[]>({
    queryKey: ["route_config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("route_config")
        .select("route,monthly_amount_cents,updated_at")
        .order("route");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("payer_groups").insert({
        name: name.trim(),
        color,
        description: description.trim() || null,
        route: route === "__none__" ? null : route,
      });
      if (error) throw error;
      toast.success("Grupo criado!");
      onCreated();
      onClose();
      setName(""); setColor("blue"); setDescription(""); setRoute("__none__");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Grupo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome do grupo</Label>
            <Input
              placeholder="Ex: Unifeb 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rota</Label>
            <Select value={route} onValueChange={setRoute}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {routeConfigRows.map((r) => (
                  <SelectItem key={r.route} value={r.route}>{r.route}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border-2 ${colorBadgeClass(c.value)} ${color === c.value ? "border-foreground/40 scale-105" : "border-transparent"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input
              placeholder="Ex: Turno da manhã..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving ? "Criando..." : "Criar Grupo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
