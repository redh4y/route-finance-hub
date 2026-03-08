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
import {
  type GroupedContact,
  type PhoneMatchRow,
  type PhoneMatchConfig,
  readJsonContacts,
  applyPhoneMatch,
  normPhoneDigits,
  formatPhoneE164,
} from "@/lib/phone-match-engine";
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

interface RawWaContact {
  phone_number: string;
  formatted_phone?: string;
  saved_name?: string;
  public_name?: string;
  is_my_contact?: boolean;
  is_business?: boolean;
  labels?: string[];
  country_code?: string;
}

/** Row-level phone match result for display */
interface PhoneDisplayRow {
  payer_name: string;
  payer_phone: string;
  match: PhoneMatchRow;
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

// Normalize phone: keep only digits, remove +55
function normalizePhone(raw: string): string {
  return normPhoneDigits(raw);
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

  // WhatsApp contacts (raw + grouped)
  const [waRawContacts, setWaRawContacts] = useState<RawWaContact[]>([]);
  const [waGrouped, setWaGrouped] = useState<GroupedContact[]>([]);
  const [waFileName, setWaFileName] = useState("");

  // Phone match config
  const [phoneThreshold, setPhoneThreshold] = useState(0.55);
  const [phoneOverwrite, setPhoneOverwrite] = useState(false);

  // Config
  const [config, setConfig] = useState<MatchConfig>({ ...DEFAULT_CONFIG });

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [phoneMatchRows, setPhoneMatchRows] = useState<PhoneMatchRow[]>([]);
  const [phoneDisplayRows, setPhoneDisplayRows] = useState<PhoneDisplayRow[]>([]);
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
    const total = phoneMatchRows.length;
    const updated = phoneMatchRows.filter((r) => r.phone_match_status === "ATUALIZADO" || r.phone_match_status === "ATUALIZADO_DUPLICADO").length;
    const secondary = phoneMatchRows.filter((r) => r.phone_match_status === "TELEFONE_SECUNDARIO").length;
    const below = phoneMatchRows.filter((r) => r.phone_match_status === "ABAIXO_THRESHOLD").length;
    const alreadyHad = phoneMatchRows.filter((r) => r.phone_match_status === "JA_TINHA_TELEFONE").length;
    const found = updated + secondary + alreadyHad;
    return { total, found, updated, secondary, below, alreadyHad, notFound: total - found };
  }, [phoneMatchRows]);

  // Phone results indexed by row index for quick lookup in results table
  const phoneResultsByName = useMemo(() => {
    const map = new Map<string, PhoneMatchRow>();
    for (let i = 0; i < payersData.length && i < phoneMatchRows.length; i++) {
      const name = String(payersData[i][nameCol] || "").toLowerCase();
      if (name) map.set(name, phoneMatchRows[i]);
    }
    return map;
  }, [phoneMatchRows, payersData, nameCol]);

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
        const raw = Array.isArray(data) ? data : (data?.contacts || [data]);
        setWaRawContacts(raw as RawWaContact[]);
        const grouped = readJsonContacts(raw);
        setWaGrouped(grouped);
        toast.success(`${file.name}: ${raw.length} contatos → ${grouped.length} agrupados`);
      } catch {
        toast.error("Erro ao ler JSON de contatos");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  // ── Run phone match using scored engine ──
  const runPhoneMatchEngine = useCallback(() => {
    if (payersData.length === 0 || waGrouped.length === 0) return;

    toast.loading("Aplicando match de telefones (scored)...", { id: "phone-match" });

    const pmConfig: PhoneMatchConfig = {
      threshold: phoneThreshold,
      overwrite: phoneOverwrite,
    };

    const results = applyPhoneMatch(
      payersData,
      waGrouped,
      nameCol,
      phoneCol,
      pmConfig,
      (processed, total) => {
        if (processed % 200 === 0) {
          const pct = Math.round((processed / total) * 100);
          toast.loading(`Match telefones: ${processed}/${total} (${pct}%)...`, { id: "phone-match" });
        }
      },
    );

    setPhoneMatchRows(results);

    // Build display rows
    const display: PhoneDisplayRow[] = [];
    for (let i = 0; i < payersData.length && i < results.length; i++) {
      display.push({
        payer_name: String(payersData[i][nameCol] || ""),
        payer_phone: String(payersData[i][phoneCol] || ""),
        match: results[i],
      });
    }
    setPhoneDisplayRows(display);

    toast.dismiss("phone-match");
    const updated = results.filter((r) => r.phone_match_status === "ATUALIZADO" || r.phone_match_status === "ATUALIZADO_DUPLICADO").length;
    const secondary = results.filter((r) => r.phone_match_status === "TELEFONE_SECUNDARIO").length;
    toast.success(`Match telefones: ${updated} atualizados, ${secondary} secundários de ${results.length}`);
  }, [payersData, waGrouped, nameCol, phoneCol, phoneThreshold, phoneOverwrite]);

  // ── Run match (chunked) ──
  const runMatch = async () => {
    if (payersData.length === 0) {
      toast.error("Carregue o CSV de pagadores primeiro");
      return;
    }

    setIsProcessing(true);
    setResponse(null);
    setPhoneMatchRows([]);
    setPhoneDisplayRows([]);

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

      // 2. Run matching client-side
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

      // 3. Phone match (scored engine)
      let phoneInfo = "";
      if (waGrouped.length > 0) {
        toast.loading("Aplicando match de telefones...", { id: "match-progress" });
        const pmConfig: PhoneMatchConfig = { threshold: phoneThreshold, overwrite: phoneOverwrite };
        const pmResults = applyPhoneMatch(payersData, waGrouped, nameCol, phoneCol, pmConfig);
        setPhoneMatchRows(pmResults);

        const display: PhoneDisplayRow[] = [];
        for (let i = 0; i < payersData.length && i < pmResults.length; i++) {
          display.push({
            payer_name: String(payersData[i][nameCol] || ""),
            payer_phone: String(payersData[i][phoneCol] || ""),
            match: pmResults[i],
          });
        }
        setPhoneDisplayRows(display);

        const updated = pmResults.filter((r) => r.phone_match_status === "ATUALIZADO" || r.phone_match_status === "ATUALIZADO_DUPLICADO").length;
        const secondary = pmResults.filter((r) => r.phone_match_status === "TELEFONE_SECUNDARIO").length;
        phoneInfo = ` | Tel: ${updated} atualizados, ${secondary} secundários`;
      } else {
        phoneInfo = " | ⚠️ JSON de contatos não carregado";
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
      };

      setResponse(matchResponse);
      toast.dismiss("match-progress");
      toast.success(`Processamento concluído em ${elapsed}s: ${matched} matches de ${total}${phoneInfo}`);
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
    if (payersData.length === 0 || waGrouped.length === 0) {
      toast.error("Carregue o CSV de pagadores e o JSON de contatos");
      return;
    }
    runPhoneMatchEngine();
  };

  // ── Import contacts to DB ──
  const importContactsToDb = async () => {
    if (waRawContacts.length === 0) return;
    setIsSavingContacts(true);
    try {
      const PROVIDER_ID = "e5fcf8c4-999c-489f-aff1-cdbad051186a";
      const INSTANCE = "lf-local-202603050919";
      const BATCH_SIZE = 200;
      let saved = 0;
      let errors = 0;

      for (let i = 0; i < waRawContacts.length; i += BATCH_SIZE) {
        const batch = waRawContacts.slice(i, i + BATCH_SIZE).map((c) => ({
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

  // ── Preview payer changes (compare with DB) ──
  const previewPayerChanges = async () => {
    const enriched = getEnrichedResults();
    if (!enriched.length) {
      toast.error("Execute o match primeiro");
      return;
    }

    setIsLoadingPreview(true);
    setPayerChangesPreview([]);

    try {
      // Build phone map from phoneMatchRows (index by row position)
      const phoneByIdx = new Map<number, PhoneMatchRow>();
      for (let i = 0; i < phoneMatchRows.length; i++) {
        phoneByIdx.set(i, phoneMatchRows[i]);
      }

      const fieldLabels: Record<string, string> = {
        street: "Rua", number: "Número", neighborhood: "Bairro",
        cep: "CEP", city: "Cidade", state: "UF", phone: "Telefone",
      };

      const changes: PayerChangePreview[] = [];

      // Collect all doc_digits
      const docMap = new Map<string, Record<string, unknown>[]>();
      for (const row of enriched) {
        const rawDoc = String(row[docCol] || "").replace(/\D/g, "").padStart(11, "0");
        if (!rawDoc || rawDoc === "00000000000") continue;
        if (!docMap.has(rawDoc)) docMap.set(rawDoc, []);
        docMap.get(rawDoc)!.push(row);
      }

      const allDocs = Array.from(docMap.keys());

      // Fetch existing payers in batches
      const existingMap = new Map<string, Record<string, unknown>>();
      const PAGE = 200;
      for (let i = 0; i < allDocs.length; i += PAGE) {
        const batch = allDocs.slice(i, i + PAGE);
        const pct = Math.round(((i + batch.length) / allDocs.length) * 100);
        toast.loading(`Verificando pagadores ${i + 1}-${i + batch.length} (${pct}%)...`, { id: "preview-payers" });

        const { data } = await supabase
          .from("payers")
          .select("id, document_digits, street, number, neighborhood, cep, city, state, phone, name")
          .in("document_digits", batch);

        if (data) {
          for (const p of data) {
            existingMap.set(p.document_digits!, p as Record<string, unknown>);
          }
        }
      }
      toast.dismiss("preview-payers");

      // Compare each row
      for (const [doc, rows] of docMap) {
        const row = rows[0]; // take first row for each doc
        const payerName = String(row[nameCol] || "");
        const matchOk = row.match_ok === true;

        const updateData: Record<string, unknown> = {};
        if (matchOk) {
          const street = String(row.matched_logradouro || "");
          const number = String(row.matched_numero || "");
          const neighborhood = String(row.matched_bairro || row.bairro_candidato || "");
          const cep = String(row.matched_cep || "").replace(/\D/g, "");
          const city = String(row.matched_cidade || "");
          const state = String(row.matched_uf || "");
          if (street) updateData.street = street;
          if (number) updateData.number = number;
          if (neighborhood) updateData.neighborhood = neighborhood;
          if (cep) updateData.cep = cep;
          if (city) updateData.city = city;
          if (state) updateData.state = state;
          updateData.match_ok = true;
          updateData.address_base = String(row[enderecoCol] || "");
          updateData.address_original = String(row[enderecoCol] || "");
        }

        const rawPhone = String(row[phoneCol] || "");
        // Find the phone match row for this enriched row by index
        const rowIdx = enriched.indexOf(row);
        const pm = rowIdx >= 0 && rowIdx < phoneMatchRows.length ? phoneMatchRows[rowIdx] : undefined;
        if (pm && pm.phone_final) {
          updateData.phone = pm.phone_final;
        } else if (rawPhone && rawPhone !== "undefined") {
          updateData.phone = rawPhone;
        }

        const existing = existingMap.get(doc);

        if (existing) {
          // Compare fields - only include if something actually changed
          const fieldChanges: { field: string; old_value: string; new_value: string }[] = [];
          const compareFields = ["street", "number", "neighborhood", "cep", "city", "state", "phone"];
          for (const f of compareFields) {
            if (updateData[f] === undefined) continue;
            const oldVal = String(existing[f] || "").trim();
            const newVal = String(updateData[f] || "").trim();
            if (oldVal.toLowerCase() !== newVal.toLowerCase() && newVal) {
              fieldChanges.push({
                field: fieldLabels[f] || f,
                old_value: oldVal || "—",
                new_value: newVal,
              });
            }
          }
          if (fieldChanges.length > 0) {
            changes.push({
              doc_digits: doc,
              payer_name: String(existing.name || payerName),
              is_new: false,
              existing_id: existing.id as string,
              changes: fieldChanges,
              update_data: updateData,
            });
          }
        } else {
          // New payer
          if (Object.keys(updateData).length > 0 || payerName) {
            const fieldChanges: { field: string; old_value: string; new_value: string }[] = [];
            const compareFields = ["street", "number", "neighborhood", "cep", "city", "state", "phone"];
            for (const f of compareFields) {
              if (updateData[f]) {
                fieldChanges.push({
                  field: fieldLabels[f] || f,
                  old_value: "—",
                  new_value: String(updateData[f]),
                });
              }
            }
            changes.push({
              doc_digits: doc,
              payer_name: payerName,
              is_new: true,
              changes: fieldChanges,
              update_data: updateData,
            });
          }
        }
      }

      setPayerChangesPreview(changes);
      setShowPayerPreviewModal(true);

      if (changes.length === 0) {
        toast.info("Nenhuma alteração necessária — todos os dados já estão atualizados");
      }
    } catch (err) {
      console.error("previewPayerChanges error:", err);
      toast.error("Erro ao verificar pagadores");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── Confirm and execute update ──
  const confirmUpdatePayers = async () => {
    if (payerChangesPreview.length === 0) return;

    setIsUpdatingPayers(true);
    setUpdatePayersResult(null);
    let updated = 0;
    let created = 0;
    let errors = 0;

    try {
      for (let i = 0; i < payerChangesPreview.length; i++) {
        const change = payerChangesPreview[i];
        if (i % 20 === 0) {
          const pct = Math.round(((i + 1) / payerChangesPreview.length) * 100);
          toast.loading(`Atualizando ${i + 1}/${payerChangesPreview.length} (${pct}%)...`, { id: "update-payers" });
        }

        try {
          if (!change.is_new && change.existing_id) {
            const data = { ...change.update_data, updated_at: new Date().toISOString() };
            const { error } = await supabase
              .from("payers")
              .update(data)
              .eq("id", change.existing_id);
            if (error) { errors++; console.error("Update error:", error); }
            else updated++;
          } else {
            const newPayer: Record<string, unknown> = {
              legacy_id: crypto.randomUUID(),
              name: change.payer_name,
              name_lower: change.payer_name.toLowerCase(),
              document: change.doc_digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
              document_digits: change.doc_digits,
              document_valid: change.doc_digits.length === 11,
              ...change.update_data,
            };
            const { error } = await supabase.from("payers").insert(newPayer as any);
            if (error) { errors++; console.error("Insert error:", error); }
            else created++;
          }
        } catch (err) {
          errors++;
          console.error("Row error:", err);
        }
      }

      setUpdatePayersResult({ updated, created, errors });
      toast.dismiss("update-payers");
      setShowPayerPreviewModal(false);
      if (errors > 0) {
        toast.warning(`Pagadores: ${updated} atualizados, ${created} criados, ${errors} erros`);
      } else {
        toast.success(`Pagadores: ${updated} atualizados, ${created} criados`);
      }
    } catch (err) {
      console.error("confirmUpdatePayers error:", err);
      toast.error("Erro ao atualizar pagadores");
    } finally {
      setIsUpdatingPayers(false);
    }
  };



  const getEnrichedResults = () => {
    if (!response?.results) return [];
    let enriched = response.results;
    if (phoneMatchRows.length > 0) {
      enriched = response.results.map((r, idx) => {
        const pm = idx < phoneMatchRows.length ? phoneMatchRows[idx] : undefined;
        const isMatched = pm && pm.phone_match_status !== "SEM_NOME" && pm.phone_match_status !== "SEM_MATCH" && pm.phone_match_status !== "ABAIXO_THRESHOLD";
        return {
          ...r,
          phone_match_score: pm?.phone_match_score || "",
          phone_match_name: pm?.phone_match_name || "",
          phone_match_phone: pm?.phone_match_phone || "",
          phone_match_status: pm?.phone_match_status || "",
          phone_match_dup_count: pm?.phone_match_dup_count || "",
          phone_match_dup_phones: pm?.phone_match_dup_phones || "",
          telefone_secundario: pm?.telefone_secundario || "",
          wa_telefone: pm?.phone_final || "",
          wa_encontrado: isMatched ? "SIM" : "NÃO",
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
                  onClick={previewPayerChanges}
                  disabled={isUpdatingPayers || isLoadingPreview}
                  variant="default"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  {isLoadingPreview ? "Verificando..." : isUpdatingPayers ? "Atualizando..." : "Atualizar Pagadores no Banco"}
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
                        {waFileName} — {waRawContacts.length} contatos → {waGrouped.length} agrupados
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={importContactsToDb}
                        disabled={isSavingContacts || waRawContacts.length === 0}
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
                  {waGrouped.length > 0 && payersData.length > 0 && (
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
          {phoneDisplayRows.length > 0 && !response && (
            <>
              <div className="grid gap-3 grid-cols-3">
                <SummaryCard label="Telefones" value={phoneSummary.total} icon={Phone} color="text-foreground" />
                <SummaryCard label="Atualizados" value={phoneSummary.updated} icon={CheckCircle2} color="text-emerald-600" pct={Math.round((phoneSummary.updated / Math.max(phoneSummary.total, 1)) * 100)} />
                <SummaryCard label="Abaixo threshold" value={phoneSummary.below} icon={XCircle} color="text-red-600" />
              </div>
              <PhoneResultsTable results={phoneDisplayRows} />
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
                {phoneMatchRows.length > 0 && (
                  <SummaryCard
                    label="Tel. atualizados"
                    value={phoneSummary.updated}
                    icon={Phone}
                    color="text-emerald-600"
                    pct={Math.round((phoneSummary.updated / Math.max(phoneSummary.total, 1)) * 100)}
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
                {phoneMatchRows.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Contatos: {waGrouped.length} | Threshold: {phoneThreshold}
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
                  <TabsTrigger value="phones" className="gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Telefones {phoneMatchRows.length > 0 ? `(${phoneSummary.updated}/${phoneSummary.total})` : ""}
                  </TabsTrigger>
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
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead className="min-w-[200px]">Endereço</TableHead>
                            <TableHead>Telefone</TableHead>
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
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {String(r[nameCol] || "")}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {String(r[docCol] || "")}
                              </TableCell>
                              <TableCell className="text-xs max-w-[250px] truncate">
                                {String(r.endereco_usado || "")}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {(() => {
                                  const rawPhone = String(r[phoneCol] || "");
                                  const norm = normalizePhone(rawPhone);
                                  const pm = norm.length >= 8
                                    ? (phoneResultsMap.get(norm) || phoneResultsMap.get(norm.slice(-8)))
                                    : phoneResultsMap.get(String(r[nameCol] || "").toLowerCase());
                                  if (pm?.wa_found && pm.wa_phone) {
                                    return <span className="text-emerald-600">{pm.wa_phone}</span>;
                                  }
                                  return rawPhone || "—";
                                })()}
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

                <TabsContent value="phones">
                  {phoneResults.length > 0 ? (
                    <PhoneResultsTable results={phoneResults} />
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">Match de telefones não foi executado</p>
                        <p className="text-xs mt-1">Carregue o JSON de contatos WhatsApp e execute o match para ver os resultados</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

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

        {/* Modal de preview de alterações */}
        <Dialog open={showPayerPreviewModal} onOpenChange={setShowPayerPreviewModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Alterações nos Pagadores</DialogTitle>
              <DialogDescription>
                {payerChangesPreview.length === 0
                  ? "Nenhuma alteração necessária — todos os dados já estão atualizados."
                  : `${payerChangesPreview.filter(c => !c.is_new).length} atualizações + ${payerChangesPreview.filter(c => c.is_new).length} novos pagadores`}
              </DialogDescription>
            </DialogHeader>

            {payerChangesPreview.length > 0 && (
              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>Novo Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payerChangesPreview.map((p, pi) =>
                      p.changes.map((c, ci) => (
                        <TableRow key={`${pi}-${ci}`}>
                          {ci === 0 && (
                            <>
                              <TableCell rowSpan={p.changes.length}>
                                <Badge variant={p.is_new ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                                  {p.is_new ? "NOVO" : "ATUALIZAR"}
                                </Badge>
                              </TableCell>
                              <TableCell rowSpan={p.changes.length} className="text-xs font-medium">
                                {p.payer_name}
                              </TableCell>
                              <TableCell rowSpan={p.changes.length} className="text-xs font-mono">
                                {p.doc_digits}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-xs font-medium">{c.field}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.old_value}</TableCell>
                          <TableCell className="text-xs font-medium text-emerald-600">{c.new_value}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <DialogFooter className="gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPayerPreviewModal(false)}>
                Cancelar
              </Button>
              {payerChangesPreview.length > 0 && (
                <Button
                  onClick={confirmUpdatePayers}
                  disabled={isUpdatingPayers}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  {isUpdatingPayers ? "Atualizando..." : `Confirmar ${payerChangesPreview.length} alterações`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
