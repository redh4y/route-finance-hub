import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePayers, PayersFilters } from "@/hooks/usePayers";
import { StatusBadge, mapPayerStatus } from "@/components/ui/status-badge";
import { PayerDetailsModal } from "@/components/payers/PayerDetailsModal";
import { PageTransition, StaggeredList, StaggeredItem } from "@/components/ui/page-transition";
import { formatCPF, formatPhone } from "@/lib/formatters";
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
import { Search, Filter, Users, AlertCircle, Eye, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

function PayersTableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export default function Payers() {
  const [filters, setFilters] = useState<PayersFilters>({
    status: "ATIVO",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);

  const { data: payers, isLoading, error } = usePayers({
    ...filters,
    search: searchTerm || undefined,
  });

  const handleFilterChange = (key: keyof PayersFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Pagadores</h1>
              <p className="page-subtitle">
                Gerenciamento de alunos e cobranças
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {payers?.length || 0} resultados
              </Badge>
            </div>
          </div>
        </div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-wrap items-center gap-4"
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filters.status || "all"}
            onValueChange={(v) => handleFilterChange("status", v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ATIVO">Ativos</SelectItem>
              <SelectItem value="INATIVO">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.billingMode || "all"}
            onValueChange={(v) => handleFilterChange("billingMode", v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="BOLETO">Boleto</SelectItem>
              <SelectItem value="PIX_ONLY">PIX</SelectItem>
              <SelectItem value="MIXED">Misto</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.route || "all"}
            onValueChange={(v) => handleFilterChange("route", v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Rota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="BARRETOS">Barretos</SelectItem>
              <SelectItem value="FRANCA">Franca</SelectItem>
              <SelectItem value="DESCONHECIDO">Desconhecido</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({ status: "ATIVO" });
              setSearchTerm("");
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </motion.div>

        {/* Error state */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mb-6"
          >
            <AlertCircle className="h-5 w-5" />
            <p>Erro ao carregar pagadores: {error.message}</p>
          </motion.div>
        )}

        {/* Table */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border bg-card overflow-hidden"
        >
          {isLoading ? (
            <div className="p-6">
              <PayersTableSkeleton />
            </div>
          ) : payers && payers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="font-semibold">CPF</TableHead>
                  <TableHead className="font-semibold">Telefone</TableHead>
                  <TableHead className="font-semibold">Bairro</TableHead>
                  <TableHead className="font-semibold">Rota</TableHead>
                  <TableHead className="font-semibold">Método</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payers.map((payer, index) => (
                  <motion.tr
                    key={payer.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="group border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    onClick={() => setSelectedPayerId(payer.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{payer.name}</span>
                        {payer.needs_review && (
                          <Badge variant="outline" className="text-xs badge-review">
                            Revisão
                          </Badge>
                        )}
                        {payer.is_coordinator && (
                          <Badge variant="outline" className="text-xs">
                            Coordenador
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payer.document_digits
                        ? formatCPF(payer.document_digits)
                        : payer.payer_code || "-"}
                    </TableCell>
                    <TableCell>
                      {payer.phone ? formatPhone(payer.phone) : "-"}
                    </TableCell>
                    <TableCell>{payer.neighborhood || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{payer.default_route}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payer.billing_mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={mapPayerStatus(payer.status)} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedPayerId(payer.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Nenhum pagador encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou importe novos pagadores
              </p>
            </div>
          )}
        </motion.div>

        {/* Details Modal */}
        <PayerDetailsModal
          payerId={selectedPayerId}
          onClose={() => setSelectedPayerId(null)}
        />
      </PageTransition>
    </MainLayout>
  );
}
