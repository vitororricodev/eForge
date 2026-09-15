import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, NeonInput, NeonButton } from "@/components/AuthShell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "eForge — Nova senha" }] }),
  component: ResetPage,
});

function ResetPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada!");
    nav({ to: "/dashboard" });
  }

  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma senha forte." back="/login">
      <form onSubmit={onSubmit} className="space-y-4">
        <NeonInput label="Nova senha" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <NeonButton loading={loading}>Atualizar senha</NeonButton>
      </form>
    </AuthShell>
  );
}
