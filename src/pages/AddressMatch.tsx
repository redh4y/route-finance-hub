import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processAllRows, type CepRecord, type MatchConfig as EngineMatchConfig } from "@/lib/address-match-engine";
import Papa from "papaparse";
import {
  MapPin,
  Upload,
  Download,
  Play,
  Settings2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  FileText,
  Info,
  Phone,
  Save,
} from "lucide-react";

// ── Types ──
interface MatchConfig {
  bairro_fuzzy_threshold: number;
  min_score_logradouro: number;
  token_threshold: number;
  ambiguous_gap: number;
  token_weight: number;
  seq_weight: number;
  fallback_global: boolean;
}

interface Summary {
  total: number;
  matched: number;
  review: number;
  failed: number;
}

interface BairroDiag {
  bairro: string;
  count: number;
  gate: string;
}

interface Failure {
  endereco: string;
  bairro_gate: string;
  bairro_score: number;
  logradouro_score: number;
  review_reason: string;
}

interface MatchResponse {
  results: Record<string, unknown>[];
  summary: Summary;
  diagnostics: { topBairros: BairroDiag[]; failures: Failure[] };
  config: MatchConfig;
  cep_base_size: number;
  bairro_index_size: number;
  phone_summary?: { total: number; updated: number; secondary: number; below: number };
}

interface WhatsAppContact {
  phone_number: string;
  formatted_phone?: string;
  saved_name?: string;
  public_name?: string;
  is_my_contact?: boolean;
  is_business?: boolean;
  labels?: string[];
  country_code?: string;
}

interface PhoneMatchResult {
  payer_name: string;
  payer_phone: string;
  payer_phone_digits: string;
  wa_found: boolean;
  wa_saved_name: string;
  wa_public_name: string;
  wa_phone: string;
  wa_labels: string;
  wa_is_business: boolean;
  match_type: "nome" | "telefone" | "";
}

interface PayerChangePreview {
  doc_digits: string;
  payer_name: string;
  is_new: boolean;
  existing_id?: string;
  changes: { field: string; old_value: string; new_value: string }[];
  update_data: Record<string, unknown>;
}

const DEFAULT_CONFIG: MatchConfig = {
  bairro_fuzzy_threshold: 0.405,
  min_score_logradouro: 0.50,
  token_threshold: 0.82,
  ambiguous_gap: 0.05,
  token_weight: 0.45,
  seq_weight: 0.55,
  fallback_global: false,
};

// Normalize phone: keep only digits, take last 11 or 10
function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // Brazilian: 55 + DDD(2) + number(8-9) = 12-13 digits
  // Remove country code if present
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2); // DDD + number
  }
  return digits;
}

// Match phones by last 8 digits (handles DDD variations)
function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.length < 8 || nb.length < 8) return false;
  // Exact match on normalized
  if (na === nb) return true;
  // Last 8-9 digits match (handles 9th digit addition)
  const lastA = na.slice(-8);
  const lastB = nb.slice(-8);
  return lastA === lastB;
}

