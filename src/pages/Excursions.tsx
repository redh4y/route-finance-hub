import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useExcursions } from "@/hooks/useExcursions";
import { formatCurrency } from "@/lib/formatters";
import { Link } from "react-router-dom";
import { Plus, Bus, MapPin, Calendar, Users, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors: Record<string, string> = {
  RASCUNHO: "outline",
  EM_VENDA: "default",
  LOTADA: "destructive",
  FINALIZADA: "secondary",
  CANCELADA: "outline",
};

const statusLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_VENDA: "Em Venda",
  LOTADA: "Lotada",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export default function Excursions() {
  const { data: excursions, isLoading } = useExcursions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = (excursions || []).filter((e) => {
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((sum, e) => sum + e.seat_price_cents * e.total_seats, 0);
  const totalSeats = filtered.reduce((sum, e) => sum + e.total_seats, 0);

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Excursões</h1>
            <p className="page-subtitle">Gerencie viagens e venda de assentos</p>
          </div>
          <Link to="/excursoes/nova">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Excursão
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Assentos</p>
            <p className="text-2xl font-bold">{totalSeats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Receita Potencial</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Em Venda</p>
            <p className="text-2xl font-bold">
              {(excursions || []).filter((e) => e.status === "EM_VENDA").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="EM_VENDA">Em Venda</SelectItem>
            <SelectItem value="LOTADA">Lotada</SelectItem>
            <SelectItem value="FINALIZADA">Finalizada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Bus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma excursão encontrada</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exc) => (
            <Link key={exc.id} to={`/excursoes/${exc.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{exc.name}</CardTitle>
                    <Badge variant={statusColors[exc.status] as any}>
                      {statusLabels[exc.status] || exc.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {exc.destination}
                      {exc.destination_state ? `/${exc.destination_state}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      {new Date(exc.departure_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{exc.total_seats} assentos</span>
                  </div>
                  {exc.vehicles?.name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bus className="h-4 w-4 shrink-0" />
                      <span className="truncate">{exc.vehicles.name}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="text-sm font-medium">
                      {formatCurrency(exc.seat_price_cents)} / assento
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
