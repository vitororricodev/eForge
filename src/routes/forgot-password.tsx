import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, NeonInput, NeonButton } from "@/components/AuthShell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "eForge — Recuperar senha" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Link enviado! Verifique seu e-mail.");
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para redefinir sua senha." back="/login">
      {sent ? (
        <div className="hairline rounded-2xl surface p-6 text-center">
          <p className="text-sm">Verifique <span className="text-neon font-semibold">{email}</span> para o link de redefinição.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <NeonInput label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          <NeonButton loading={loading}>Enviar link</NeonButton>
        </form>
      )}
    </AuthShell>
  );
}
