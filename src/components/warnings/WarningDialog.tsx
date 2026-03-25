import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { printWarning, type WarningData } from "@/lib/warning-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { Printer, Save, ChevronsUpDown, Check, AlertTriangle, Bus, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

const INFRACOES = [
  { key: "DESRESPEITO", label: "Desrespeito / Desacato",   detalhe: "a colegas, motoristas ou coordenadores — §2°, §5°, §9°" },
  { key: "BRIGAS",      label: "Brigas e Tumulto",          detalhe: "discussões, provocações ou faltas graves — §3°, §4°" },
  { key: "BARULHO",     label: "Barulho / Perturbação",     detalhe: "som sem fones, gritaria, festinhas — §3°, §5°" },
  { key: "CONSUMO",     label: "Consumo / Porte Proibido",  detalhe: "bebidas alcoólicas, cigarros, armas — §3°" },
  { key: "LIMPEZA",     label: "Limpeza e Conservação",     detalhe: "sujar ou danificar o veículo — §7°" },
  { key: "ASSENTOS",    label: "Assentos",                  detalhe: "ocupação indevida ou reservar com objetos — §8°, §8-A" },
  { key: "OUTRO",       label: "Outro",                     detalhe: "" },
];

interface Payer { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAlunoNome?: string;
  defaultAlunoId?: string;
  onSaved?: () => void;
}

