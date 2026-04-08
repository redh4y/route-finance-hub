export const GROUP_COLORS = [
  { value: "blue",   label: "Azul",     badge: "bg-blue-500/15 text-blue-700 border-0" },
  { value: "green",  label: "Verde",    badge: "bg-emerald-500/15 text-emerald-700 border-0" },
  { value: "purple", label: "Roxo",     badge: "bg-purple-500/15 text-purple-700 border-0" },
  { value: "orange", label: "Laranja",  badge: "bg-orange-500/15 text-orange-700 border-0" },
  { value: "red",    label: "Vermelho", badge: "bg-red-500/15 text-red-700 border-0" },
  { value: "pink",   label: "Rosa",     badge: "bg-pink-500/15 text-pink-700 border-0" },
  { value: "teal",   label: "Teal",     badge: "bg-teal-500/15 text-teal-700 border-0" },
  { value: "yellow", label: "Amarelo",  badge: "bg-yellow-500/15 text-yellow-700 border-0" },
];

export function colorBadgeClass(color: string) {
  return GROUP_COLORS.find((c) => c.value === color)?.badge ?? GROUP_COLORS[0].badge;
}

export function colorBorderClass(color: string): string {
  const map: Record<string, string> = {
    red: "border-red-500",
    orange: "border-orange-500",
    purple: "border-purple-500",
    green: "border-emerald-500",
    teal: "border-teal-500",
    pink: "border-pink-500",
    yellow: "border-yellow-500",
    blue: "border-blue-500",
  };
  return map[color] ?? "border-blue-500";
}

export function formatCents(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseCurrencyInput(val: string): number | null {
  const raw = val.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.round(n * 100);
}

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
