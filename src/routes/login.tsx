import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell, NeonInput, NeonButton } from "@/components/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "eForge — Entrar" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/dashboard" });
  }

  async function withGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Falha ao entrar com Google");
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Continue de onde parou.">
      <form onSubmit={onSubmit} className="space-y-4">
        <NeonInput label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        <NeonInput label="Senha" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-semibold text-neon">Esqueci minha senha</Link>
        </div>
        <NeonButton loading={loading}>Entrar</NeonButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button onClick={withGoogle} className="w-full rounded-full border border-border surface py-4 text-base font-semibold hover:border-neon/40">
        Continuar com Google
      </button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link to="/signup" className="font-semibold text-neon">Cadastre-se</Link>
      </p>
    </AuthShell>
  );
}
