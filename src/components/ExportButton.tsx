import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { exportToExcel, exportToCSV, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { toast } from "sonner";

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename,
  title,
  disabled,
}: ExportButtonProps<T>) {
  const handleExport = (format: "xlsx" | "csv" | "pdf") => {
    if (!data.length) {
      toast.warning("Nenhum dado para exportar");
      return;
    }

    try {
      switch (format) {
        case "xlsx":
          exportToExcel(data, columns, filename);
          toast.success(`Exportado ${data.length} registros para Excel`);
          break;
        case "csv":
          exportToCSV(data, columns, filename);
          toast.success(`Exportado ${data.length} registros para CSV`);
          break;
        case "pdf":
          exportToPDF(data, columns, title || filename);
          break;
      }
    } catch (err) {
      toast.error("Erro ao exportar dados");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
          <FileText className="h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
          <Printer className="h-4 w-4" />
          PDF (Imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
