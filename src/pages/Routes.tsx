import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { usePayers, PayersFilters } from "@/hooks/usePayers";
import { StatusBadge, mapPayerStatus } from "@/components/ui/status-badge";
import { formatCEP } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Users
} from "lucide-react";

function RoutesSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export default function Routes() {
  const [filters, setFilters] = useState<PayersFilters>({
    status: "ATIVO",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState<string>("all");

  const { data: payers, isLoading } = usePayers({
    ...filters,
    search: searchTerm || undefined,
  });

  const isReview = (p: { needs_review: boolean | null; match_ok: boolean | null }) =>
    !!p.needs_review || p.match_ok === false;

  // Filter by additional criteria
  const filteredPayers = payers?.filter((p) => {
    if (neighborhoodFilter && !p.neighborhood?.toLowerCase().includes(neighborhoodFilter.toLowerCase())) {
      return false;
    }
    if (matchFilter === "matched" && !p.match_ok) return false;
    if (matchFilter === "unmatched" && p.match_ok) return false;
    if (matchFilter === "review" && !isReview(p)) return false;
    return true;
  });

  // Calculate stats
  const routeStats = {
    BARRETOS: filteredPayers?.filter((p) => p.default_route === "BARRETOS").length || 0,
    FRANCA: filteredPayers?.filter((p) => p.default_route === "FRANCA").length || 0,
    DESCONHECIDO: filteredPayers?.filter((p) => p.default_route === "DESCONHECIDO").length || 0,
  };

  const matchStats = {
    matched: filteredPayers?.filter((p) => p.match_ok).length || 0,
    unmatched: filteredPayers?.filter((p) => !p.match_ok).length || 0,
    needsReview: filteredPayers?.filter((p) => isReview(p)).length || 0,
  };

  // Get unique neighborhoods
  const neighborhoods = [...new Set(payers?.map((p) => p.neighborhood).filter(Boolean))].sort();

  return (
    <MainLayout>
      <PageTransition>
      <div className="page-header">
        <h1 className="page-title">Rotas</h1>
        <p className="page-subtitle">
          Organiza??o de pagadores por endere?o e rota
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{routeStats.BARRETOS}</p>
              <p className="text-xs text-muted-foreground">Barretos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">{routeStats.FRANCA}</p>
              <p className="text-xs text-muted-foreground">Franca</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{routeStats.DESCONHECIDO}</p>
              <p className="text-xs text-muted-foreground">Desconhecido</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{matchStats.matched}</p>
              <p className="text-xs text-muted-foreground">Endere?o OK</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{matchStats.unmatched}</p>
              <p className="text-xs text-muted-foreground">N?o Validado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-review">{matchStats.needsReview}</p>
              <p className="text-xs text-muted-foreground">Revis?o</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Input
          placeholder="Filtrar bairro..."
          value={neighborhoodFilter}
          onChange={(e) => setNeighborhoodFilter(e.target.value)}
          className="w-[180px]"
        />

        <Select
          value={filters.route || "all"}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, route: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Rota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Rotas</SelectItem>
            <SelectItem value="BARRETOS">Barretos</SelectItem>
            <SelectItem value="FRANCA">Franca</SelectItem>
            <SelectItem value="DESCONHECIDO">Desconhecido</SelectItem>
          </SelectContent>
        </Select>

        <Select value={matchFilter} onValueChange={setMatchFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Match" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="matched">Endere?o OK</SelectItem>
            <SelectItem value="unmatched">N?o Validado</SelectItem>
            <SelectItem value="review">Precisa Revis?o</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFilters({ status: "ATIVO" });
            setSearchTerm("");
            setNeighborhoodFilter("");
            setMatchFilter("all");
          }}
        >
          <Filter className="h-4 w-4 mr-2" />
          Limpar
        </Button>

        <Badge variant="outline" className="ml-auto gap-1">
          <Users className="h-3 w-3" />
          {filteredPayers?.length || 0} resultados
        </Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <RoutesSkeleton />
            </div>
          ) : filteredPayers && filteredPayers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nome</TableHead>
                  <TableHead>Rua</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>CEP</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Rota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayers.map((payer) => (
                  <TableRow key={payer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{payer.name}</span>
                        {isReview(payer) && (
                          <AlertTriangle className="h-4 w-4 text-review" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payer.street || (
                        <span className="text-muted-foreground italic">
                          {payer.address_original?.substring(0, 30)}...
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{payer.neighborhood || "-"}</TableCell>
                    <TableCell>{payer.city || "-"}</TableCell>
                    <TableCell className="font-mono">
                      {payer.cep ? formatCEP(payer.cep) : "-"}
                    </TableCell>
                    <TableCell>
                      {payer.match_ok ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payer.default_route === "BARRETOS"
                            ? "default"
                            : payer.default_route === "FRANCA"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {payer.default_route}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Nenhum pagador encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou importe novos pagadores
              </p>
            </div>
          )}
        </CardContent>
      </Card>
          </PageTransition>
</MainLayout>
  );
}

