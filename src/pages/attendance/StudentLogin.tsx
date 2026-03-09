import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bus, Loader2, AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function StudentLogin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login state
  const [loginCpf, setLoginCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Register state
  const [cpf, setCpf] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  /* ── Login ────────────────────────────────────────────────────────── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = loginCpf.replace(/\D/g, "");
    if (digits.length < 11) {
      toast.error("CPF inválido. Digite os 11 dígitos.");
      return;
    }
    if (!password.trim()) {
      toast.error("Preencha a senha.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-auth", {
        body: { action: "login", cpf: digits },
      });

      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || "CPF não encontrado.");
        setLoading(false);
        return;
      }

      const student = data.student;

      // Simple password check (stored locally)
      const storedPw = localStorage.getItem(`student_pw_${student.id}`);
      if (storedPw && storedPw !== password.trim()) {
        toast.error("Senha incorreta.");
        setLoading(false);
        return;
      }

      localStorage.setItem("student_id", student.id);
      localStorage.setItem("student_name", student.name);
      localStorage.setItem("student_registration", student.registration);
      localStorage.setItem(`student_pw_${student.id}`, password.trim());

      toast.success(`Bem-vindo, ${student.name}!`);
      navigate("/presenca");
    } catch {
      toast.error("Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Self-registration ────────────────────────────────────────────── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const digits = cpf.replace(/\D/g, "");
    if (digits.length < 11) {
      setRegisterError("CPF inválido. Digite os 11 dígitos.");
      return;
    }
    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setRegisterError("Crie uma senha de pelo menos 4 caracteres.");
      return;
    }

    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-auth", {
        body: { action: "register", cpf: digits },
      });

      if (error) throw error;

      if (!data?.ok) {
        setRegisterError(data?.error || "Erro ao verificar CPF.");
        setRegistering(false);
        return;
      }

      const student = data.student;

      localStorage.setItem("student_id", student.id);
      localStorage.setItem("student_name", student.name);
      localStorage.setItem("student_registration", student.registration);
      localStorage.setItem(`student_pw_${student.id}`, regPassword.trim());

      if (data.already_registered) {
        toast.success(`Você já está cadastrado! Bem-vindo, ${student.name}.`);
      } else {
        toast.success(`Cadastro realizado com sucesso! Bem-vindo, ${student.name}.`);
      }
      navigate("/presenca");
    } catch (err: any) {
      setRegisterError(err?.message || "Erro ao realizar cadastro.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 bg-primary/10 p-3 rounded-full w-fit">
            <Bus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Presença Universitário</CardTitle>
          <p className="text-sm text-muted-foreground">Tavares Transportes</p>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "login" | "register"); setRegisterError(null); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>

            {/* ── Login tab ─────────────────────────────────────────── */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">CPF</label>
                  <Input
                    value={loginCpf}
                    onChange={(e) => setLoginCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Senha</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            {/* ── Register tab ──────────────────────────────────────── */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe seu CPF para verificar seu cadastro no transporte.
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">CPF</label>
                  <Input
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Crie uma senha</label>
                  <Input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    autoComplete="new-password"
                  />
                </div>

                {registerError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{registerError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-base" disabled={registering}>
                  {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Cadastrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
