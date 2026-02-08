import * as React from "react";

export type DiagnosticsLevel = "error" | "warn" | "info";
export type DiagnosticsSource = "console" | "window" | "fetch" | "app";

export type DiagnosticsEntry = {
  id: string;
  ts: string;
  level: DiagnosticsLevel;
  source: DiagnosticsSource;
  message: string;
  details?: string;
};

type DiagnosticsContextValue = {
  entries: DiagnosticsEntry[];
  clear: () => void;
  add: (entry: Omit<DiagnosticsEntry, "id" | "ts"> & { ts?: string }) => void;
};

const DiagnosticsContext = React.createContext<DiagnosticsContextValue | null>(null);

const STORAGE_KEY = "tavares_diagnostics_entries_v1";
const MAX_ENTRIES = 400;

function redactSecrets(input: unknown): string {
  const raw = typeof input === "string" ? input : JSON.stringify(input);

  // Basic redactions for bearer tokens / api keys if they ever appear
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._]+/g, "Bearer [redacted]")
    .replace(/apikey\s*[:=]\s*[A-Za-z0-9\-._]+/gi, "apikey=[redacted]");
}

function safeJoin(args: unknown[]): { message: string; details?: string } {
  if (args.length === 0) return { message: "" };
  const [first, ...rest] = args;
  const message = redactSecrets(first);
  const details = rest.length ? redactSecrets(rest) : undefined;
  return { message, details };
}

function loadStored(): DiagnosticsEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

function store(entries: DiagnosticsEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // ignore
  }
}

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<DiagnosticsEntry[]>(() => loadStored());

  const add = React.useCallback<DiagnosticsContextValue["add"]>((entry) => {
    const next: DiagnosticsEntry = {
      id: crypto.randomUUID(),
      ts: entry.ts ?? new Date().toISOString(),
      level: entry.level,
      source: entry.source,
      message: entry.message,
      details: entry.details,
    };

    setEntries((prev) => {
      const updated = [...prev, next].slice(-MAX_ENTRIES);
      store(updated);
      return updated;
    });
  }, []);

  const clear = React.useCallback(() => {
    setEntries([]);
    store([]);
  }, []);

  React.useEffect(() => {
    // console intercept
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const scheduleAdd = (entry: Omit<DiagnosticsEntry, "id" | "ts">) => {
      queueMicrotask(() => add(entry));
    };

    console.error = (...args: unknown[]) => {
      const { message, details } = safeJoin(args);
      scheduleAdd({ level: "error", source: "console", message, details });
      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      const { message, details } = safeJoin(args);
      scheduleAdd({ level: "warn", source: "console", message, details });
      originalWarn(...args);
    };

    console.info = (...args: unknown[]) => {
      const { message, details } = safeJoin(args);
      scheduleAdd({ level: "info", source: "console", message, details });
      originalInfo(...args);
    };

    // window errors
    const onError = (ev: ErrorEvent) => {
      add({
        level: "error",
        source: "window",
        message: ev.message || "window.error",
        details: ev.error ? redactSecrets(ev.error) : undefined,
      });
    };

    const onUnhandled = (ev: PromiseRejectionEvent) => {
      add({
        level: "error",
        source: "window",
        message: "unhandledrejection",
        details: redactSecrets(ev.reason),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);

    // fetch intercept (only logs URL + status, no bodies/headers)
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      if (!res.ok) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method || (typeof input === "object" && "method" in input ? (input as Request).method : "GET");
        add({
          level: "error",
          source: "fetch",
          message: `${method} ${new URL(url, window.location.origin).pathname} -> ${res.status}`,
        });
      }
      return res;
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.fetch = originalFetch;
    };
  }, [add]);

  const value = React.useMemo<DiagnosticsContextValue>(
    () => ({ entries, clear, add }),
    [entries, clear, add]
  );

  return <DiagnosticsContext.Provider value={value}>{children}</DiagnosticsContext.Provider>;
}

export function useDiagnostics() {
  const ctx = React.useContext(DiagnosticsContext);
  if (!ctx) throw new Error("useDiagnostics must be used within DiagnosticsProvider");
  return ctx;
}
