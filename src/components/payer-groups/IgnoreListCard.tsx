import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, Plus, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { IgnoreEntry, IgnoreCategory } from "./types";

export function IgnoreListCard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const { data: entries = [] } = useQuery<IgnoreEntry[]>({
    queryKey: ["payer_import_ignore_list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_import_ignore_list")
        .select("*, category:payer_ignore_categories!category_id(id,name,created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [], refetch: refetchCats } = useQuery<IgnoreCategory[]>({
    queryKey: ["payer_ignore_categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_ignore_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = search
    ? entries.filter((e) => e.wa_name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const { data, error } = await (supabase as any)
      .from("payer_ignore_categories")
      .insert({ name: trimmed })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    await refetchCats();
    setCategoryId(data.id);
    setNewCatName("");
    setShowNewCat(false);
    qc.invalidateQueries({ queryKey: ["payer_ignore_categories"] });
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const catId = categoryId === "__none__" ? null : categoryId;
      const { error } = await (supabase as any)
        .from("payer_import_ignore_list")
        .insert({ wa_name: trimmed, category_id: catId });
      if (error) throw error;
      toast.success(`"${trimmed}" adicionado à lista de ignorados.`);
      setName("");
      setCategoryId("__none__");
      qc.invalidateQueries({ queryKey: ["payer_import_ignore_list"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (entry: IgnoreEntry) => {
    const { error } = await (supabase as any)
      .from("payer_import_ignore_list")
      .delete()
      .eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${entry.wa_name}" removido.`);
    qc.invalidateQueries({ queryKey: ["payer_import_ignore_list"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
          Lista de Nomes Ignorados
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Nomes nesta lista serão automaticamente ignorados durante importações JSON.
        </p>
      </div>

      {/* Add form */}
      <div className="p-4 border border-border rounded-xl bg-card space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adicionar novo</p>
        <Input
          placeholder="Nome exato como aparece no WhatsApp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />

        <div className="flex gap-2">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="text-sm flex-1">
              <SelectValue placeholder="Categoria (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sem categoria —</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!showNewCat ? (
            <Button variant="outline" size="sm" onClick={() => setShowNewCat(true)} className="gap-1 shrink-0">
              <Plus className="w-3 h-3" /> Categoria
            </Button>
          ) : (
            <div className="flex gap-1">
              <Input
                autoFocus
                placeholder="Nome"
                className="w-32"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setShowNewCat(false); }}
              />
              <Button size="sm" onClick={handleCreateCategory} disabled={!newCatName.trim()}>
                OK
              </Button>
            </div>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={adding || !name.trim()}
          className="w-full gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar à Lista
        </Button>
      </div>

      {/* Existing entries */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Badge variant="secondary" className="shrink-0">
              {entries.length} total
            </Badge>
          </div>

          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border max-h-96 overflow-y-auto">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{e.wa_name}</p>
                  {e.category?.name && (
                    <Badge variant="outline" className="text-[10px] mt-0.5 border-amber-200 bg-amber-50 text-amber-700">
                      {e.category.name}
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(e)}
                  className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum resultado encontrado.
              </p>
            )}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum nome ignorado ainda.</p>
        </div>
      )}
    </div>
  );
}