export default function AddressMatch() {
  // Files
  const [payersFile, setPayersFile] = useState<File | null>(null);
  const [cepsFile, setCepsFile] = useState<File | null>(null);
  const [payersData, setPayersData] = useState<Record<string, unknown>[]>([]);
  const [cepsData, setCepsData] = useState<Record<string, unknown>[]>([]);
  const [enderecoCol, setEnderecoCol] = useState("Endereco");
  const [phoneCol, setPhoneCol] = useState("Telefone");
  const [nameCol, setNameCol] = useState("Nome");
  const [docCol, setDocCol] = useState("Identif");
  const [useDbCeps, setUseDbCeps] = useState(true);

  // WhatsApp contacts
  const [waContacts, setWaContacts] = useState<WhatsAppContact[]>([]);
  const [waFileName, setWaFileName] = useState("");

  // Config
  const [config, setConfig] = useState<MatchConfig>({ ...DEFAULT_CONFIG });

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [phoneResults, setPhoneResults] = useState<PhoneMatchResult[]>([]);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [isUpdatingPayers, setIsUpdatingPayers] = useState(false);
  const [updatePayersResult, setUpdatePayersResult] = useState<{ updated: number; created: number; errors: number } | null>(null);
  const [payerChangesPreview, setPayerChangesPreview] = useState<PayerChangePreview[]>([]);
  const [showPayerPreviewModal, setShowPayerPreviewModal] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const payersCols = useMemo(() => {
    if (payersData.length === 0) return [];
    return Object.keys(payersData[0]);
  }, [payersData]);

  // Phone match summary
  const phoneSummary = useMemo(() => {
    const total = phoneResults.length;
    const found = phoneResults.filter((r) => r.wa_found).length;
    return { total, found, notFound: total - found };
  }, [phoneResults]);

  // ── CSV parsing ──
  const handleFile = useCallback(
    (file: File, setter: (d: Record<string, unknown>[]) => void, fileSetter: (f: File) => void) => {
      fileSetter(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (result) => {
          setter(result.data as Record<string, unknown>[]);
          toast.success(`${file.name}: ${result.data.length} linhas carregadas`);
        },
        error: () => toast.error(`Erro ao ler ${file.name}`),
      });
    },
    []
  );

  // ── WhatsApp JSON upload ──
  const handleWaJson = useCallback((file: File) => {
    setWaFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const contacts = Array.isArray(data) ? data : [];
        setWaContacts(contacts as WhatsAppContact[]);
        toast.success(`${file.name}: ${contacts.length} contatos carregados`);
      } catch {
        toast.error("Erro ao ler JSON de contatos");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  // ── Phone matching (client-side) — primary: nome, fallback: telefone ──
  const runPhoneMatch = useCallback(() => {
    if (payersData.length === 0 || waContacts.length === 0) return [];

    // Normalize helper for name comparison
    const normName = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .toLowerCase()
        .trim();

    // Build phone index: last 8 digits → contact
    const waPhoneIndex = new Map<string, WhatsAppContact>();
    for (const c of waContacts) {
      const norm = normalizePhone(c.phone_number);
      if (norm.length >= 8) {
        waPhoneIndex.set(norm.slice(-8), c);
        waPhoneIndex.set(norm, c);
      }
    }

    // Build name index: normalized saved_name → contact[]
    const waNameIndex = new Map<string, WhatsAppContact[]>();
    for (const c of waContacts) {
      const name = normName(c.saved_name || "");
      if (name.length < 3) continue;
      const existing = waNameIndex.get(name) || [];
      existing.push(c);
      waNameIndex.set(name, existing);
    }

    const buildResult = (
      payer: Record<string, unknown>,
      payerNameRaw: string,
      rawPhone: string,
      norm: string,
      match: WhatsAppContact | undefined,
      matchType: "nome" | "telefone" | ""
    ): PhoneMatchResult => ({
      payer_name: payerNameRaw,
      payer_phone: rawPhone,
      payer_phone_digits: norm,
      wa_found: !!match,
      wa_saved_name: match?.saved_name || "",
      wa_public_name: match?.public_name || "",
      wa_phone: match?.phone_number || "",
      wa_labels: (match?.labels || []).join(", "),
      wa_is_business: match?.is_business || false,
      match_type: matchType,
    });

    const results: PhoneMatchResult[] = [];
    for (const payer of payersData) {
      const rawPhone = String(payer[phoneCol] || "");
      const payerNameRaw = String(payer[nameCol] || "");
      if (!rawPhone || rawPhone === "undefined") continue;

      const norm = normalizePhone(rawPhone);
      const payerNorm = normName(payerNameRaw);

      // 1) Primary: match by name
      // Try exact normalized name match, also try removing trailing numbers (e.g. "Wagner Goncalves Ribeiro 26")
      let nameMatch: WhatsAppContact | undefined;
      if (payerNorm.length >= 3) {
        // Check each wa contact name: does the payer name appear as a substring or vice versa?
        const exactList = waNameIndex.get(payerNorm);
        if (exactList && exactList.length === 1) {
          nameMatch = exactList[0];
        } else if (!exactList) {
          // Try partial: payer name contained in saved_name or vice versa
          for (const [wName, contacts] of waNameIndex) {
            if (contacts.length !== 1) continue;
            if (
              (payerNorm.length >= 5 && wName.includes(payerNorm)) ||
              (wName.length >= 5 && payerNorm.includes(wName))
            ) {
              nameMatch = contacts[0];
              break;
            }
          }
        }
      }

      if (nameMatch) {
        results.push(buildResult(payer, payerNameRaw, rawPhone, norm, nameMatch, "nome"));
        continue;
      }

      // 2) Fallback: match by phone
      if (norm.length < 8) {
        results.push(buildResult(payer, payerNameRaw, rawPhone, norm, undefined, ""));
        continue;
      }

      const phoneMatch = waPhoneIndex.get(norm) || waPhoneIndex.get(norm.slice(-8));
      results.push(
        buildResult(payer, payerNameRaw, rawPhone, norm, phoneMatch, phoneMatch ? "telefone" : "")
      );
    }

    return results;
  }, [payersData, waContacts, phoneCol, nameCol]);

  // ── Run match (chunked) ──
  const runMatch = async () => {
    if (payersData.length === 0) {
      toast.error("Carregue o CSV de pagadores primeiro");
      return;
    }

    setIsProcessing(true);
    setResponse(null);
    setPhoneResults([]);

    try {
      // 1. Fetch CEP base (once)
      let cepBase: CepRecord[] = [];

      if (cepsData.length > 0) {
        cepBase = cepsData.map((r) => ({
          logradouro: String(r.logradouro || r.Logradouro || ""),
          bairro: String(r.bairro || r.Bairro || ""),
          cidade: String(r.cidade || r.Cidade || ""),
          uf: String(r.uf || r.UF || ""),
          cep: String(r.cep || r.CEP || r.Cep || ""),
        }));
      }

      if (useDbCeps) {
        toast.loading("Carregando base de CEPs...", { id: "match-progress" });
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("ceps")
            .select("logradouro, bairro, cidade, uf, cep")
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            cepBase.push(...data.map((r) => ({
              logradouro: r.logradouro || "",
              bairro: r.bairro || "",
              cidade: r.cidade || "",
              uf: r.uf || "",
              cep: r.cep || "",
            })));
          }
          hasMore = (data?.length || 0) === pageSize;
          page++;
        }
      }

      if (cepBase.length === 0) {
        toast.error("Nenhuma base de CEPs disponível");
        return;
      }

      // 2. Run matching client-side (no edge function needed!)
      const startTime = Date.now();
      const allResults = await processAllRows(
        payersData,
        cepBase,
        enderecoCol,
        config as EngineMatchConfig,
        (processed, total) => {
          const pct = Math.round((processed / total) * 100);
          toast.loading(`Processando ${processed}/${total} (${pct}%)...`, { id: "match-progress" });
        },
      );
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // 3. Phone match (client-side)
      if (waContacts.length > 0) {
        toast.loading("Aplicando match de telefones...", { id: "match-progress" });
        const pr = runPhoneMatch();
        setPhoneResults(pr);
      }

      // 4. Build summary & diagnostics
      const total = allResults.length;
      const matched = allResults.filter((r) => r.match_ok === true).length;
      const review = allResults.filter((r) => r.review_status === "REVIEW").length;
      const failed = total - matched - review;

      const bairroStats = new Map<string, { count: number; gate: string }>();
      for (const r of allResults) {
        const key = String(r.bairro_candidato || "(vazio)");
        if (!bairroStats.has(key))
          bairroStats.set(key, { count: 0, gate: String(r.bairro_gate || "") });
        bairroStats.get(key)!.count++;
      }
      const topBairros = Array.from(bairroStats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30)
        .map(([bairro, { count, gate }]) => ({ bairro, count, gate }));

      const failures = allResults
        .filter((r) => r.match_ok !== true)
        .slice(0, 50)
        .map((r) => ({
          endereco: String(r.endereco_usado || ""),
          bairro_gate: String(r.bairro_gate || ""),
          bairro_score: Number(r.bairro_score || 0),
          logradouro_score: Number(r.logradouro_score || 0),
          review_reason: String(r.review_reason || ""),
        }));

      const matchResponse: MatchResponse = {
        results: allResults,
        summary: { total, matched, review, failed },
        diagnostics: { topBairros, failures },
        config,
        cep_base_size: cepBase.length,
        bairro_index_size: 0,
        phone_summary: undefined,
      };

      setResponse(matchResponse);
      toast.dismiss("match-progress");
      toast.success(`Processamento concluído em ${elapsed}s: ${matched} matches de ${total}`);
    } catch (err: unknown) {
      toast.dismiss("match-progress");
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run only phone match (without address)
  const runPhoneOnly = () => {
    if (payersData.length === 0 || waContacts.length === 0) {
      toast.error("Carregue o CSV de pagadores e o JSON de contatos");
      return;
    }
    const pr = runPhoneMatch();
    setPhoneResults(pr);
    const found = pr.filter((r) => r.wa_found).length;
    toast.success(`Match de telefones: ${found}/${pr.length} encontrados`);
  };

  // ── Import contacts to DB ──
  const importContactsToDb = async () => {
    if (waContacts.length === 0) return;
    setIsSavingContacts(true);
    try {
      const PROVIDER_ID = "e5fcf8c4-999c-489f-aff1-cdbad051186a";
      const INSTANCE = "lf-local-202603050919";
      const BATCH_SIZE = 200;
      let saved = 0;
      let errors = 0;

      for (let i = 0; i < waContacts.length; i += BATCH_SIZE) {
        const batch = waContacts.slice(i, i + BATCH_SIZE).map((c) => ({
          provider_id: PROVIDER_ID,
          instance_name: INSTANCE,
          wa_number: normalizePhone(c.phone_number),
          wa_jid: normalizePhone(c.phone_number) + "@s.whatsapp.net",
          display_name: c.saved_name || c.public_name || "",
          raw: JSON.parse(JSON.stringify(c)),
        }));

        const { error } = await supabase
          .from("whatsapp_contacts")
          .upsert(batch, { onConflict: "provider_id,wa_number", ignoreDuplicates: false });

        if (error) {
          console.error("Batch error:", error);
          errors += batch.length;
        } else {
          saved += batch.length;
        }
      }

      if (errors > 0) {
        toast.warning(`Importados ${saved} contatos, ${errors} erros`);
      } else {
        toast.success(`${saved} contatos importados no banco`);
      }
    } catch (err: unknown) {
      toast.error("Erro ao importar contatos");
    } finally {
      setIsSavingContacts(false);
    }
  };

  // ── Update payers in DB ──
  const updatePayersInDb = async () => {
    const enriched = getEnrichedResults();
    if (!enriched.length) {
      toast.error("Execute o match primeiro");
      return;
    }

    setIsUpdatingPayers(true);
    setUpdatePayersResult(null);
    let updated = 0;
    let created = 0;
    let errors = 0;
    const BATCH = 50;

    try {
      // Build phone map from phoneResults
      const phoneMap = new Map<string, PhoneMatchResult>();
      for (const pr of phoneResults) {
        if (pr.payer_phone_digits) phoneMap.set(pr.payer_phone_digits, pr);
      }

      for (let i = 0; i < enriched.length; i += BATCH) {
        const batch = enriched.slice(i, i + BATCH);
        const pct = Math.round(((i + batch.length) / enriched.length) * 100);
        toast.loading(`Atualizando pagadores ${i + 1}-${i + batch.length} de ${enriched.length} (${pct}%)...`, { id: "update-payers" });

        for (const row of batch) {
          try {
            const rawDoc = String(row[docCol] || "").replace(/\D/g, "").padStart(11, "0");
            if (!rawDoc || rawDoc === "00000000000") continue;

            const payerName = String(row[nameCol] || "");
            const matchOk = row.match_ok === true;

            // Build update payload
            const updateData: Record<string, unknown> = {};

            // Address fields (only if match was successful)
            if (matchOk) {
              const street = String(row.matched_logradouro || "");
              const number = String(row.matched_numero || "");
              const neighborhood = String(row.bairro_candidato || "");
              const cep = String(row.matched_cep || "");
              const city = String(row.matched_cidade || "");
              const state = String(row.matched_uf || "");

              if (street) updateData.street = street;
              if (number) updateData.number = number;
              if (neighborhood) updateData.neighborhood = neighborhood;
              if (cep) updateData.cep = cep.replace(/\D/g, "");
              if (city) updateData.city = city;
              if (state) updateData.state = state;
              updateData.match_ok = true;
              updateData.address_base = String(row[enderecoCol] || "");
              updateData.address_original = String(row[enderecoCol] || "");
            }

            // Phone from WhatsApp match
            const rawPhone = String(row[phoneCol] || "");
            const normPhone = normalizePhone(rawPhone);
            const pm = normPhone.length >= 8 ? (phoneMap.get(normPhone) || phoneMap.get(normPhone.slice(-8))) : undefined;
            if (pm?.wa_found && pm.wa_phone) {
              updateData.phone = pm.wa_phone;
            } else if (rawPhone && rawPhone !== "undefined") {
              updateData.phone = rawPhone;
            }

            if (Object.keys(updateData).length === 0) continue;

            // Try to find existing payer by document_digits
            const { data: existing } = await supabase
              .from("payers")
              .select("id")
              .eq("document_digits", rawDoc)
              .limit(1);

            if (existing && existing.length > 0) {
              // Update
              updateData.updated_at = new Date().toISOString();
              const { error } = await supabase
                .from("payers")
                .update(updateData)
                .eq("id", existing[0].id);
              if (error) {
                console.error("Update error:", error, rawDoc);
                errors++;
              } else {
                updated++;
              }
            } else {
              // Create new payer
              const newPayer: Record<string, unknown> = {
                legacy_id: crypto.randomUUID(),
                name: payerName,
                name_lower: payerName.toLowerCase(),
                document: rawDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
                document_digits: rawDoc,
                document_valid: rawDoc.length === 11,
                ...updateData,
              };
              const { error } = await supabase.from("payers").insert(newPayer as any);
              if (error) {
                console.error("Insert error:", error, rawDoc);
                errors++;
              } else {
                created++;
              }
            }
          } catch (err) {
            console.error("Row error:", err);
            errors++;
          }
        }
      }

      setUpdatePayersResult({ updated, created, errors });
      toast.dismiss("update-payers");
      if (errors > 0) {
        toast.warning(`Pagadores: ${updated} atualizados, ${created} criados, ${errors} erros`);
      } else {
        toast.success(`Pagadores: ${updated} atualizados, ${created} criados`);
      }
    } catch (err) {
      console.error("updatePayersInDb error:", err);
      toast.error("Erro ao atualizar pagadores");
    } finally {
      setIsUpdatingPayers(false);
    }
  };


  const getEnrichedResults = () => {
    if (!response?.results) return [];
    let enriched = response.results;
    if (phoneResults.length > 0) {
      const phoneMap = new Map<string, PhoneMatchResult>();
      for (const pr of phoneResults) {
        if (pr.payer_phone_digits) phoneMap.set(pr.payer_phone_digits, pr);
      }
      enriched = response.results.map((r) => {
        const rawPhone = String(r[phoneCol] || "");
        const norm = normalizePhone(rawPhone);
        const pm = norm.length >= 8 ? (phoneMap.get(norm) || phoneMap.get(norm.slice(-8))) : undefined;
        return {
          ...r,
          wa_encontrado: pm?.wa_found ? "SIM" : "NÃO",
          wa_match_via: pm?.match_type || "",
          wa_nome_salvo: pm?.wa_saved_name || "",
          wa_nome_publico: pm?.wa_public_name || "",
          wa_telefone: pm?.wa_phone || "",
          wa_labels: pm?.wa_labels || "",
          wa_empresarial: pm?.wa_is_business ? "SIM" : "NÃO",
        };
      });
    }
    return enriched;
  };

  const downloadCsv = (delimiter: "," | ";") => {
    const enriched = getEnrichedResults();
    if (!enriched.length) return;
    const csv = Papa.unparse(enriched, { delimiter });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = delimiter === ";" ? "_ponto_virgula" : "";
    a.download = `match_enderecos_${new Date().toISOString().slice(0, 10)}${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = response?.summary;
  const matchPct = summary ? Math.round((summary.matched / Math.max(summary.total, 1)) * 100) : 0;

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                Match de Endereços & Telefones
              </h1>
              <p className="text-muted-foreground text-sm">
                Normalização de endereço + validação de telefone via contatos WhatsApp
              </p>
            </div>
            <div className="flex gap-2 self-start">
              {response && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2">
                      <Download className="h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => downloadCsv(",")}>
                      Separado por vírgula (,)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadCsv(";")}>
                      Separado por ponto e vírgula (;)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {response && (
                <Button
                  onClick={updatePayersInDb}
                  disabled={isUpdatingPayers}
                  variant="default"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  {isUpdatingPayers ? "Atualizando..." : "Atualizar Pagadores no Banco"}
                </Button>
              )}
            </div>
          </div>

          {/* Upload + Config */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Upload */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Arquivos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>CSV de Pagadores *</Label>
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f, setPayersData, setPayersFile);
                      }}
                    />
                    {payersFile && (
                      <p className="text-xs text-muted-foreground">
                        {payersFile.name} — {payersData.length} linhas
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Base de CEPs (opcional)
                      <span className="text-muted-foreground text-xs ml-1">complementa o banco</span>
                    </Label>
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f, setCepsData, setCepsFile);
                      }}
                    />
                    {cepsFile && (
                      <p className="text-xs text-muted-foreground">
                        {cepsFile.name} — {cepsData.length} linhas
                      </p>
                    )}
                  </div>
                </div>

                {/* WhatsApp JSON */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    JSON de Contatos WhatsApp (opcional)
                  </Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleWaJson(f);
                    }}
                  />
                  {waFileName && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {waFileName} — {waContacts.length} contatos
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={importContactsToDb}
                        disabled={isSavingContacts || waContacts.length === 0}
                      >
                        <Save className="h-3 w-3" />
                        {isSavingContacts ? "Salvando..." : "Salvar no banco"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-2 flex-1">
                    <Label>Coluna de endereço</Label>
                    {payersCols.length > 0 ? (
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={enderecoCol}
                        onChange={(e) => setEnderecoCol(e.target.value)}
                      >
                        {payersCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={enderecoCol}
                        onChange={(e) => setEnderecoCol(e.target.value)}
                        placeholder="Nome da coluna"
                      />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label>Coluna de telefone</Label>
                    {payersCols.length > 0 ? (
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={phoneCol}
                        onChange={(e) => setPhoneCol(e.target.value)}
                      >
                        {payersCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={phoneCol}
                        onChange={(e) => setPhoneCol(e.target.value)}
                        placeholder="Nome da coluna"
                      />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label>Coluna de nome</Label>
                    {payersCols.length > 0 ? (
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={nameCol}
                        onChange={(e) => setNameCol(e.target.value)}
                      >
                        {payersCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={nameCol}
                        onChange={(e) => setNameCol(e.target.value)}
                        placeholder="Nome da coluna"
                      />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label>Coluna CPF/Identif</Label>
                    {payersCols.length > 0 ? (
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={docCol}
                        onChange={(e) => setDocCol(e.target.value)}
                      >
                        {payersCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={docCol}
                        onChange={(e) => setDocCol(e.target.value)}
                        placeholder="Nome da coluna"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={useDbCeps} onCheckedChange={setUseDbCeps} id="use-db" />
                    <Label htmlFor="use-db" className="flex items-center gap-1 text-sm cursor-pointer">
                      <Database className="h-3.5 w-3.5" />
                      Usar base do banco
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={runMatch}
                    disabled={isProcessing || payersData.length === 0}
                    className="gap-2"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>Processando...</>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Executar Match Completo ({payersData.length} linhas)
                      </>
                    )}
                  </Button>
                  {waContacts.length > 0 && payersData.length > 0 && (
                    <Button
                      onClick={runPhoneOnly}
                      variant="outline"
                      className="gap-2"
                      size="lg"
                    >
                      <Phone className="h-4 w-4" />
                      Só Telefones
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Config sliders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Thresholds
                </CardTitle>
                <CardDescription className="text-xs">
                  Pesos: token {config.token_weight} / seq {config.seq_weight}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SliderField
                  label="Bairro fuzzy"
                  value={config.bairro_fuzzy_threshold}
                  min={0.1}
                  max={0.9}
                  step={0.001}
                  onChange={(v) => setConfig((c) => ({ ...c, bairro_fuzzy_threshold: v }))}
                />
                <SliderField
                  label="Min score logradouro"
                  value={config.min_score_logradouro}
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  onChange={(v) => setConfig((c) => ({ ...c, min_score_logradouro: v }))}
                />
                <SliderField
                  label="Token threshold"
                  value={config.token_threshold}
                  min={0.5}
                  max={1}
                  step={0.01}
                  onChange={(v) => setConfig((c) => ({ ...c, token_threshold: v }))}
                />
                <SliderField
                  label="Ambiguous gap"
                  value={config.ambiguous_gap}
                  min={0.01}
                  max={0.2}
                  step={0.005}
                  onChange={(v) => setConfig((c) => ({ ...c, ambiguous_gap: v }))}
                />
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={config.fallback_global}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, fallback_global: v }))}
                    id="fallback"
                  />
                  <Label htmlFor="fallback" className="text-sm cursor-pointer">
                    Fallback global
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Update payers result */}
          {updatePayersResult && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span><strong>{updatePayersResult.updated}</strong> pagadores atualizados</span>
                  <span><strong>{updatePayersResult.created}</strong> novos criados</span>
                  {updatePayersResult.errors > 0 && (
                    <span className="text-destructive"><strong>{updatePayersResult.errors}</strong> erros</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}


          {isProcessing && (
            <Card>
              <CardContent className="py-8 flex flex-col items-center gap-3">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground">Processando {payersData.length} registros...</p>
              </CardContent>
            </Card>
          )}

          {/* Phone-only results (when no address match) */}
          {phoneResults.length > 0 && !response && (
            <>
              <div className="grid gap-3 grid-cols-3">
                <SummaryCard label="Telefones" value={phoneSummary.total} icon={Phone} color="text-foreground" />
                <SummaryCard label="Encontrados" value={phoneSummary.found} icon={CheckCircle2} color="text-emerald-600" pct={Math.round((phoneSummary.found / Math.max(phoneSummary.total, 1)) * 100)} />
                <SummaryCard label="Não encontrados" value={phoneSummary.notFound} icon={XCircle} color="text-red-600" />
              </div>
              <PhoneResultsTable results={phoneResults} />
            </>
          )}

          {/* Results */}
          {response && (
            <>
              {/* Summary cards */}
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                <SummaryCard
                  label="Total"
                  value={summary!.total}
                  icon={FileText}
                  color="text-foreground"
                />
                <SummaryCard
                  label="Match OK"
                  value={summary!.matched}
                  icon={CheckCircle2}
                  color="text-emerald-600"
                  pct={matchPct}
                />
                <SummaryCard
                  label="Revisão"
                  value={summary!.review}
                  icon={AlertTriangle}
                  color="text-amber-600"
                />
                <SummaryCard
                  label="Falha"
                  value={summary!.failed}
                  icon={XCircle}
                  color="text-red-600"
                />
                {phoneResults.length > 0 && (
                  <SummaryCard
                    label="Tel. encontrados"
                    value={phoneSummary.found}
                    icon={Phone}
                    color="text-emerald-600"
                    pct={Math.round((phoneSummary.found / Math.max(phoneSummary.total, 1)) * 100)}
                  />
                )}
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Base CEPs: {response.cep_base_size} registros
                </span>
                <span>Bairros únicos: {response.bairro_index_size}</span>
                <span>
                  Pesos: token={response.config.token_weight} / seq={response.config.seq_weight}
                </span>
                {phoneResults.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Contatos WA: {waContacts.length}
                  </span>
                )}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="results">
                <TabsList>
                  <TabsTrigger value="results" className="gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Resultados
                  </TabsTrigger>
                  {phoneResults.length > 0 && (
                    <TabsTrigger value="phones" className="gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      Telefones ({phoneSummary.found}/{phoneSummary.total})
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="bairros" className="gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Bairros
                  </TabsTrigger>
                  <TabsTrigger value="failures" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Falhas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Endereço</TableHead>
                            <TableHead>Bairro Gate</TableHead>
                            <TableHead>Bairro Score</TableHead>
                            <TableHead>Log. Score</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead className="min-w-[200px]">Endereço Canônico</TableHead>
                            <TableHead>CEP</TableHead>
                            <TableHead>Review</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.results.slice(0, 200).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[250px] truncate">
                                {String(r.endereco_usado || "")}
                              </TableCell>
                              <TableCell>
                                <GateBadge gate={String(r.bairro_gate || "")} />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {Number(r.bairro_score || 0).toFixed(3)}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {Number(r.logradouro_score || 0).toFixed(3)}
                              </TableCell>
                              <TableCell>
                                {r.match_ok ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell className="text-xs max-w-[250px] truncate">
                                {String(r.matched_endereco_completo || "—")}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {String(r.matched_cep || "")}
                              </TableCell>
                              <TableCell>
                                {r.review_status === "REVIEW" && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-500/40">
                                    {String(r.review_reason || "REVIEW")}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {response.results.length > 200 && (
                      <p className="text-xs text-muted-foreground p-3 border-t">
                        Mostrando 200 de {response.results.length}. Exporte o CSV para ver todos.
                      </p>
                    )}
                  </Card>
                </TabsContent>

                {phoneResults.length > 0 && (
                  <TabsContent value="phones">
                    <PhoneResultsTable results={phoneResults} />
                  </TabsContent>
                )}

                <TabsContent value="bairros">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bairro candidato</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead>Gate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.diagnostics.topBairros.map((b, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{b.bairro}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                              <TableCell>
                                <GateBadge gate={b.gate} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </TabsContent>

                <TabsContent value="failures">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[250px]">Endereço</TableHead>
                            <TableHead>Bairro Gate</TableHead>
                            <TableHead>Bairro Score</TableHead>
                            <TableHead>Log. Score</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.diagnostics.failures.map((f, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[300px] truncate">{f.endereco}</TableCell>
                              <TableCell>
                                <GateBadge gate={f.bairro_gate} />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {f.bairro_score.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {f.logradouro_score.toFixed(3)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {f.review_reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {response.diagnostics.failures.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Nenhuma falha encontrada 🎉
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}

// ── Sub-components ──

function PhoneResultsTable({ results }: { results: PhoneMatchResult[] }) {
  return (
    <Card>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Pagador</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Match via</TableHead>
              <TableHead>Nome WA</TableHead>
              <TableHead>Nome Público</TableHead>
              <TableHead>Labels</TableHead>
              <TableHead>Empresa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.slice(0, 300).map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{r.payer_name}</TableCell>
                <TableCell className="text-xs font-mono">{r.payer_phone}</TableCell>
                <TableCell>
                  {r.wa_found ? (
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/40" variant="outline">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Encontrado
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-600 border-red-500/40" variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />
                      Não encontrado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {r.match_type === "nome" ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/40">Nome</Badge>
                  ) : r.match_type === "telefone" ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/40">Telefone</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-xs">{r.wa_saved_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.wa_public_name || "—"}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{r.wa_labels || "—"}</TableCell>
                <TableCell>
                  {r.wa_is_business && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Empresa
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {results.length > 300 && (
        <p className="text-xs text-muted-foreground p-3 border-t">
          Mostrando 300 de {results.length}. Exporte o CSV para ver todos.
        </p>
      )}
    </Card>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{value.toFixed(3)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  pct,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  pct?: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">
            {label}
            {pct !== undefined && ` (${pct}%)`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GateBadge({ gate }: { gate: string }) {
  const map: Record<string, string> = {
    EXACT: "border-emerald-500/40 text-emerald-600 bg-emerald-500/5",
    FUZZY: "border-amber-500/40 text-amber-600 bg-amber-500/5",
    FAIL: "border-red-500/40 text-red-600 bg-red-500/5",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${map[gate] || ""}`}>
      {gate || "—"}
    </Badge>
  );
}
