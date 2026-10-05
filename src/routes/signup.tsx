import { shareReturnPath, rememberShareReturn } from "@/lib/workout-sharing";
import { requestIntro, clearIntro } from "@/lib/intro-session";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell, NeonInput, NeonButton } from "@/components/AuthShell";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: shareReturnPath(search.redirect),
  }),
  head: () => ({ meta: [{ title: "eForge — Criar conta" }] }),
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha precisa ter pelo menos 6 caracteres");
      return;
    }
    rememberShareReturn(undefined);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Confirme seu e-mail e entre para continuar.");
      void nav({ to: "/login", search: { redirect } });
      return;
    }
    toast.success("Conta criada! Bem-vindo ao eForge.");
    rememberShareReturn(undefined);
    if (redirect) void nav({ to: "/share/$token", params: { token: redirect.slice(7) } });
    else void nav({ to: "/dashboard" });
  }

  async function withGoogle() {
    rememberShareReturn(redirect);
    requestIntro();
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      rememberShareReturn(undefined);
      clearIntro();
      toast.error("Falha ao entrar com Google");
    }
  }

  return (
    <AuthShell title="Crie sua conta" subtitle="Sua jornada começa agora.">
      <form onSubmit={onSubmit} className="space-y-4">
        <NeonInput
          label="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
        />
        <NeonInput
          label="E-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
        />
        <NeonInput
          label="Senha"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
        <NeonButton loading={loading}>Criar conta</NeonButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          ou
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={withGoogle}
        className="w-full rounded-full border border-border surface py-4 text-base font-semibold hover:border-neon/40"
      >
        Continuar com Google
      </button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" search={{ redirect }} className="font-semibold text-neon">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
