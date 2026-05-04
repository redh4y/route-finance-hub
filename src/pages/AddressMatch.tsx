import { useState, useMemo, useCallback, useEffect } from "react";
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
import { processAllRows, type CepRecord, type MatchConfig as EngineMatchConfig, type BairroAlias } from "@/lib/address-match-engine";
import {
  type GroupedContact,
  type PhoneMatchRow,
  type PhoneMatchConfig,
  readJsonContacts,
  applyPhoneMatch,
  normPhoneDigits,
  formatPhoneE164,
  scoreNamePhone,
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
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  change_type: "new" | "update" | "confirm";
  existing_id?: string;
  changes: { field: string; old_value: string; new_value: string }[];
  update_data: Record<string, unknown>;
}

interface JsonPhoneChange {
  payer_id: string;
  payer_name: string;
  match_type: "phone_found" | "name_match";
  match_score?: number;
  contact_name: string;
  contact_phone: string;
  action: "set_primary" | "set_secondary";
  existing_phone: string;
  existing_secondary: string;
}

interface DbAddressChange {
  payer_id: string;
  payer_name: string;
  address_original: string;
  match_ok: boolean;
  review_reason: string;
  changes: { field: string; old_value: string; new_value: string }[];
  update_data: Record<string, unknown>;
}

type DbAddressMatchStatus = "idle" | "loading" | "done";

const DEFAULT_CONFIG: MatchConfig = {
  bairro_fuzzy_threshold: 0.405,
  min_score_logradouro: 0.50,
  token_threshold: 0.82,
  ambiguous_gap: 0.05,
  token_weight: 0.45,
  seq_weight: 0.55,
  fallback_global: false,
};

const RESULTS_PAGE_SIZE = 100;
const FAILURES_PAGE_SIZE = 50;

// Normalize phone: keep only digits, remove +55
function normalizePhone(raw: string): string {
  return normPhoneDigits(raw);
}

