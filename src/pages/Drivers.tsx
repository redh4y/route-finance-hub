import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { useDrivers, type Driver } from "@/hooks/useDrivers";
import { UserCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Drivers() {
  const { drivers, isLoading, createDriver, updateDriver, deleteDriver } = useDrivers();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("ATIVO");

  const resetForm = () => { setName(""); setCpf(""); setRg(""); setAddress(""); setPhone(""); setStatus("ATIVO"); };

  const handleCreate = () => {
    createDriver.mutate({ name, cpf: cpf || null, rg: rg || null, address: address || null, phone: phone || null, status }, {
      onSuccess: () => { setShowCreate(false); resetForm(); },
    });
  };

  const openEdit = (d: Driver) => {
    setEditing(d); setName(d.name); setCpf(d.cpf || ""); setRg(d.rg || "");
    setAddress(d.address || ""); setPhone(d.phone || ""); setStatus(d.status);
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateDriver.mutate({ id: editing.id, name, cpf: cpf || null, rg: rg || null, address: address || null, phone: phone || null, status }, {
      onSuccess: () => { setEditing(null); resetForm(); },
    });
  };

  const formFields = (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Nome completo *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>CPF</Label><Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
        <div className="space-y-2"><Label>RG</Label><Input value={rg} onChange={e => setRg(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
      <div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div><p className="text-sm font-medium">Ativo</p></div>
        <Switch checked={status === "ATIVO"} onCheckedChange={(v) => setStatus(v ? "ATIVO" : "INATIVO")} />
      </div>
    </div>
  );

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Motoristas</h1>
            <p className="page-subtitle">Cadastro de motoristas da frota</p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Motorista
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : drivers.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground">Nenhum motorista cadastrado</p>
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="lg:hidden space-y-3">
                  {drivers.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{d.name}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {d.cpf && <span>{d.cpf}</span>}
                          {d.phone && <><span>·</span><span>{d.phone}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant={d.status === "ATIVO" ? "secondary" : "outline"}>{d.status === "ATIVO" ? "Ativo" : "Inativo"}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Dialog>
                          <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Excluir motorista?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                              <Button variant="destructive" onClick={() => deleteDriver.mutate(d.id)}>Excluir</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="w-[90px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>{d.cpf || "—"}</TableCell>
                          <TableCell>{d.phone || "—"}</TableCell>
                          <TableCell><Badge variant={d.status === "ATIVO" ? "secondary" : "outline"}>{d.status === "ATIVO" ? "Ativo" : "Inativo"}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                              <Dialog>
                                <DialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Excluir motorista?</DialogTitle></DialogHeader>
                                  <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                                    <Button variant="destructive" onClick={() => deleteDriver.mutate(d.id)}>Excluir</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Motorista</DialogTitle></DialogHeader>
            {formFields}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createDriver.isPending || !name.trim()}>Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Motorista</DialogTitle></DialogHeader>
            {formFields}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={updateDriver.isPending || !name.trim()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