export function WarningDialog({ open, onOpenChange, defaultAlunoNome = "", defaultAlunoId, onSaved }: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  // Payers state
  const [payers, setPayers] = useState<Payer[]>([]);
  const [payerPopoverOpen, setPayerPopoverOpen] = useState(false);
  const [selectedPayerId, setSelectedPayerId] = useState<string | undefined>(defaultAlunoId);

  // Form state
  const [alunoNome, setAlunoNome] = useState(defaultAlunoNome);
  const [coordenadorNome, setCoordenadorNome] = useState(user?.email?.split("@")[0] ?? "");
  const [onibusCor, setOnibusCor] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState(today);
  const [infracoesSelecionadas, setInfracoesSelecionadas] = useState<string[]>([]);
  const [outroMotivo, setOutroMotivo] = useState("");
  const [gravidade, setGravidade] = useState<"LEVE_MODERADA" | "GRAVE">("LEVE_MODERADA");
  const [penalidade, setPenalidade] = useState<"ADVERTENCIA_ESCRITA" | "SUSPENSAO" | "EXCLUSAO">("ADVERTENCIA_ESCRITA");
  const [numeroAdvertencia, setNumeroAdvertencia] = useState<number>(1);
  const [suspensaoDias, setSuspensaoDias] = useState<number>(1);
  const [suspensaoDataInicio, setSuspensaoDataInicio] = useState(today);
  const [suspensaoDataFim, setSuspensaoDataFim] = useState(today);
  const [suspensaoMotivo, setSuspensaoMotivo] = useState<"REINCIDENCIA" | "FALTA_GRAVE">("REINCIDENCIA");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load active payers
  useEffect(() => {
    supabase
      .from("payers")
      .select("id, name")
      .eq("status", "ATIVO")
      .order("name")
      .then(({ data }) => {
        if (data) setPayers(data);
      });
  }, []);

  function selectPayer(payer: Payer) {
    setSelectedPayerId(payer.id);
    setAlunoNome(payer.name);
    setPayerPopoverOpen(false);
  }

  function clearPayer() {
    setSelectedPayerId(undefined);
    setAlunoNome("");
  }

  function toggleInfracao(key: string) {
    setInfracoesSelecionadas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function buildWarningData(): WarningData {
    return {
      aluno_nome: alunoNome.trim(),
      coordenador_nome: coordenadorNome.trim(),
      onibus_cor: onibusCor.trim() || undefined,
      data_ocorrencia: dataOcorrencia,
      infracoes: infracoesSelecionadas,
      outro_motivo: infracoesSelecionadas.includes("OUTRO") ? outroMotivo.trim() : undefined,
      gravidade,
      penalidade,
      numero_advertencia: penalidade === "ADVERTENCIA_ESCRITA" ? numeroAdvertencia : undefined,
      suspensao_dias: penalidade === "SUSPENSAO" ? suspensaoDias : undefined,
      suspensao_data_inicio: penalidade === "SUSPENSAO" ? suspensaoDataInicio : undefined,
      suspensao_data_fim: penalidade === "SUSPENSAO" ? suspensaoDataFim : undefined,
      suspensao_motivo: penalidade === "SUSPENSAO" ? suspensaoMotivo : undefined,
      observacoes: observacoes.trim() || undefined,
    };
  }

  function validate(): boolean {
    if (!alunoNome.trim()) { toast.error("Informe o nome do aluno"); return false; }
    if (!coordenadorNome.trim()) { toast.error("Informe o nome do coordenador"); return false; }
    if (infracoesSelecionadas.length === 0) { toast.error("Selecione ao menos uma infração"); return false; }
    if (infracoesSelecionadas.includes("OUTRO") && !outroMotivo.trim()) {
      toast.error("Descreva o motivo da infração 'Outro'"); return false;
    }
    return true;
  }

  async function handleSaveAndPrint() {
    if (!validate()) return;
    setIsSaving(true);
    const data = buildWarningData();
    const { error } = await supabase.from("student_warnings").insert({
      aluno_nome: data.aluno_nome,
      aluno_id: selectedPayerId ?? null,
      coordenador_nome: data.coordenador_nome,
      onibus_cor: data.onibus_cor ?? null,
      data_ocorrencia: data.data_ocorrencia,
      infracoes: data.infracoes,
      outro_motivo: data.outro_motivo ?? null,
      gravidade: data.gravidade,
      penalidade: data.penalidade,
      numero_advertencia: data.numero_advertencia ?? null,
      suspensao_dias: data.suspensao_dias ?? null,
      suspensao_data_inicio: data.suspensao_data_inicio ?? null,
      suspensao_data_fim: data.suspensao_data_fim ?? null,
      suspensao_motivo: data.suspensao_motivo ?? null,
      observacoes: data.observacoes ?? null,
    });
    setIsSaving(false);
    if (error) {
      toast.error("Erro ao salvar advertência");
      return;
    }
    toast.success("Advertência registrada");
    printWarning(data);
    onSaved?.();
    onOpenChange(false);
    resetForm();
  }

  function handlePrintOnly() {
    if (!validate()) return;
    printWarning(buildWarningData());
  }

  function resetForm() {
    setSelectedPayerId(defaultAlunoId);
    setAlunoNome(defaultAlunoNome);
    setInfracoesSelecionadas([]);
    setOutroMotivo("");
    setGravidade("LEVE_MODERADA");
    setPenalidade("ADVERTENCIA_ESCRITA");
    setNumeroAdvertencia(1);
    setSuspensaoDias(1);
    setSuspensaoDataInicio(today);
    setSuspensaoDataFim(today);
    setSuspensaoMotivo("REINCIDENCIA");
    setObservacoes("");
    setOnibusCor("");
    setDataOcorrencia(today);
  }

  const selectedPayer = payers.find((p) => p.id === selectedPayerId);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Emitir Advertência
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">

            {/* ── Identificação ── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Identificação
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Aluno — combobox */}
                <div className="space-y-1.5">
                  <Label>Aluno(a) *</Label>
                  <Popover open={payerPopoverOpen} onOpenChange={setPayerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn("w-full justify-between font-normal", !alunoNome && "text-muted-foreground")}
                      >
                        <span className="truncate">{alunoNome || "Selecionar aluno ativo…"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar aluno…" />
                        <CommandList>
                          <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                          <CommandGroup>
                            {payers.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => selectPayer(p)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedPayerId === p.id ? "opacity-100" : "opacity-0")} />
                                {p.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedPayer && (
                    <button
                      type="button"
                      onClick={clearPayer}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                {/* Coordenador */}
                <div className="space-y-1.5">
                  <Label>Coordenador(a) *</Label>
                  <Input
                    value={coordenadorNome}
                    onChange={(e) => setCoordenadorNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                {/* Cor do ônibus */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Bus className="h-3.5 w-3.5 text-muted-foreground" /> Cor do Ônibus
                  </Label>
                  <Input
                    value={onibusCor}
                    onChange={(e) => setOnibusCor(e.target.value)}
                    placeholder="ex: Azul"
                  />
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Data da Ocorrência *
                  </Label>
                  <Input
                    type="date"
                    value={dataOcorrencia}
                    onChange={(e) => setDataOcorrencia(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* ── Infrações ── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Infrações *
              </h3>
              <div className="rounded-lg border divide-y">
                {INFRACOES.map((inf) => (
                  <div key={inf.key} className="px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`inf-${inf.key}`}
                        checked={infracoesSelecionadas.includes(inf.key)}
                        onCheckedChange={() => toggleInfracao(inf.key)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`inf-${inf.key}`} className="cursor-pointer flex-1">
                        <span className="text-sm font-medium">{inf.label}</span>
                        {inf.detalhe && (
                          <span className="text-xs text-muted-foreground block">{inf.detalhe}</span>
                        )}
                      </label>
                    </div>
                    {inf.key === "OUTRO" && infracoesSelecionadas.includes("OUTRO") && (
                      <Input
                        className="mt-2 ml-7"
                        value={outroMotivo}
                        onChange={(e) => setOutroMotivo(e.target.value)}
                        placeholder="Descreva o motivo…"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* ── Gravidade ── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Gravidade
              </h3>
              <RadioGroup
                value={gravidade}
                onValueChange={(v) => setGravidade(v as typeof gravidade)}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="LEVE_MODERADA" id="grav-leve" />
                  <label htmlFor="grav-leve" className="text-sm cursor-pointer">Leve / Moderada</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="GRAVE" id="grav-grave" />
                  <label htmlFor="grav-grave" className="text-sm font-medium text-destructive cursor-pointer">
                    Grave (§4° e §9°)
                  </label>
                </div>
              </RadioGroup>
            </section>

            <Separator />

            {/* ── Penalidade ── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Penalidade (§10°)
              </h3>
              <RadioGroup
                value={penalidade}
                onValueChange={(v) => setPenalidade(v as typeof penalidade)}
                className="space-y-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ADVERTENCIA_ESCRITA" id="pen-adv" />
                  <label htmlFor="pen-adv" className="text-sm cursor-pointer">Advertência Escrita</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="SUSPENSAO" id="pen-sus" />
                  <label htmlFor="pen-sus" className="text-sm cursor-pointer">Suspensão Temporária</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="EXCLUSAO" id="pen-exc" />
                  <label htmlFor="pen-exc" className="text-sm font-medium text-destructive cursor-pointer">
                    Exclusão Definitiva
                  </label>
                </div>
              </RadioGroup>

              {/* Campos condicionais — Advertência Escrita */}
              {penalidade === "ADVERTENCIA_ESCRITA" && (
                <div className="ml-6 pt-2 flex items-end gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Qual advertência é essa?</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={numeroAdvertencia}
                        onChange={(e) => setNumeroAdvertencia(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">ª advertência</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos condicionais — Suspensão */}
              {penalidade === "SUSPENSAO" && (
                <div className="ml-6 pt-2 rounded-lg border bg-muted/40 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Dias de suspensão</Label>
                      <Input
                        type="number"
                        min={1}
                        value={suspensaoDias}
                        onChange={(e) => setSuspensaoDias(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data de início</Label>
                      <Input
                        type="date"
                        value={suspensaoDataInicio}
                        onChange={(e) => setSuspensaoDataInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data de fim</Label>
                      <Input
                        type="date"
                        value={suspensaoDataFim}
                        onChange={(e) => setSuspensaoDataFim(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Motivo da suspensão</Label>
                    <RadioGroup
                      value={suspensaoMotivo}
                      onValueChange={(v) => setSuspensaoMotivo(v as typeof suspensaoMotivo)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="REINCIDENCIA" id="sus-rein" />
                        <label htmlFor="sus-rein" className="text-sm cursor-pointer">Reincidência</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="FALTA_GRAVE" id="sus-grave" />
                        <label htmlFor="sus-grave" className="text-sm cursor-pointer">Falta Grave</label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* ── Observações ── */}
            <section className="space-y-1.5 pb-1">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais sobre a ocorrência…"
                rows={3}
              />
            </section>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {infracoesSelecionadas.length > 0 && (
              <span>{infracoesSelecionadas.length} infração(ões) selecionada(s)</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrintOnly}>
              <Printer className="h-4 w-4" />
              Só Imprimir
            </Button>
            <Button className="gap-2" onClick={handleSaveAndPrint} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando…" : "Salvar e Imprimir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
