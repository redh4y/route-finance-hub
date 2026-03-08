import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DriveProcessorFlags = {
  rename_files: boolean;
  skip_already_renamed: boolean;
  debug_mode: boolean;
  save_json_on_drive: boolean;
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

type DriveFile = { id: string; name: string };

async function callEdgeFunction(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("boleto-drive-processor", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Edge function error");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useDriveProcessor() {
  const [accessToken, setAccessToken] = useState("");
  const [folderId, setFolderId] = useState("");
  const [flags, setFlags] = useState<DriveProcessorFlags>({
    rename_files: true,
    skip_already_renamed: false,
    debug_mode: false,
    save_json_on_drive: false,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BoletoResult[]>([]);
  const [folderName, setFolderName] = useState("");
  const abortRef = useRef(false);

  const listFiles = useCallback(async () => {
    const data = await callEdgeFunction("list_pdfs", {
      access_token: accessToken,
      folder_id: folderId.trim(),
    });
    setFolderName(data.folder_name || "");
    return data.files as DriveFile[];
  }, [accessToken, folderId]);

  const processFiles = useCallback(async () => {
    setIsProcessing(true);
    setResults([]);
    abortRef.current = false;

    try {
      const files = await listFiles();
      setProgress({ current: 0, total: files.length });

      const allResults: BoletoResult[] = [];

      for (let i = 0; i < files.length; i++) {
        if (abortRef.current) break;

        try {
          const result = await callEdgeFunction("process_file", {
            access_token: accessToken,
            folder_id: folderId.trim(),
            file: files[i],
            flags,
          });

          const enriched: BoletoResult = {
            ...result,
            drive_folder_id: folderId.trim(),
            drive_folder_name: folderName,
          };
          allResults.push(enriched);
        } catch (err: any) {
          allResults.push({
            read_source: "error",
            payer_name: "",
            payer_cpf: "",
            our_number: "",
            digitable_line: "",
            amount: "",
            due_date: "",
            original_file_name: files[i].name,
            final_file_name: files[i].name,
            file_id: files[i].id,
            download_link: "",
            view_link: "",
            success: false,
            error: err.message || "Erro desconhecido",
            drive_folder_id: folderId.trim(),
            drive_folder_name: folderName,
          });
        }

        setProgress({ current: i + 1, total: files.length });
        setResults([...allResults]);
      }

      // Upload JSON to drive if enabled
      if (flags.save_json_on_drive && allResults.length > 0) {
        try {
          await callEdgeFunction("upload_json", {
            access_token: accessToken,
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
  }, [accessToken, folderId, flags, folderName, listFiles]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const deleteDuplicateFiles = useCallback(
    async (fileIds: string[]) => {
      const data = await callEdgeFunction("delete_files", {
        access_token: accessToken,
        file_ids: fileIds,
      });
      return data as { deleted: string[]; errors: string[] };
    },
    [accessToken]
  );

  return {
    accessToken,
    setAccessToken,
    folderId,
    setFolderId,
    flags,
    setFlags,
    isProcessing,
    progress,
    results,
    folderName,
    processFiles,
    abort,
    deleteDuplicateFiles,
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
