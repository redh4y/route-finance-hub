import * as XLSX from "xlsx";

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

/**
 * Export data to Excel (.xlsx) file and trigger download
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const rows = data.map((row) =>
    columns.reduce<Record<string, any>>((acc, col) => {
      acc[col.label] = col.format ? col.format(row[col.key], row) : row[col.key];
      return acc;
    }, {})
  );

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = columns.map((col) => {
    const maxLen = Math.max(
      col.label.length,
      ...data.map((row) => {
        const val = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "");
        return val.length;
      })
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  const rows = data.map((row) =>
    columns.reduce<Record<string, any>>((acc, col) => {
      acc[col.label] = col.format ? col.format(row[col.key], row) : row[col.key];
      return acc;
    }, {})
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to a printable HTML table and open print dialog (PDF via browser)
 */
export function exportToPDF<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  title: string
) {
  const headerCells = columns.map((c) => `<th style="border:1px solid #ddd;padding:8px 12px;background:#f5f5f5;text-align:left;font-size:12px">${c.label}</th>`).join("");
  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((col) => {
          const val = col.format ? col.format(row[col.key], row) : (row[col.key] ?? "");
          return `<td style="border:1px solid #ddd;padding:6px 12px;font-size:11px">${val}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Exportado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