function normalizeAliasText(value: string): string {
  return (value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
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
  const [payerAlreadyUpToDate, setPayerAlreadyUpToDate] = useState(0);
  const [showPayerPreviewModal, setShowPayerPreviewModal] = useState(false);
  const [expandedConfirmRows, setExpandedConfirmRows] = useState<Set<number>>(new Set());
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [bairroAliases, setBairroAliases] = useState<BairroAlias[]>([]);
  const [showAliasPanel, setShowAliasPanel] = useState(false);
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [newAliasEntrada, setNewAliasEntrada] = useState("");
  const [newAliasBairroCanon, setNewAliasBairroCanon] = useState("");
  const [newAliasComplemento, setNewAliasComplemento] = useState("");
  const [newAliasMatchType, setNewAliasMatchType] = useState<"EXACT" | "CONTAINS">("CONTAINS");
  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsFilter, setResultsFilter] = useState<"all" | "ok" | "review" | "fail">("all");
  const [resultsPage, setResultsPage] = useState(1);
  const [failuresPage, setFailuresPage] = useState(1);

  // DB address verify (standalone, sem CSV)
  const [dbAddrStatus, setDbAddrStatus] = useState<DbAddressMatchStatus>("idle");
  const [dbAddrChanges, setDbAddrChanges] = useState<DbAddressChange[]>([]);
  const [dbAddrAlreadyOk, setDbAddrAlreadyOk] = useState(0);
  const [dbAddrNoAddr, setDbAddrNoAddr] = useState(0);
  const [dbAddrReview, setDbAddrReview] = useState(0);
  const [showDbAddrModal, setShowDbAddrModal] = useState(false);
  const [dbAddrSaving, setDbAddrSaving] = useState(false);
  const [dbAddrSaveResult, setDbAddrSaveResult] = useState<{ updated: number; errors: number } | null>(null);
  const [dbAddrOnlyOutdated, setDbAddrOnlyOutdated] = useState(true);

  // JSON-only phone sync (standalone, sem CSV)
  const [jsonSyncContacts, setJsonSyncContacts] = useState<GroupedContact[]>([]);
  const [jsonSyncRaw, setJsonSyncRaw] = useState<RawWaContact[]>([]);
  const [jsonSyncFileName, setJsonSyncFileName] = useState("");
  const [jsonSyncPreview, setJsonSyncPreview] = useState<JsonPhoneChange[]>([]);
  const [jsonSyncAlreadyOk, setJsonSyncAlreadyOk] = useState(0);
  const [jsonSyncLoading, setJsonSyncLoading] = useState(false);
  const [jsonSyncSaving, setJsonSyncSaving] = useState(false);
  const [showJsonSyncModal, setShowJsonSyncModal] = useState(false);
  const [jsonSyncResult, setJsonSyncResult] = useState<{ updated: number; errors: number } | null>(null);
  const [jsonSyncThreshold, setJsonSyncThreshold] = useState(0.6);

  const loadAliases = useCallback(async () => {
    const { data, error } = await supabase
      .from("bairro_aliases")
      .select("id, entrada, bairro_canonico, complemento, match_type, ordem")
      .order("ordem", { ascending: true })
      .order("entrada", { ascending: true });

    if (error) {
      console.error("Erro ao carregar aliases de bairro:", error);
      return;
    }

    setBairroAliases(((data || []) as BairroAlias[]).map((alias) => ({
      ...alias,
      match_type: alias.match_type as "EXACT" | "CONTAINS",
    })));
  }, []);

  useEffect(() => {
    void loadAliases();
  }, [loadAliases]);

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
        bairroAliases,
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

  // ── DB Address Match: run directly against DB payers + DB CEPs ──
  const runDbAddressMatch = async () => {
    setDbAddrStatus("loading");
    setDbAddrChanges([]);
    setDbAddrSaveResult(null);

    try {
      // 1. Fetch CEP base from DB
      toast.loading("Carregando base de CEPs...", { id: "db-addr" });
      const cepBase: CepRecord[] = [];
      let cepPage = 0;
      const CEP_PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("ceps")
          .select("logradouro, bairro, cidade, uf, cep")
          .range(cepPage * CEP_PAGE, (cepPage + 1) * CEP_PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        cepBase.push(...data.map((r) => ({
          logradouro: r.logradouro || "",
          bairro: r.bairro || "",
          cidade: r.cidade || "",
          uf: r.uf || "",
          cep: r.cep || "",
        })));
        if (data.length < CEP_PAGE) break;
        cepPage++;
      }

      if (cepBase.length === 0) throw new Error("Base de CEPs vazia no banco");

      // 2. Fetch all active payers with address fields
      toast.loading(`${cepBase.length} CEPs carregados. Buscando pagadores...`, { id: "db-addr" });
      type PayerAddrRow = {
        id: string; name: string;
        address_original: string | null; address_base: string | null;
        street: string | null; number: string | null; neighborhood: string | null;
        cep: string | null; city: string | null; state: string | null;
        match_ok: boolean | null;
      };
      const allPayers: PayerAddrRow[] = [];
      let payerPage = 0;
      const PAYER_PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("payers")
          .select("id, name, address_original, address_base, street, number, neighborhood, cep, city, state, match_ok")
          .eq("status", "ATIVO")
          .range(payerPage * PAYER_PAGE, (payerPage + 1) * PAYER_PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allPayers.push(...(data as PayerAddrRow[]));
        if (data.length < PAYER_PAGE) break;
        payerPage++;
      }

      // 3. Filter payers that have an address to match
      const payersWithAddr = allPayers.filter((p) => !!(p.address_original || p.address_base));
      const noAddrCount = allPayers.length - payersWithAddr.length;

      toast.loading(`${allPayers.length} pagadores. Processando ${payersWithAddr.length} com endereço...`, { id: "db-addr" });

      // 4. Run match engine using rows format expected by processAllRows
      const rows = payersWithAddr.map((p) => ({
        __payer_id: p.id,
        __payer_name: p.name,
        __current_street: p.street || "",
        __current_number: p.number || "",
        __current_neighborhood: p.neighborhood || "",
        __current_cep: p.cep || "",
        __current_city: p.city || "",
        __current_state: p.state || "",
        __current_match_ok: p.match_ok ?? false,
        endereco_para_match: p.address_original || p.address_base || "",
      }));

      const matchResults = await processAllRows(
        rows,
        cepBase,
        "endereco_para_match",
        config as EngineMatchConfig,
        (processed, total) => {
          if (processed % 100 === 0) {
            const pct = Math.round((processed / total) * 100);
            toast.loading(`Processando endereços ${processed}/${total} (${pct}%)...`, { id: "db-addr" });
          }
        },
        bairroAliases,
      );

      // 5. Compare matched result with current payer data → build change list
      const fieldLabels: Record<string, string> = {
        street: "Rua", number: "Número", neighborhood: "Bairro",
        cep: "CEP", city: "Cidade", state: "UF",
      };

      const changes: DbAddressChange[] = [];
      let alreadyOk = 0;
      let reviewCount = 0;

      for (let i = 0; i < matchResults.length; i++) {
        const r = matchResults[i];
        const orig = rows[i];

        if (r.review_status === "REVIEW") {
          reviewCount++;
          continue;
        }

        if (!r.match_ok) continue;

        const proposed: Record<string, string> = {
          street: String(r.matched_logradouro || ""),
          number: String(r.matched_numero || ""),
          neighborhood: String(r.matched_bairro || ""),
          cep: String(r.matched_cep || "").replace(/\D/g, ""),
          city: String(r.matched_cidade || ""),
          state: String(r.matched_uf || ""),
        };

        const current: Record<string, string> = {
          street: String(orig.__current_street || ""),
          number: String(orig.__current_number || ""),
          neighborhood: String(orig.__current_neighborhood || ""),
          cep: String(orig.__current_cep || "").replace(/\D/g, ""),
          city: String(orig.__current_city || ""),
          state: String(orig.__current_state || ""),
        };

        const fieldChanges: { field: string; old_value: string; new_value: string }[] = [];
        const updateData: Record<string, unknown> = {};

        for (const f of ["street", "number", "neighborhood", "cep", "city", "state"] as const) {
          const newVal = proposed[f];
          const oldVal = current[f];
          if (newVal && newVal.toLowerCase() !== oldVal.toLowerCase()) {
            fieldChanges.push({ field: fieldLabels[f], old_value: oldVal || "—", new_value: newVal });
            updateData[f] = newVal;
          }
        }

        if (!orig.__current_match_ok) {
          updateData.match_ok = true;
        }

        if (fieldChanges.length === 0 && orig.__current_match_ok) {
          alreadyOk++;
          continue;
        }

        if (fieldChanges.length === 0 && !orig.__current_match_ok) {
          // match_ok vai mudar mas endereço já estava certo
          changes.push({
            payer_id: String(orig.__payer_id),
            payer_name: String(orig.__payer_name),
            address_original: String(orig.endereco_para_match),
            match_ok: true,
            review_reason: "",
            changes: [{ field: "Status", old_value: "Sem match", new_value: "Match confirmado" }],
            update_data: { match_ok: true },
          });
          continue;
        }

        changes.push({
          payer_id: String(orig.__payer_id),
          payer_name: String(orig.__payer_name),
          address_original: String(orig.endereco_para_match),
          match_ok: r.match_ok,
          review_reason: r.review_reason || "",
          changes: fieldChanges,
          update_data: { ...updateData, match_ok: true },
        });
      }

      toast.dismiss("db-addr");
      setDbAddrChanges(changes);
      setDbAddrAlreadyOk(alreadyOk);
      setDbAddrNoAddr(noAddrCount);
      setDbAddrReview(reviewCount);
      setDbAddrStatus("done");
      setShowDbAddrModal(true);

      if (changes.length === 0) {
        toast.info(`Todos os endereços já estão atualizados (${alreadyOk} OK, ${reviewCount} em revisão)`);
      } else {
        toast.success(`${changes.length} pagadores com alteração, ${alreadyOk} já OK, ${reviewCount} em revisão`);
      }
    } catch (err) {
      console.error("runDbAddressMatch error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao processar endereços");
      toast.dismiss("db-addr");
      setDbAddrStatus("idle");
    }
  };

  // ── DB Address Match: apply changes ──
  const applyDbAddressChanges = async () => {
    const toApply = dbAddrOnlyOutdated
      ? dbAddrChanges.filter((c) => c.changes.some((ch) => ch.field !== "Status"))
      : dbAddrChanges;
    if (toApply.length === 0) return;
    setDbAddrSaving(true);

    let updated = 0;
    let errors = 0;

    try {
      const BATCH = 50;
      for (let i = 0; i < toApply.length; i += BATCH) {
        const batch = toApply.slice(i, i + BATCH);
        const pct = Math.round(((i + batch.length) / toApply.length) * 100);
        toast.loading(`Salvando ${i + batch.length}/${toApply.length} (${pct}%)...`, { id: "db-addr-save" });

        const results = await Promise.all(
          batch.map((change) =>
            supabase
              .from("payers")
              .update({ ...change.update_data, updated_at: new Date().toISOString() })
              .eq("id", change.payer_id)
              .then(({ error }) => (error ? ("error" as const) : ("ok" as const)))
          )
        );

        for (const r of results) {
          if (r === "ok") updated++;
          else errors++;
        }
      }

      toast.dismiss("db-addr-save");
      setDbAddrSaveResult({ updated, errors });
      setShowDbAddrModal(false);

      if (errors > 0) toast.warning(`${updated} pagadores atualizados, ${errors} erros`);
      else toast.success(`${updated} pagadores atualizados com sucesso`);
    } catch (err) {
      console.error("applyDbAddressChanges error:", err);
      toast.error("Erro ao salvar alterações");
      toast.dismiss("db-addr-save");
    } finally {
      setDbAddrSaving(false);
    }
  };

  // ── JSON Sync: upload handler ──
  const handleJsonSyncUpload = useCallback((file: File) => {
    setJsonSyncFileName(file.name);
    setJsonSyncContacts([]);
    setJsonSyncRaw([]);
    setJsonSyncPreview([]);
    setJsonSyncResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const raw = Array.isArray(data) ? data : (data?.contacts || [data]);
        setJsonSyncRaw(raw as RawWaContact[]);
        const grouped = readJsonContacts(raw);
        setJsonSyncContacts(grouped);
        toast.success(`${file.name}: ${raw.length} contatos → ${grouped.length} agrupados`);
      } catch {
        toast.error("Erro ao ler JSON de contatos");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  // ── JSON Sync: verify contacts against DB payers ──
  const verifyJsonSyncInDb = async () => {
    if (jsonSyncContacts.length === 0) return;
    setJsonSyncLoading(true);
    setJsonSyncPreview([]);

    try {
      toast.loading("Buscando pagadores no banco...", { id: "json-sync" });
      type PayerRow = { id: string; name: string; phone: string | null; phone_secondary: string | null };
      const allPayers: PayerRow[] = [];
      let page = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("payers")
          .select("id, name, phone, phone_secondary")
          .eq("status", "ATIVO")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allPayers.push(...(data as PayerRow[]));
        if (data.length < PAGE_SIZE) break;
        page++;
      }

      toast.loading(`${allPayers.length} pagadores. Verificando ${jsonSyncContacts.length} contatos...`, { id: "json-sync" });

      const preview: JsonPhoneChange[] = [];
      let alreadyOk = 0;

      for (const contact of jsonSyncContacts) {
        if (!contact.phone) continue;

        // Parse all unique phone numbers saved for this contact in the JSON
        const allContactPhones = contact.dup_phones
          ? contact.dup_phones.split(" | ").map((p) => p.trim()).filter(Boolean)
          : [contact.phone];
        const uniquePhoneNorms = [...new Set(allContactPhones.map((p) => normPhoneDigits(p)).filter(Boolean))];
        const hasMultiplePhones = uniquePhoneNorms.length > 1;

        // Find best matching payer by name
        let bestScore = 0;
        let bestPayer: PayerRow | null = null;
        for (const payer of allPayers) {
          const score = scoreNamePhone(contact.name, payer.name);
          if (score > bestScore) {
            bestScore = score;
            bestPayer = payer;
          }
        }

        if (bestScore < jsonSyncThreshold || !bestPayer) continue;

        const existNorm = normPhoneDigits(bestPayer.phone || "");
        const existSecNorm = normPhoneDigits(bestPayer.phone_secondary || "");

        const primaryCandidateNorm = normPhoneDigits(contact.phone);

        if (hasMultiplePhones) {
          // JSON tem 2+ números para esta pessoa → primary = contact.phone, secondary = segundo número
          if (existNorm === primaryCandidateNorm && existSecNorm) {
            alreadyOk++;
            continue;
          }

          // Checar telefone primário do contato
          if (primaryCandidateNorm && existNorm !== primaryCandidateNorm && existSecNorm !== primaryCandidateNorm) {
            preview.push({
              payer_id: bestPayer.id,
              payer_name: bestPayer.name,
              match_type: "name_match",
              match_score: bestScore,
              contact_name: contact.name,
              contact_phone: formatPhoneE164(contact.phone),
              action: existNorm ? "set_secondary" : "set_primary",
              existing_phone: bestPayer.phone || "",
              existing_secondary: bestPayer.phone_secondary || "",
            });
          }

          // Checar telefone secundário do contato (segundo número do JSON)
          const secondNorm = uniquePhoneNorms.find((n) => n !== primaryCandidateNorm);
          const secondRaw = secondNorm ? allContactPhones.find((p) => normPhoneDigits(p) === secondNorm) : undefined;
          if (secondNorm && secondRaw && secondNorm !== existNorm && secondNorm !== existSecNorm && !existSecNorm) {
            preview.push({
              payer_id: bestPayer.id,
              payer_name: bestPayer.name,
              match_type: "name_match",
              match_score: bestScore,
              contact_name: contact.name,
              contact_phone: formatPhoneE164(secondRaw),
              action: "set_secondary",
              existing_phone: bestPayer.phone || "",
              existing_secondary: bestPayer.phone_secondary || "",
            });
          }

          if (existNorm === primaryCandidateNorm || existSecNorm === primaryCandidateNorm) {
            alreadyOk++;
          }
        } else {
          // JSON tem apenas 1 número → sempre atualiza o primário
          if (primaryCandidateNorm && existNorm === primaryCandidateNorm) {
            alreadyOk++;
            continue;
          }

          if (primaryCandidateNorm) {
            preview.push({
              payer_id: bestPayer.id,
              payer_name: bestPayer.name,
              match_type: "name_match",
              match_score: bestScore,
              contact_name: contact.name,
              contact_phone: formatPhoneE164(contact.phone),
              action: "set_primary",
              existing_phone: bestPayer.phone || "",
              existing_secondary: bestPayer.phone_secondary || "",
            });
          }
        }
      }

      toast.dismiss("json-sync");
      setJsonSyncPreview(preview);
      setJsonSyncAlreadyOk(alreadyOk);
      setShowJsonSyncModal(true);

      if (preview.length === 0) {
        toast.info(`Todos os contatos já estão atualizados (${alreadyOk} verificados)`);
      }
    } catch (err) {
      console.error("verifyJsonSyncInDb error:", err);
      toast.error("Erro ao verificar contatos no banco");
      toast.dismiss("json-sync");
    } finally {
      setJsonSyncLoading(false);
    }
  };

  // ── JSON Sync: apply changes ──
  const applyJsonSyncChanges = async () => {
    if (jsonSyncPreview.length === 0) return;
    setJsonSyncSaving(true);

    let updated = 0;
    let errors = 0;

    try {
      const BATCH = 50;
      for (let i = 0; i < jsonSyncPreview.length; i += BATCH) {
        const batch = jsonSyncPreview.slice(i, i + BATCH);
        const pct = Math.round(((i + batch.length) / jsonSyncPreview.length) * 100);
        toast.loading(`Aplicando ${i + batch.length}/${jsonSyncPreview.length} (${pct}%)...`, { id: "json-apply" });

        const results = await Promise.all(
          batch.map((change) => {
            const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (change.action === "set_primary") {
              updateData.phone = change.contact_phone;
            } else {
              updateData.phone_secondary = change.contact_phone;
            }
            return supabase
              .from("payers")
              .update(updateData)
              .eq("id", change.payer_id)
              .then(({ error }) => (error ? ("error" as const) : ("ok" as const)));
          })
        );

        for (const r of results) {
          if (r === "ok") updated++;
          else errors++;
        }
      }

      toast.dismiss("json-apply");
      setJsonSyncResult({ updated, errors });
      setShowJsonSyncModal(false);
      setJsonSyncPreview([]);

      if (errors > 0) {
        toast.warning(`${updated} pagadores atualizados, ${errors} erros`);
      } else {
        toast.success(`${updated} pagadores atualizados com sucesso`);
      }
    } catch (err) {
      console.error("applyJsonSyncChanges error:", err);
      toast.error("Erro ao aplicar alterações");
      toast.dismiss("json-apply");
    } finally {
      setJsonSyncSaving(false);
    }
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
        needs_review: "Revisão pendente",
      };

      const changes: PayerChangePreview[] = [];
      let alreadyUpToDate = 0;

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
          .select("id, document_digits, street, number, neighborhood, cep, city, state, phone, name, needs_review")
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
          // Se match_ok=true e payer ainda tem needs_review=true → confirmar endereço
          if (matchOk && existing.needs_review === true) {
            updateData.needs_review = false;
            fieldChanges.push({
              field: fieldLabels.needs_review,
              old_value: "Pendente",
              new_value: "Confirmado",
            });
          }
          if (fieldChanges.length > 0) {
            // Detectar se é apenas confirmação de needs_review (sem mudança real de dados)
            const isOnlyConfirm = fieldChanges.length === 1 && fieldChanges[0].field === fieldLabels.needs_review;
            if (isOnlyConfirm) {
              // Adicionar linhas informativas para o usuário saber o que está sendo confirmado
              const addrParts = ["street", "number", "neighborhood", "city", "state"]
                .map((f) => updateData[f]).filter(Boolean);
              if (addrParts.length > 0) {
                fieldChanges.push({
                  field: "Endereço confirmado",
                  old_value: "já estava correto",
                  new_value: addrParts.join(", "),
                });
              }
              if (updateData.phone) {
                fieldChanges.push({
                  field: "Telefone confirmado",
                  old_value: "já estava correto",
                  new_value: String(updateData.phone),
                });
              }
            }
            changes.push({
              doc_digits: doc,
              payer_name: String(existing.name || payerName),
              is_new: false,
              change_type: isOnlyConfirm ? "confirm" : "update",
              existing_id: existing.id as string,
              changes: fieldChanges,
              update_data: updateData,
            });
          } else {
            alreadyUpToDate++;
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
              change_type: "new",
              changes: fieldChanges,
              update_data: updateData,
            });
          }
        }
      }

      setPayerChangesPreview(changes);
      setPayerAlreadyUpToDate(alreadyUpToDate);
      setShowPayerPreviewModal(true);

      if (changes.length === 0) {
        toast.info(`Nenhuma alteração necessária — ${alreadyUpToDate} pagadores já estão atualizados`);
      }
    } catch (err) {
      console.error("previewPayerChanges error:", err);
      toast.error("Erro ao verificar pagadores");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── Confirm and execute update (batched for speed) ──
  const confirmUpdatePayers = async () => {
    if (payerChangesPreview.length === 0) return;

    setIsUpdatingPayers(true);
    setUpdatePayersResult(null);
    let updated = 0;
    let created = 0;
    let errors = 0;

    try {
      const updates = payerChangesPreview.filter((change) => !change.is_new && change.existing_id);
      const inserts = payerChangesPreview.filter((change) => change.is_new || !change.existing_id);

      const BATCH = 50;
      for (let i = 0; i < updates.length; i += BATCH) {
        const batch = updates.slice(i, i + BATCH);
        const pct = Math.round(((i + batch.length) / Math.max(updates.length + inserts.length, 1)) * 100);
        toast.loading(`Atualizando ${i + batch.length}/${updates.length + inserts.length} (${pct}%)...`, { id: "update-payers" });

        const results = await Promise.all(
          batch.map((change) => {
            const data = { ...change.update_data, updated_at: new Date().toISOString() };
            return supabase
              .from("payers")
              .update(data)
              .eq("id", change.existing_id!)
              .then(({ error }) => {
                if (error) {
                  console.error("Update error:", error);
                  return "error" as const;
                }
                return "ok" as const;
              });
          })
        );

        for (const result of results) {
          if (result === "ok") updated++;
          else errors++;
        }
      }

      if (inserts.length > 0) {
        const existingDocs = Array.from(new Set(inserts.map((change) => change.doc_digits).filter(Boolean)));
        const existingByDoc = new Map<string, string>();

        if (existingDocs.length > 0) {
          const { data, error } = await supabase
            .from("payers")
            .select("id, document_digits")
            .in("document_digits", existingDocs);

          if (error) throw error;

          for (const payer of data || []) {
            if (payer.document_digits) {
              existingByDoc.set(payer.document_digits, payer.id);
            }
          }
        }

        const insertsToUpdate = inserts.filter((change) => existingByDoc.has(change.doc_digits));
        const insertsToCreate = inserts.filter((change) => !existingByDoc.has(change.doc_digits));

        for (let i = 0; i < insertsToUpdate.length; i += BATCH) {
          const batch = insertsToUpdate.slice(i, i + BATCH);
          const results = await Promise.all(
            batch.map((change) => {
              const existingId = existingByDoc.get(change.doc_digits)!;
              const data = {
                ...change.update_data,
                name: change.payer_name,
                document: change.doc_digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
                document_digits: change.doc_digits,
                document_valid: change.doc_digits.length === 11,
                updated_at: new Date().toISOString(),
              };

              return supabase
                .from("payers")
                .update(data)
                .eq("id", existingId)
                .then(({ error }) => {
                  if (error) {
                    console.error("Insert->update error:", error);
                    return "error" as const;
                  }
                  return "ok" as const;
                });
            })
          );

          for (const result of results) {
            if (result === "ok") updated++;
            else errors++;
          }
        }

        const INSERT_BATCH = 50;
        for (let i = 0; i < insertsToCreate.length; i += INSERT_BATCH) {
          const batch = insertsToCreate.slice(i, i + INSERT_BATCH);
          const pct = Math.round(((updates.length + insertsToUpdate.length + i + batch.length) / Math.max(updates.length + inserts.length, 1)) * 100);
          toast.loading(`Criando ${i + batch.length}/${insertsToCreate.length} novos (${pct}%)...`, { id: "update-payers" });

          const rows = batch.map((change) => ({
            id: crypto.randomUUID(),
            name: change.payer_name,
            document: change.doc_digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
            document_digits: change.doc_digits,
            document_valid: change.doc_digits.length === 11,
            status: "ATIVO",
            needs_review: change.update_data.match_ok !== true,
            ...change.update_data,
          }));

          const { error, data } = await supabase.from("payers").insert(rows as any[]).select("id");
          if (error) {
            console.error("Batch insert error, falling back:", error);
            for (const row of rows) {
              const { error: insertError } = await supabase.from("payers").insert(row as any);
              if (insertError) {
                errors++;
                console.error("Insert error:", insertError);
              } else {
                created++;
              }
            }
          } else {
            created += data?.length || batch.length;
          }
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

  const addAlias = async () => {
    const entrada = normalizeAliasText(newAliasEntrada);
    const bairroCanonico = newAliasBairroCanon.trim();
    const complemento = newAliasComplemento.trim();

    if (!entrada || !bairroCanonico) {
      toast.error("Preencha padr?o e bairro can?nico");
      return;
    }

    setIsSavingAlias(true);
    try {
      const { error } = await supabase.from("bairro_aliases").insert({
        entrada,
        bairro_canonico: bairroCanonico,
        complemento: complemento || null,
        match_type: newAliasMatchType,
      } as any);

      if (error) throw error;

      setNewAliasEntrada("");
      setNewAliasBairroCanon("");
      setNewAliasComplemento("");
      setNewAliasMatchType("CONTAINS");
      await loadAliases();
      toast.success("Alias adicionado");
    } catch (err) {
      console.error("addAlias error:", err);
      toast.error("Erro ao adicionar alias");
    } finally {
      setIsSavingAlias(false);
    }
  };

  const deleteAlias = async (id: string) => {
    try {
      const { error } = await supabase.from("bairro_aliases").delete().eq("id", id);
      if (error) throw error;
      await loadAliases();
      toast.success("Alias removido");
    } catch (err) {
      console.error("deleteAlias error:", err);
      toast.error("Erro ao remover alias");
    }
  };

  const filteredResults = useMemo(() => {
    if (!response?.results) return [];

    const searchDigits = resultsSearch.replace(/\D/g, "");
    const searchText = resultsSearch.trim().toLowerCase();

    return response.results.filter((result) => {
      const matchesFilter =
        resultsFilter === "all"
          ? true
          : resultsFilter === "ok"
            ? result.match_ok === true
            : resultsFilter === "review"
              ? result.review_status === "REVIEW"
              : result.match_ok !== true && result.review_status !== "REVIEW";

      if (!matchesFilter) return false;
      if (!searchText) return true;

      const name = String(result[nameCol] || "").toLowerCase();
      const docRaw = String(result[docCol] || "");
      const docDigits = docRaw.replace(/\D/g, "");

      return name.includes(searchText) || (searchDigits ? docDigits.includes(searchDigits) : docRaw.toLowerCase().includes(searchText));
    });
  }, [response, resultsFilter, resultsSearch, nameCol, docCol]);

  const resultsTotalPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PAGE_SIZE));
  const paginatedResults = filteredResults.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE);

  const failuresTotalPages = Math.max(1, Math.ceil((response?.diagnostics.failures.length || 0) / FAILURES_PAGE_SIZE));
  const paginatedFailures = (response?.diagnostics.failures || []).slice((failuresPage - 1) * FAILURES_PAGE_SIZE, failuresPage * FAILURES_PAGE_SIZE);

  useEffect(() => {
    setResultsPage((page) => Math.min(page, resultsTotalPages));
  }, [resultsTotalPages]);

  useEffect(() => {
    setFailuresPage((page) => Math.min(page, failuresTotalPages));
  }, [failuresTotalPages]);

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

                {/* Phone match config */}
                <div className="border-t pt-4 mt-3 space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Match de Telefones
                  </p>
                  <SliderField
                    label="Phone threshold"
                    value={phoneThreshold}
                    min={0.2}
                    max={0.9}
                    step={0.01}
                    onChange={setPhoneThreshold}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={phoneOverwrite}
                      onCheckedChange={setPhoneOverwrite}
                      id="phone-overwrite"
                    />
                    <Label htmlFor="phone-overwrite" className="text-sm cursor-pointer">
                      Sobrescrever telefone existente
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aliases de bairro */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Aliases de Bairro
                  <Badge variant="secondary">{bairroAliases.length}</Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAliasPanel((v) => !v)}
                >
                  {showAliasPanel ? "Ocultar" : "Gerenciar"}
                </Button>
              </div>
              {!showAliasPanel && (
                <CardDescription className="text-xs">
                  {bairroAliases.length} aliases carregados do banco — clique em "Gerenciar" para adicionar ou remover
                </CardDescription>
              )}
            </CardHeader>
            {showAliasPanel && (
              <CardContent className="space-y-4">
                {/* Add form */}
                <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_0.5fr_auto_auto] items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Padrão (entrada)</Label>
                    <Input
                      placeholder="ex: ANICETO"
                      value={newAliasEntrada}
                      onChange={(e) => setNewAliasEntrada(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bairro canônico</Label>
                    <Input
                      placeholder="ex: Jardim Aniceto"
                      value={newAliasBairroCanon}
                      onChange={(e) => setNewAliasBairroCanon(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Complemento</Label>
                    <Input
                      placeholder="A, B, I…"
                      value={newAliasComplemento}
                      onChange={(e) => setNewAliasComplemento(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={newAliasMatchType}
                      onChange={(e) => setNewAliasMatchType(e.target.value as "EXACT" | "CONTAINS")}
                    >
                      <option value="CONTAINS">CONTAINS</option>
                      <option value="EXACT">EXACT</option>
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1 self-end"
                    onClick={addAlias}
                    disabled={isSavingAlias}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isSavingAlias ? "..." : "Adicionar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Padrão será normalizado automaticamente (UPPERCASE, sem acentos). Use <strong>CONTAINS</strong> para substring e <strong>EXACT</strong> para match exato.
                </p>

                {/* Alias table */}
                {bairroAliases.length > 0 && (
                  <ScrollArea className="h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Padrão</TableHead>
                          <TableHead className="text-xs">Bairro Canônico</TableHead>
                          <TableHead className="text-xs">Comp.</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bairroAliases.map((alias) => (
                          <TableRow key={(alias as BairroAlias & { id: string }).id}>
                            <TableCell className="text-xs font-mono">{alias.entrada}</TableCell>
                            <TableCell className="text-xs">{alias.bairro_canonico}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{alias.complemento || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs py-0">
                                {alias.match_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteAlias((alias as BairroAlias & { id: string }).id!)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            )}
          </Card>

          {/* Verificar Endereços no Banco (standalone) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                Verificar Endereços do Banco vs Base de CEPs
              </CardTitle>
              <CardDescription className="text-xs">
                Compara os endereços cadastrados nos pagadores ativos com a base de CEPs do banco e mostra o que está desatualizado. Usa a mesma engine do match completo, sem precisar de CSV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  onClick={runDbAddressMatch}
                  disabled={dbAddrStatus === "loading"}
                  className="gap-2"
                  variant="outline"
                >
                  <Database className="h-4 w-4" />
                  {dbAddrStatus === "loading" ? "Processando..." : "Verificar endereços no banco"}
                </Button>

                {dbAddrStatus === "done" && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {dbAddrChanges.length} desatualizados
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {dbAddrAlreadyOk} já OK
                    </span>
                    {dbAddrReview > 0 && (
                      <span className="flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" />
                        {dbAddrReview} em revisão
                      </span>
                    )}
                    {dbAddrNoAddr > 0 && (
                      <span className="text-muted-foreground/60">{dbAddrNoAddr} sem endereço</span>
                    )}
                    {dbAddrChanges.length > 0 && (
                      <Button
                        size="sm"
                        className="h-7 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setShowDbAddrModal(true)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Ver e aplicar alterações
                      </Button>
                    )}
                  </div>
                )}

                {dbAddrSaveResult && (
                  <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    {dbAddrSaveResult.updated} atualizados
                    {dbAddrSaveResult.errors > 0 && (
                      <span className="text-destructive">, {dbAddrSaveResult.errors} erros</span>
                    )}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Usa os thresholds configurados no painel à direita. Endereços em revisão (bairro não encontrado) são ignorados.
              </p>
            </CardContent>
          </Card>

          {/* Sincronizar Telefones via JSON (standalone) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                Sincronizar Telefones via JSON
              </CardTitle>
              <CardDescription className="text-xs">
                Importe um JSON de contatos WhatsApp e verifique/atualize os telefones dos pagadores diretamente no banco — sem precisar de CSV. Sufixos de ano (ex: " 26") são removidos automaticamente dos nomes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    JSON de Contatos WhatsApp
                  </Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleJsonSyncUpload(f);
                    }}
                  />
                  {jsonSyncFileName && (
                    <p className="text-xs text-muted-foreground">
                      {jsonSyncFileName} — {jsonSyncRaw.length} contatos → {jsonSyncContacts.length} agrupados
                    </p>
                  )}
                </div>
                <div className="space-y-2 pt-1">
                  <SliderField
                    label="Threshold de nome para match"
                    value={jsonSyncThreshold}
                    min={0.4}
                    max={0.9}
                    step={0.01}
                    onChange={setJsonSyncThreshold}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quanto maior, mais conservador. Recomendado: 0.60
                  </p>
                </div>
              </div>

              {jsonSyncContacts.length > 0 && (
                <div className="flex flex-wrap gap-3 items-center">
                  <Button
                    onClick={verifyJsonSyncInDb}
                    disabled={jsonSyncLoading}
                    className="gap-2"
                  >
                    <Database className="h-4 w-4" />
                    {jsonSyncLoading ? "Verificando..." : `Verificar ${jsonSyncContacts.length} contatos no banco`}
                  </Button>
                  {jsonSyncResult && (
                    <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {jsonSyncResult.updated} atualizados
                      {jsonSyncResult.errors > 0 && (
                        <span className="text-destructive">, {jsonSyncResult.errors} erros</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-2 p-3 border-b">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Buscar por nome ou CPF..."
                          value={resultsSearch}
                          onChange={(e) => { setResultsSearch(e.target.value); setResultsPage(1); }}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <Select value={resultsFilter} onValueChange={(v) => { setResultsFilter(v as typeof resultsFilter); setResultsPage(1); }}>
                        <SelectTrigger className="h-9 w-full sm:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos ({response.results.length})</SelectItem>
                          <SelectItem value="ok">Match OK ({response.summary.matched})</SelectItem>
                          <SelectItem value="review">Revisão ({response.summary.review})</SelectItem>
                          <SelectItem value="fail">Falha ({response.summary.failed})</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
                        {filteredResults.length !== response.results.length && `${filteredResults.length} filtrados · `}
                        pág. {resultsPage}/{resultsTotalPages}
                      </span>
                    </div>
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
                          {paginatedResults.map((r, i) => (
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
                                  const pm = phoneResultsByName.get(String(r[nameCol] || "").toLowerCase());
                                  if (pm && pm.phone_final) {
                                    const isUpdated = pm.phone_match_status === "ATUALIZADO" || pm.phone_match_status === "ATUALIZADO_DUPLICADO";
                                    return <span className={isUpdated ? "text-emerald-600" : ""}>{pm.phone_final}</span>;
                                  }
                                  return String(r[phoneCol] || "") || "—";
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
                          {paginatedResults.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
                                Nenhum resultado com os filtros aplicados.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {resultsTotalPages > 1 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
                        <span>
                          {(resultsPage - 1) * RESULTS_PAGE_SIZE + 1}–{Math.min(resultsPage * RESULTS_PAGE_SIZE, filteredResults.length)} de {filteredResults.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                            disabled={resultsPage <= 1}
                            className="rounded p-1 hover:bg-muted disabled:opacity-40"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="px-2 tabular-nums">{resultsPage} / {resultsTotalPages}</span>
                          <button
                            onClick={() => setResultsPage((p) => Math.min(resultsTotalPages, p + 1))}
                            disabled={resultsPage >= resultsTotalPages}
                            className="rounded p-1 hover:bg-muted disabled:opacity-40"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="phones">
                  {phoneDisplayRows.length > 0 ? (
                    <PhoneResultsTable results={phoneDisplayRows} />
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
                          {paginatedFailures.map((f, i) => (
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
                                Nenhuma falha encontrada
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {failuresTotalPages > 1 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
                        <span>
                          {(failuresPage - 1) * FAILURES_PAGE_SIZE + 1}–{Math.min(failuresPage * FAILURES_PAGE_SIZE, response.diagnostics.failures.length)} de {response.diagnostics.failures.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setFailuresPage((p) => Math.max(1, p - 1))}
                            disabled={failuresPage <= 1}
                            className="rounded p-1 hover:bg-muted disabled:opacity-40"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="px-2 tabular-nums">{failuresPage} / {failuresTotalPages}</span>
                          <button
                            onClick={() => setFailuresPage((p) => Math.min(failuresTotalPages, p + 1))}
                            disabled={failuresPage >= failuresTotalPages}
                            className="rounded p-1 hover:bg-muted disabled:opacity-40"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Modal de preview de alterações */}
        <Dialog open={showPayerPreviewModal} onOpenChange={(open) => { setShowPayerPreviewModal(open); if (!open) setExpandedConfirmRows(new Set()); }}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>Alterações nos Pagadores</DialogTitle>
              <DialogDescription>
                {payerChangesPreview.length === 0
                  ? `Nenhuma alteração necessária — ${payerAlreadyUpToDate} pagadores já estão atualizados.`
                  : [
                      payerChangesPreview.filter(c => c.change_type === "update").length > 0
                        && `${payerChangesPreview.filter(c => c.change_type === "update").length} atualizações`,
                      payerChangesPreview.filter(c => c.change_type === "confirm").length > 0
                        && `${payerChangesPreview.filter(c => c.change_type === "confirm").length} confirmações`,
                      payerChangesPreview.filter(c => c.is_new).length > 0
                        && `${payerChangesPreview.filter(c => c.is_new).length} novos`,
                      payerAlreadyUpToDate > 0
                        && `${payerAlreadyUpToDate} já atualizados`,
                    ].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {payerChangesPreview.length > 0 && (
              <ScrollArea className="flex-1 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>Novo Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payerChangesPreview.map((p, pi) => {
                      const isConfirm = p.change_type === "confirm";
                      const mainChanges = isConfirm ? p.changes.filter(c => c.old_value !== "já estava correto") : p.changes;
                      const infoChanges = isConfirm ? p.changes.filter(c => c.old_value === "já estava correto") : [];
                      const isExpanded = expandedConfirmRows.has(pi);
                      const visibleRowCount = mainChanges.length + (isExpanded ? infoChanges.length : 0);

                      return [
                        ...mainChanges.map((c, ci) => (
                          <TableRow
                            key={`${pi}-${ci}`}
                            className={isConfirm ? "cursor-pointer hover:bg-muted/40" : undefined}
                            onClick={isConfirm && infoChanges.length > 0 ? () => setExpandedConfirmRows(prev => {
                              const next = new Set(prev);
                              next.has(pi) ? next.delete(pi) : next.add(pi);
                              return next;
                            }) : undefined}
                          >
                            {ci === 0 && (
                              <>
                                <TableCell rowSpan={visibleRowCount}>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${
                                      p.change_type === "new"
                                        ? "bg-blue-50 text-blue-700 border-blue-300"
                                        : p.change_type === "confirm"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : "bg-amber-50 text-amber-700 border-amber-300"
                                    }`}
                                  >
                                    {p.change_type === "new" ? "NOVO" : p.change_type === "confirm" ? "CONFIRMAR" : "ATUALIZAR"}
                                  </Badge>
                                </TableCell>
                                <TableCell rowSpan={visibleRowCount} className="text-xs font-medium">
                                  {p.payer_name}
                                </TableCell>
                                <TableCell rowSpan={visibleRowCount} className="text-xs font-mono">
                                  {p.doc_digits}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-xs font-medium">{c.field}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.old_value}</TableCell>
                            <TableCell className="text-xs font-medium text-emerald-600">
                              <span className="flex items-center gap-1">
                                {c.new_value}
                                {ci === mainChanges.length - 1 && isConfirm && infoChanges.length > 0 && (
                                  <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                )}
                              </span>
                            </TableCell>
                          </TableRow>
                        )),
                        ...(isExpanded ? infoChanges.map((c, ci) => (
                          <TableRow
                            key={`${pi}-info-${ci}`}
                            className="bg-muted/20 cursor-pointer"
                            onClick={() => setExpandedConfirmRows(prev => {
                              const next = new Set(prev);
                              next.delete(pi);
                              return next;
                            })}
                          >
                            <TableCell className="text-xs text-muted-foreground pl-4">{c.field}</TableCell>
                            <TableCell className="text-xs text-muted-foreground/60 italic">{c.old_value}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.new_value}</TableCell>
                          </TableRow>
                        )) : []),
                      ];
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <DialogFooter className="flex-shrink-0 gap-2 px-6 py-4 border-t">
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
        {/* Modal: DB address match preview */}
        <Dialog open={showDbAddrModal} onOpenChange={(open) => setShowDbAddrModal(open)}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>Endereços Desatualizados — Preview</DialogTitle>
              <DialogDescription>
                {[
                  dbAddrChanges.length > 0 && `${dbAddrChanges.length} pagadores com alteração`,
                  dbAddrAlreadyOk > 0 && `${dbAddrAlreadyOk} já atualizados`,
                  dbAddrReview > 0 && `${dbAddrReview} em revisão (ignorados)`,
                  dbAddrNoAddr > 0 && `${dbAddrNoAddr} sem endereço cadastrado`,
                ].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {dbAddrChanges.length > 0 && (
              <>
                <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/30">
                  <Switch
                    id="only-outdated"
                    checked={dbAddrOnlyOutdated}
                    onCheckedChange={setDbAddrOnlyOutdated}
                  />
                  <Label htmlFor="only-outdated" className="text-xs cursor-pointer">
                    Mostrar apenas com mudança de dados (excluir só confirmação de match_ok)
                  </Label>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {dbAddrOnlyOutdated
                      ? dbAddrChanges.filter((c) => c.changes.some((ch) => ch.field !== "Status")).length
                      : dbAddrChanges.length}{" "}
                    para aplicar
                  </span>
                </div>

                <ScrollArea className="flex-1 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Pagador</TableHead>
                        <TableHead className="min-w-[200px]">Endereço original</TableHead>
                        <TableHead>Campo</TableHead>
                        <TableHead>Valor atual</TableHead>
                        <TableHead>Novo valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dbAddrOnlyOutdated
                        ? dbAddrChanges.filter((c) => c.changes.some((ch) => ch.field !== "Status"))
                        : dbAddrChanges
                      ).map((change, pi) =>
                        change.changes.map((c, ci) => (
                          <TableRow key={`${pi}-${ci}`}>
                            {ci === 0 && (
                              <>
                                <TableCell
                                  rowSpan={change.changes.length}
                                  className="text-xs font-medium align-top pt-3"
                                >
                                  {change.payer_name}
                                </TableCell>
                                <TableCell
                                  rowSpan={change.changes.length}
                                  className="text-xs text-muted-foreground align-top pt-3 max-w-[220px] truncate"
                                  title={change.address_original}
                                >
                                  {change.address_original}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-xs font-medium">{c.field}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.old_value}</TableCell>
                            <TableCell className="text-xs font-medium text-blue-600">{c.new_value}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            {dbAddrChanges.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="text-sm font-medium">Todos os endereços já estão atualizados</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex-shrink-0 gap-2 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setShowDbAddrModal(false)}>
                Fechar
              </Button>
              {dbAddrChanges.length > 0 && (
                <Button
                  onClick={applyDbAddressChanges}
                  disabled={dbAddrSaving}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  {dbAddrSaving
                    ? "Salvando..."
                    : `Aplicar ${dbAddrOnlyOutdated ? dbAddrChanges.filter((c) => c.changes.some((ch) => ch.field !== "Status")).length : dbAddrChanges.length} alterações`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: preview JSON sync */}
        <Dialog open={showJsonSyncModal} onOpenChange={(open) => setShowJsonSyncModal(open)}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>Sincronizar Telefones — Preview</DialogTitle>
              <DialogDescription>
                {jsonSyncPreview.length === 0
                  ? `Nenhuma alteração necessária — ${jsonSyncAlreadyOk} contatos já estão atualizados.`
                  : [
                      jsonSyncPreview.filter((c) => c.action === "set_primary").length > 0 &&
                        `${jsonSyncPreview.filter((c) => c.action === "set_primary").length} telefones primários`,
                      jsonSyncPreview.filter((c) => c.action === "set_secondary").length > 0 &&
                        `${jsonSyncPreview.filter((c) => c.action === "set_secondary").length} telefones secundários`,
                      jsonSyncAlreadyOk > 0 && `${jsonSyncAlreadyOk} já atualizados`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {jsonSyncPreview.length > 0 && (
              <ScrollArea className="flex-1 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Ação</TableHead>
                      <TableHead>Pagador (banco)</TableHead>
                      <TableHead>Contato (JSON)</TableHead>
                      <TableHead className="w-[70px]">Score</TableHead>
                      <TableHead>Tel. Atual</TableHead>
                      <TableHead>Tel. Sec. Atual</TableHead>
                      <TableHead>Novo Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jsonSyncPreview.map((change, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              change.action === "set_primary"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-violet-50 text-violet-700 border-violet-300"
                            }`}
                          >
                            {change.action === "set_primary" ? "PRIMÁRIO" : "SECUNDÁRIO"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{change.payer_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{change.contact_name}</TableCell>
                        <TableCell className="text-xs font-mono tabular-nums">
                          {change.match_score !== undefined ? change.match_score.toFixed(3) : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{change.existing_phone || "—"}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {change.existing_secondary || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium text-emerald-600">
                          {change.contact_phone}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <DialogFooter className="flex-shrink-0 gap-2 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setShowJsonSyncModal(false)}>
                Cancelar
              </Button>
              {jsonSyncPreview.length > 0 && (
                <Button
                  onClick={applyJsonSyncChanges}
                  disabled={jsonSyncSaving}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  {jsonSyncSaving ? "Aplicando..." : `Confirmar ${jsonSyncPreview.length} alterações`}
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

const PHONE_PAGE_SIZE = 100;

type PhoneFilter = "all" | "updated" | "secondary" | "below" | "shared";

function PhoneResultsTable({ results }: { results: PhoneDisplayRow[] }) {
  const [statusFilter, setStatusFilter] = useState<PhoneFilter>("all");
  const [phonePage, setPhonePage] = useState(1);

  const statusColors: Record<string, string> = {
    ATUALIZADO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/40",
    ATUALIZADO_DUPLICADO: "bg-amber-500/10 text-amber-600 border-amber-500/40",
    JA_TINHA_TELEFONE: "bg-blue-500/10 text-blue-600 border-blue-500/40",
    TELEFONE_SECUNDARIO: "bg-violet-500/10 text-violet-600 border-violet-500/40",
    ABAIXO_THRESHOLD: "bg-red-500/10 text-red-600 border-red-500/40",
    SEM_NOME: "bg-muted text-muted-foreground",
    SEM_MATCH: "bg-muted text-muted-foreground",
  };

  const counts = useMemo(() => ({
    updated: results.filter((r) => r.match.phone_match_status === "ATUALIZADO" || r.match.phone_match_status === "ATUALIZADO_DUPLICADO").length,
    secondary: results.filter((r) => r.match.phone_match_status === "TELEFONE_SECUNDARIO").length,
    below: results.filter((r) => r.match.phone_match_status === "ABAIXO_THRESHOLD").length,
    shared: results.filter((r) => !!r.match.phone_shared_names).length,
  }), [results]);

  const filtered = useMemo(() => {
    if (statusFilter === "updated") return results.filter((r) => r.match.phone_match_status === "ATUALIZADO" || r.match.phone_match_status === "ATUALIZADO_DUPLICADO");
    if (statusFilter === "secondary") return results.filter((r) => r.match.phone_match_status === "TELEFONE_SECUNDARIO");
    if (statusFilter === "below") return results.filter((r) => r.match.phone_match_status === "ABAIXO_THRESHOLD");
    if (statusFilter === "shared") return results.filter((r) => !!r.match.phone_shared_names);
    return results;
  }, [results, statusFilter]);

  const paginated = filtered.slice((phonePage - 1) * PHONE_PAGE_SIZE, phonePage * PHONE_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PHONE_PAGE_SIZE));

  return (
    <Card>
      <div className="flex flex-col sm:flex-row gap-2 p-3 border-b">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as PhoneFilter); setPhonePage(1); }}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({results.length})</SelectItem>
            <SelectItem value="updated">Atualizados ({counts.updated})</SelectItem>
            <SelectItem value="secondary">Secundários ({counts.secondary})</SelectItem>
            <SelectItem value="below">Abaixo threshold ({counts.below})</SelectItem>
            <SelectItem value="shared">Compartilhados ({counts.shared})</SelectItem>
          </SelectContent>
        </Select>
        {filtered.length !== results.length && (
          <span className="text-xs text-muted-foreground self-center">{filtered.length} filtrados</span>
        )}
      </div>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Pagador</TableHead>
              <TableHead>Tel. Original</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nome Match</TableHead>
              <TableHead>Tel. Match</TableHead>
              <TableHead>Tel. Final</TableHead>
              <TableHead>Tel. Secundário</TableHead>
              <TableHead>Dups</TableHead>
              <TableHead>Tel. compartilhado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((r, i) => (
              <TableRow key={i} className={r.match.phone_shared_names ? "bg-orange-500/5" : ""}>
                <TableCell className="text-xs">{r.payer_name}</TableCell>
                <TableCell className="text-xs font-mono">{r.payer_phone || "—"}</TableCell>
                <TableCell className="text-xs font-mono tabular-nums">
                  {r.match.phone_match_score || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${statusColors[r.match.phone_match_status] || ""}`}
                  >
                    {r.match.phone_match_status || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{r.match.phone_match_name || "—"}</TableCell>
                <TableCell className="text-xs font-mono">{r.match.phone_match_phone || "—"}</TableCell>
                <TableCell className="text-xs font-mono">
                  {r.match.phone_final ? (
                    <span className={
                      r.match.phone_match_status === "ATUALIZADO" || r.match.phone_match_status === "ATUALIZADO_DUPLICADO"
                        ? "text-emerald-600 font-medium" : ""
                    }>
                      {r.match.phone_final}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-xs font-mono text-violet-600">
                  {r.match.telefone_secundario || "—"}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {r.match.phone_match_dup_count && Number(r.match.phone_match_dup_count) > 1
                    ? r.match.phone_match_dup_count
                    : "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[180px]">
                  {r.match.phone_shared_names ? (
                    <span className="text-orange-600 font-medium" title={r.match.phone_shared_names}>
                      ⚠ {r.match.phone_shared_names}
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum resultado com o filtro aplicado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <span>
            {(phonePage - 1) * PHONE_PAGE_SIZE + 1}–{Math.min(phonePage * PHONE_PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPhonePage((p) => Math.max(1, p - 1))}
              disabled={phonePage <= 1}
              className="rounded p-1 hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 tabular-nums">{phonePage} / {totalPages}</span>
            <button
              onClick={() => setPhonePage((p) => Math.min(totalPages, p + 1))}
              disabled={phonePage >= totalPages}
              className="rounded p-1 hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
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
