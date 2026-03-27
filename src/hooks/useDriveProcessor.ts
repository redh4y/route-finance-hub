import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DriveProcessorFlags = {
  rename_files: boolean;
  skip_already_renamed: boolean;
  debug_mode: boolean;
  save_json_on_drive: boolean;
  skip_already_imported: boolean;
};

export type BoletoResult = {
  read_source: string;
  payer_name: string;
  payer_cpf: string;
  our_number: string;
  digitable_line: string;
  amount: string;
  due_date: string;
  original_file_name: string;
  final_file_name: string;
  file_id: string;
  download_link: string;
  view_link: string;
  success: boolean;
  error: string | null;
  debug_full_text?: string;
  drive_folder_id?: string;
  drive_folder_name?: string;
};

export type GoogleCredentials = {
  client_id: string;
  client_secret: string;
  auth_uri: string;
  token_uri: string;
} | null;

export type OAuthStatus = "disconnected" | "connecting" | "connected" | "error";

type DriveFile = { id: string; name: string };

const STORAGE_KEY_CREDS = "drive_processor_credentials";
const STORAGE_KEY_TOKENS = "drive_processor_tokens";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function parseCredentialsJson(raw: string): GoogleCredentials {
  try {
    const parsed = JSON.parse(raw);
    const web = parsed.web || parsed.installed || parsed;
    if (!web.client_id || !web.client_secret) return null;
    return {
      client_id: web.client_id,
      client_secret: web.client_secret,
      auth_uri: web.auth_uri || "https://accounts.google.com/o/oauth2/auth",
      token_uri: web.token_uri || "https://oauth2.googleapis.com/token",
    };
  } catch {
    return null;
  }
}

function getRedirectUri() {
  return window.location.origin + "/oauth/callback";
}

async function exchangeCodeForTokens(
  creds: NonNullable<GoogleCredentials>,
  code: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || "Falha ao trocar código por token");
  }
  return res.json();
}

async function refreshAccessToken(
  creds: NonNullable<GoogleCredentials>,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("Falha ao renovar token");
  }
  return res.json();
}

