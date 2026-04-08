import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { IgnoreEntry, IgnoreCategory } from "./types";

export function IgnoreListCard() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [adding, setAdding] = useState(false);

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
    <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-sm p-6">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#64748b] flex items-center justify-center shrink-0">
            <ShieldOff className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3
              style={{ fontFamily: "Manrope, sans-serif" }}
              className="text-base font-bold text-[#001e40]"
            >
              Nomes Ignorados
            </h3>
            <p className="text-xs text-[#64748b]">
              {entries.length} entrada(s) · ignorados na importação
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#64748b]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#64748b]" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Add form */}
          <div className="space-y-2">
            <Input
              placeholder="Nome exato como aparece no WhatsApp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Categoria (opcional)…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem categoria —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!showNewCat ? (
              <button
                type="button"
                onClick={() => setShowNewCat(true)}
                className="flex items-center gap-1 text-xs text-[#001e40] font-semibold hover:underline"
              >
                <Plus className="w-3 h-3" /> Nova categoria
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                />
                <Button size="sm" onClick={handleCreateCategory} disabled={!newCatName.trim()}>
                  Criar
                </Button>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold bg-[#001e40] text-white hover:bg-[#003366] disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          {/* List */}
          {entries.length === 0 ? (
            <p className="text-xs text-center text-[#94a3b8] py-2">
              Nenhum nome ignorado ainda.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-[#f8faff] border border-[#eff4ff]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#001e40] truncate">{e.wa_name}</p>
                    {e.category?.name ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mt-0.5">
                        {e.category.name}
                      </span>
                    ) : e.reason ? (
                      <p className="text-[11px] text-[#94a3b8] truncate">{e.reason}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleDelete(e)}
                    className="shrink-0 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
