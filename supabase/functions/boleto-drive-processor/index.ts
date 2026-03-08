import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Google Drive helpers ─── */

async function driveGet(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API ${res.status}: ${text}`);
  }
  return res;
}

async function listPdfFiles(token: string, folderId: string) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,webContentLink)&pageSize=1000&orderBy=name`;
  const res = await driveGet(token, url);
  const data = await res.json();
  return (data.files || []) as Array<{ id: string; name: string; webViewLink?: string; webContentLink?: string }>;
}

async function getFolderName(token: string, folderId: string): Promise<string> {
  try {
    const res = await driveGet(
      token,
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`
    );
    const d = await res.json();
    return d.name || "";
  } catch {
    return "";
  }
}

/**
 * Extrai texto de um PDF usando Google Drive OCR:
 * 1. Copia o PDF como Google Doc (isso dispara OCR)
 * 2. Exporta o Doc como texto puro
 * 3. Deleta o Doc temporário
 */
async function extractTextViaDriveOcr(token: string, fileId: string): Promise<string> {
  // 1. Copy as Google Doc
  const copyRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/copy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mimeType: "application/vnd.google-apps.document",
        name: `_temp_ocr_${Date.now()}`,
      }),
    }
  );

  if (!copyRes.ok) {
    const err = await copyRes.text();
    throw new Error(`OCR copy failed: ${err}`);
  }
  const copy = await copyRes.json();

  try {
    // 2. Export as plain text
    const textRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${copy.id}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!textRes.ok) throw new Error("Export as text failed");
    return await textRes.text();
  } finally {
    // 3. Delete temp doc
    await fetch(`https://www.googleapis.com/drive/v3/files/${copy.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

/* ─── Boleto field parsing ─── */

function parseBoletoFields(text: string) {
  const result = {
    payer_name: "",
    payer_cpf: "",
    our_number: "",
    digitable_line: "",
    amount: "",
    due_date: "",
  };

  // Pagador / Sacado
  const payerPatterns = [
    /(?:pagador|sacado|nome\s*(?:do\s*)?(?:pagador|sacado))[:\s]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{3,60})/i,
    /(?:pagador|sacado)[:\s]*\n?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{3,60})/i,
  ];
  for (const pat of payerPatterns) {
    const m = text.match(pat);
    if (m) {
      result.payer_name = m[1].trim().replace(/\s{2,}/g, " ");
      break;
    }
  }

  // CPF (11 dígitos)
  const cpfPatterns = [
    /(?:cpf|cnpj|cpf\/cnpj)[:\s]*(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\.\s]?\d{2})/i,
    /(\d{3}\.\d{3}\.\d{3}-\d{2})/,
  ];
  for (const pat of cpfPatterns) {
    const m = text.match(pat);
    if (m) {
      result.payer_cpf = m[1].replace(/\D/g, "");
      break;
    }
  }

  // Nosso Número
  const nnPatterns = [
    /nosso\s*n[uú]mero[:\s]*([0-9\/\-\.]+[\d])/i,
    /nosso\s*n[uú]mero\s*\n?\s*([0-9\/\-\.]+[\d])/i,
  ];
  for (const pat of nnPatterns) {
    const m = text.match(pat);
    if (m) {
      result.our_number = m[1].trim();
      break;
    }
  }

  // Linha Digitável — padrões comuns de boleto bancário
  const ldPatterns = [
    // Padrão segmentado: 5.5 5.5 5.6 1 14
    /(\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14})/,
    // Sequência longa de dígitos (44-48 chars)
    /(\d[\d\.\s]{42,58}\d)/,
  ];
  for (const pat of ldPatterns) {
    const m = text.match(pat);
    if (m) {
      const cleaned = m[1].replace(/[\s\.]/g, "");
      if (cleaned.length >= 44 && cleaned.length <= 48) {
        result.digitable_line = cleaned;
        break;
      }
    }
  }

  // Valor
  const valPatterns = [
    /(?:valor\s*(?:do\s*)?(?:documento|cobrado|total))[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:valor)[:\s]*R?\$?\s*([\d.,]+)/i,
    /R\$\s*([\d.,]+)/,
  ];
  for (const pat of valPatterns) {
    const m = text.match(pat);
    if (m) {
      result.amount = m[1].trim();
      break;
    }
  }

  // Vencimento
  const datePatterns = [
    /(?:vencimento|venc\.?|data\s*(?:de\s*)?vencimento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      result.due_date = m[1];
      break;
    }
  }

  return result;
}

async function renameFile(token: string, fileId: string, newName: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    }
  );
  return res.ok;
}

