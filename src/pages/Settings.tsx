import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Globe, Settings2, ExternalLink, Database, KeyRound, Loader2, Eye, EyeOff, UserCog, Mail, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

/* ── Card: Editar Perfil ── */
function EditProfileCard() {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setPhone(profile.phone ?? "");
    }
    if (user) setEmail(user.email ?? "");
  }, [profile, user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName || null, phone: phone || null });
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!email || email === user?.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("Um e-mail de confirmação foi enviado para o novo endereço.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar e-mail.");
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Dados do Usuário
        </CardTitle>
        <CardDescription>
          Edite seu nome de exibição, telefone e e-mail de acesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-md">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display-name" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Nome de exibição
          </Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="profile-phone" className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Telefone
          </Label>
          <Input
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        <Button onClick={handleSaveProfile} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar perfil
        </Button>

        <div className="border-t pt-4 space-y-2">
          <Label htmlFor="profile-email" className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> E-mail de login
          </Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
          <p className="text-xs text-muted-foreground">
            Ao alterar, um e-mail de confirmação será enviado ao novo endereço.
          </p>
          <Button
            variant="outline"
            onClick={handleChangeEmail}
            disabled={savingEmail || email === user?.email}
          >
            {savingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Alterar e-mail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Card: Alterar Senha ── */
function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Alterar Senha
        </CardTitle>
        <CardDescription>
          Atualize sua senha de acesso ao sistema sem precisar sair.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-sm">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(!showNew)}
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button onClick={handleChangePassword} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Alterar senha
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Página ── */
export default function Settings() {
  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">
            Gerencie seus dados pessoais e as configurações que refletem na página pública.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Perfil + Senha */}
          <EditProfileCard />
          <ChangePasswordCard />

          {/* Landing Page */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Landing Page (/site)
              </CardTitle>
              <CardDescription>
                Edita seções da landing (hero, serviços, frota, diferenciais, depoimentos, contato, SEO e CTA final).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link to="/landing-settings">
                <Button>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Abrir editor
                </Button>
              </Link>
              <a href="/site" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visualizar site
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Conteúdo Público */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Conteúdo Público Estruturado
              </CardTitle>
              <CardDescription>
                Edita textos, CTAs, imagens e seções dinâmicas da página pública por estrutura de conteúdo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link to="/configuracoes/publico">
                <Button>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Abrir editor
                </Button>
              </Link>
              <a href="/public/excursoes" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visualizar página
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
