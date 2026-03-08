import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * Página auxiliar aberta dentro do popup OAuth.
 * Captura o ?code= da URL, envia para a janela pai via postMessage e fecha.
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      setStatus("error");
      // Notifica a janela pai sobre o erro
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-error", error }, window.location.origin);
      }
      setTimeout(() => window.close(), 2000);
      return;
    }

    if (code) {
      setStatus("success");
      // Envia o código de autorização para a janela pai
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-code", code }, window.location.origin);
      }
      setTimeout(() => window.close(), 1500);
    } else {
      setStatus("error");
      setTimeout(() => window.close(), 2000);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Processando autenticação...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="text-muted-foreground">Conectado! Esta janela vai fechar automaticamente.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-muted-foreground">Erro na autenticação. Esta janela vai fechar.</p>
          </>
        )}
      </div>
    </div>
  );
}