async function deleteFile(token: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.ok;
}

async function uploadJsonToDrive(
  token: string,
  folderId: string,
  jsonText: string,
  folderName: string
) {
  const safeName =
    (folderName || "pasta_sem_nome")
      .replace(/[^A-Za-z0-9._\- ]/g, "_")
      .trim() || "pasta_sem_nome";
  const fileName = `00_boletos_${safeName}.json`;

  // Check if file exists
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and name='${fileName.replace(/'/g, "\\'")}'`
  );
  const listRes = await driveGet(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`
  );
  const listData = await listRes.json();
  const existing = listData.files?.[0];

  if (existing) {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: jsonText,
      }
    );
    return existing.id;
  }

  const boundary = "---lovable-boundary---";
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    jsonText,
    `--${boundary}--`,
  ].join("\r\n");

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const created = await createRes.json();
  return created.id;
}

/* ─── Main handler ─── */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, access_token, folder_id, flags } = body;

    if (!access_token) {
      return new Response(
        JSON.stringify({ error: "access_token do Google é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: unknown;

    switch (action) {
      /* ─── Listar PDFs ─── */
      case "list_pdfs": {
        const files = await listPdfFiles(access_token, folder_id);
        const folderName = await getFolderName(access_token, folder_id);
        result = { files, folder_name: folderName };
        break;
      }

      /* ─── Nome da pasta ─── */
      case "get_folder_name": {
        result = { name: await getFolderName(access_token, folder_id) };
        break;
      }

      /* ─── Processar um arquivo ─── */
      case "process_file": {
        const file = body.file as { id: string; name: string };
        const skipPat = /\s-\s\d{11}\.pdf$/i;

        if (flags?.skip_already_renamed && skipPat.test(file.name)) {
          result = {
            read_source: "",
            payer_name: "",
            payer_cpf: "",
            our_number: "",
            digitable_line: "",
            amount: "",
            due_date: "",
            original_file_name: file.name,
            final_file_name: file.name,
            file_id: file.id,
            download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
            view_link: `https://drive.google.com/file/d/${file.id}/view`,
            success: true,
            error: "SKIPPED_ALREADY_RENAMED",
          };
          break;
        }

        let text = "";
        let readSource = "google_ocr";
        try {
          text = await extractTextViaDriveOcr(access_token, file.id);
        } catch (e) {
          result = {
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
            download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
            view_link: `https://drive.google.com/file/d/${file.id}/view`,
            success: false,
            error: `OCR falhou: ${(e as Error).message}`,
          };
          break;
        }

        const parsed = parseBoletoFields(text);

        let finalName = file.name;
        if (
          flags?.rename_files !== false &&
          parsed.payer_name &&
          parsed.payer_cpf
        ) {
          const safeName = parsed.payer_name
            .toUpperCase()
            .replace(/\s{2,}/g, " ")
            .slice(0, 60)
            .trim();
          finalName = `${safeName} - ${parsed.payer_cpf}.pdf`;
          try {
            await renameFile(access_token, file.id, finalName);
          } catch {
            finalName = file.name; // keep original if rename fails
          }
        }

        result = {
          read_source: readSource,
          payer_name: parsed.payer_name,
          payer_cpf: parsed.payer_cpf,
          our_number: parsed.our_number,
          digitable_line: parsed.digitable_line,
          amount: parsed.amount,
          due_date: parsed.due_date,
          original_file_name: file.name,
          final_file_name: finalName,
          file_id: file.id,
          download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
          view_link: `https://drive.google.com/file/d/${file.id}/view`,
          success: true,
          error: null,
          ...(flags?.debug_mode ? { debug_full_text: text } : {}),
        };
        break;
      }

      /* ─── Deletar arquivos ─── */
      case "delete_files": {
        const fileIds = body.file_ids as string[];
        const deleted: string[] = [];
        const errors: string[] = [];
        for (const fid of fileIds || []) {
          try {
            const ok = await deleteFile(access_token, fid);
            if (ok) deleted.push(fid);
            else errors.push(`${fid}: delete returned false`);
          } catch (e) {
            errors.push(`${fid}: ${(e as Error).message}`);
          }
        }
        result = { deleted, errors };
        break;
      }

      /* ─── Upload JSON ─── */
      case "upload_json": {
        const jsonText = body.json_text as string;
        const folderName = await getFolderName(access_token, folder_id);
        const fileId = await uploadJsonToDrive(
          access_token,
          folder_id,
          jsonText,
          folderName
        );
        result = { success: true, file_id: fileId };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("boleto-drive-processor error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