async function callEdgeFunction(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("boleto-drive-processor", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Edge function error");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useDriveProcessor() {
  const [credentialsJson, setCredentialsJson] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_CREDS) || "";
  });
  const [credentials, setCredentials] = useState<GoogleCredentials>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CREDS);
    return saved ? parseCredentialsJson(saved) : null;
  });
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("disconnected");
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  const [folderId, setFolderId] = useState("");
  const [flags, setFlags] = useState<DriveProcessorFlags>({
    rename_files: true,
    skip_already_renamed: false,
    debug_mode: false,
    save_json_on_drive: false,
    skip_already_imported: true,
  });
  const [lastSkippedCount, setLastSkippedCount] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BoletoResult[]>([]);
  const [folderName, setFolderName] = useState("");
  const abortRef = useRef(false);

  // Restore tokens — try Supabase user_metadata first, then localStorage fallback
  useEffect(() => {
    async function restoreTokens() {
      try {
        let t: { access_token: string; refresh_token?: string; expires_at?: number } | null = null;

        // 1. Try Supabase user_metadata
        const { data: { user } } = await supabase.auth.getUser();
        const metaTokens = user?.user_metadata?.drive_tokens;
        if (metaTokens?.access_token) {
          t = metaTokens;
        }

        // 2. Fallback to localStorage
        if (!t) {
          const saved = localStorage.getItem(STORAGE_KEY_TOKENS);
          if (saved) t = JSON.parse(saved);
        }

        if (!t?.access_token) return;

        setAccessToken(t.access_token);
        setRefreshToken(t.refresh_token || "");
        setTokenExpiresAt(t.expires_at || 0);

        // Validate
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${t.access_token}` },
        });
        if (res.ok) {
          const info = await res.json();
          setOauthStatus("connected");
          setConnectedEmail(info.email || null);
        } else if (t.refresh_token && credentials) {
          try {
            const newTokens = await refreshAccessToken(credentials, t.refresh_token);
            const expiresAt = Date.now() + newTokens.expires_in * 1000;
            const saved = { access_token: newTokens.access_token, refresh_token: t.refresh_token, expires_at: expiresAt };
            setAccessToken(newTokens.access_token);
            setTokenExpiresAt(expiresAt);
            localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(saved));
            supabase.auth.updateUser({ data: { drive_tokens: saved } }).catch(() => {});
            setOauthStatus("connected");
            const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${newTokens.access_token}` },
            });
            if (infoRes.ok) {
              const info = await infoRes.json();
              setConnectedEmail(info.email || null);
            }
          } catch {
            setOauthStatus("disconnected");
          }
        } else {
          setOauthStatus("disconnected");
        }
      } catch {
        // ignore
      }
    }
    restoreTokens();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  // Handle OAuth code received from popup via postMessage
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!credentials) return;

      if (event.data?.type === "google-oauth-code") {
        const code = event.data.code as string;
        setOauthStatus("connecting");
        try {
          const tokens = await exchangeCodeForTokens(credentials, code);
          setAccessToken(tokens.access_token);
          setRefreshToken(tokens.refresh_token || "");
          const expiresAt = Date.now() + tokens.expires_in * 1000;
          setTokenExpiresAt(expiresAt);
          const savedTokens = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || "",
            expires_at: expiresAt,
          };
          localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(savedTokens));
          supabase.auth.updateUser({ data: { drive_tokens: savedTokens } }).catch(() => {});

          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (res.ok) {
            const info = await res.json();
            setConnectedEmail(info.email || null);
          }
          setOauthStatus("connected");
        } catch {
          setOauthStatus("error");
        }
      }

      if (event.data?.type === "google-oauth-error") {
        setOauthStatus("error");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [credentials]);

  const updateCredentialsJson = useCallback((raw: string) => {
    setCredentialsJson(raw);
    const parsed = parseCredentialsJson(raw);
    setCredentials(parsed);
    if (raw.trim()) {
      localStorage.setItem(STORAGE_KEY_CREDS, raw);
    } else {
      localStorage.removeItem(STORAGE_KEY_CREDS);
    }
  }, []);

  const startOAuth = useCallback(() => {
    if (!credentials) return;
    setOauthStatus("connecting");
    const params = new URLSearchParams({
      client_id: credentials.client_id,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: DRIVE_SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    const url = `${credentials.auth_uri}?${params.toString()}`;
    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(url, "google-oauth", `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      // Fallback: redirect se popup bloqueado
      window.location.href = url;
    }
  }, [credentials]);

  const disconnect = useCallback(() => {
    setAccessToken("");
    setRefreshToken("");
    setTokenExpiresAt(0);
    setOauthStatus("disconnected");
    setConnectedEmail(null);
    localStorage.removeItem(STORAGE_KEY_TOKENS);
    supabase.auth.updateUser({ data: { drive_tokens: null } }).catch(() => {});
  }, []);

  // Ensure fresh token before API calls
  const getValidToken = useCallback(async (): Promise<string> => {
    if (accessToken && tokenExpiresAt > Date.now() + 60_000) {
      return accessToken;
    }
    if (refreshToken && credentials) {
      const newTokens = await refreshAccessToken(credentials, refreshToken);
      const expiresAt = Date.now() + newTokens.expires_in * 1000;
      setAccessToken(newTokens.access_token);
      setTokenExpiresAt(expiresAt);
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify({
        access_token: newTokens.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      }));
      return newTokens.access_token;
    }
    if (accessToken) return accessToken;
    throw new Error("Não autenticado. Conecte ao Google Drive primeiro.");
  }, [accessToken, refreshToken, tokenExpiresAt, credentials]);

  const listFiles = useCallback(async () => {
    const token = await getValidToken();
    const data = await callEdgeFunction("list_pdfs", {
      access_token: token,
      folder_id: folderId.trim(),
    });
    setFolderName(data.folder_name || "");
    return data.files as DriveFile[];
  }, [getValidToken, folderId]);

  const processFiles = useCallback(async () => {
    setIsProcessing(true);
    setResults([]);
    abortRef.current = false;

    const BATCH_SIZE = 5;

    try {
      const allFiles = await listFiles();

      let filesToProcess = allFiles;
      let skippedCount = 0;

      if (flags.skip_already_imported) {
        const { data: existingLinks } = await supabase
          .from("payer_boleto_links")
          .select("file_id")
          .not("file_id", "is", null);
        const alreadyImported = new Set((existingLinks ?? []).map((l: { file_id: string }) => l.file_id).filter(Boolean));
        filesToProcess = allFiles.filter((f) => !alreadyImported.has(f.id));
        skippedCount = allFiles.length - filesToProcess.length;
      }

      setLastSkippedCount(skippedCount);
      setProgress({ current: 0, total: filesToProcess.length });

      const allResults: BoletoResult[] = [];
      const token = await getValidToken();

      // Process in batches of BATCH_SIZE using the process_batch action
      for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
        if (abortRef.current) break;

        const batch = filesToProcess.slice(i, i + BATCH_SIZE);

        try {
          const data = await callEdgeFunction("process_batch", {
            access_token: token,
            folder_id: folderId.trim(),
            files: batch,
            flags,
            concurrency: BATCH_SIZE,
          });

          const batchResults = (data.results || []) as BoletoResult[];
          for (const r of batchResults) {
            allResults.push({
              ...r,
              drive_folder_id: folderId.trim(),
              drive_folder_name: folderName,
            });
          }
        } catch (err: any) {
          // Fallback: mark all files in batch as failed
          for (const file of batch) {
            allResults.push({
              read_source: "error",
              payer_name: "",
              payer_cpf: "",
              our_number: "",
              digitable_line: "",
              amount: "",
              due_date: "",
              original_file_name: file.name,
              final_file_name: file.name,
              file_id: file.id,
              download_link: "",
              view_link: "",
              success: false,
              error: err.message || "Erro desconhecido",
              drive_folder_id: folderId.trim(),
              drive_folder_name: folderName,
            });
          }
        }

        setProgress({ current: Math.min(i + BATCH_SIZE, filesToProcess.length), total: filesToProcess.length });
        setResults([...allResults]);
      }

      // Upload JSON to drive if enabled
      if (flags.save_json_on_drive && allResults.length > 0) {
        try {
          const t = await getValidToken();
          await callEdgeFunction("upload_json", {
            access_token: t,
            folder_id: folderId.trim(),
            json_text: JSON.stringify(allResults, null, 2),
          });
        } catch {
          // non-critical
        }
      }

      return allResults;
    } finally {
      setIsProcessing(false);
    }
  }, [getValidToken, folderId, flags, folderName, listFiles]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const processSingleFile = useCallback(async (driveUrl: string): Promise<BoletoResult | null> => {
    const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error("URL do Drive inválida. Use o link de compartilhamento do arquivo.");
    const fileId = match[1];
    const token = await getValidToken();
    const data = await callEdgeFunction("process_batch", {
      access_token: token,
      folder_id: folderId.trim(),
      files: [{ id: fileId, name: "" }],
      flags,
      concurrency: 1,
    });
    const res = (data.results ?? [])[0] as BoletoResult | undefined;
    return res ?? null;
  }, [getValidToken, folderId, flags]);

  const deleteDuplicateFiles = useCallback(
    async (fileIds: string[]) => {
      const token = await getValidToken();
      const data = await callEdgeFunction("delete_files", {
        access_token: token,
        file_ids: fileIds,
      });
      return data as { deleted: string[]; errors: string[] };
    },
    [getValidToken]
  );

  return {
    credentialsJson,
    updateCredentialsJson,
    credentials,
    accessToken,
    oauthStatus,
    connectedEmail,
    startOAuth,
    disconnect,
    folderId,
    setFolderId,
    flags,
    setFlags,
    isProcessing,
    progress,
    lastSkippedCount,
    results,
    folderName,
    processFiles,
    abort,
    deleteDuplicateFiles,
    processSingleFile,
  };
}

/* ─── Duplicate detection (client-side) ─── */

export function findExactDuplicates(results: BoletoResult[]) {
  const groups = new Map<string, BoletoResult[]>();
  for (const r of results) {
    const key = `${(r.our_number || "").trim()}|${(r.digitable_line || "").trim()}`;
    if (!r.our_number?.trim()) continue;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }
  return Array.from(groups.entries())
    .filter(([, v]) => v.length > 1)
    .map(([key, items]) => ({ key, items }));
}

export function findPossibleReissues(results: BoletoResult[]) {
  const groups = new Map<string, Set<string>>();
  const itemsByKey = new Map<string, BoletoResult[]>();
  for (const r of results) {
    const payer = (r.payer_name || "").trim().toUpperCase();
    const due = (r.due_date || "").trim();
    if (!payer || !due) continue;
    const key = `${payer}|${due}`;
    const ours = groups.get(key) || new Set();
    if (r.our_number?.trim()) ours.add(r.our_number.trim());
    groups.set(key, ours);
    const items = itemsByKey.get(key) || [];
    items.push(r);
    itemsByKey.set(key, items);
  }
  return Array.from(groups.entries())
    .filter(([, ours]) => {
      const nonEmpty = Array.from(ours).filter(Boolean);
      return nonEmpty.length > 1;
    })
    .map(([key, ours]) => ({
      key,
      payer_name: key.split("|")[0],
      due_date: key.split("|")[1],
      our_numbers: Array.from(ours).filter(Boolean),
      items: itemsByKey.get(key) || [],
    }));
}
