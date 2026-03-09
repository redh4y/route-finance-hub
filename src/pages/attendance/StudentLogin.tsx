import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function StudentLogin() {
  const [registration, setRegistration] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration.trim() || !password.trim()) {
      toast.error("Preencha matrícula e senha.");
      return;
    }
    setLoading(true);
    try {
      // Find student by registration
      const { data: student, error: sErr } = await supabase
        .from("students")
        .select("id, name, auth_user_id")
        .eq("registration", registration.trim())
        .eq("active", true)
        .maybeSingle();

      if (sErr || !student) {
        toast.error("Matrícula não encontrada ou aluno inativo.");
        setLoading(false);
        return;
      }

      // Store student info locally
      localStorage.setItem("student_id", student.id);
      localStorage.setItem("student_name", student.name);
      localStorage.setItem("student_registration", registration.trim());
      localStorage.setItem("student_password", password.trim());

      toast.success(`Bem-vindo, ${student.name}!`);
      navigate("/presenca");
    } catch {
      toast.error("Erro ao fazer login.");
    } finally {
      setLoading(false);
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Matrícula</label>
              <Input
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="Digite sua matrícula"
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
        </CardContent>
      </Card>
    </div>
  );
}
