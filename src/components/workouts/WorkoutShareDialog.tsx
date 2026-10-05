import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Copy, ExternalLink, Link2, Loader2, Share2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage, shareLinkSchema, shareOrigin, type ShareLink } from "@/lib/workout-sharing";

export function WorkoutShareDialog({
  workout,
  onClose,
}: {
  workout: { id: string; nome: string } | null;
  onClose: () => void;
}) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const origin =
    typeof window === "undefined"
      ? undefined
      : shareOrigin(
          import.meta.env.VITE_PUBLIC_SITE_URL,
          window.location.origin,
          Capacitor.isNativePlatform(),
        );
  const url = link && origin ? `${origin}/share/${link.token}` : "";
  const workoutId = workout?.id;
  useEffect(() => {
    if (!workoutId) return;
    let active = true;
    setLoading(true);
    setLink(null);
    setError("");
    void supabase
      .from("workout_shares")
      .select("id,token,created_at")
      .eq("workout_id", workoutId)
      .is("revoked_at", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else if (data) {
          const parsed = shareLinkSchema.safeParse(data);
          if (parsed.success) setLink(parsed.data);
          else setError("Não foi possível ler o compartilhamento.");
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workoutId]);

  async function generate() {
    if (!workout || busy) return;
    if (!origin) {
      setError("O compartilhamento ainda não está disponível neste aplicativo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc("create_workout_share", {
        p_workout_id: workout.id,
      });
      if (error) throw error;
      setLink(shareLinkSchema.parse(data));
      toast.success("Link de compartilhamento criado.");
    } catch (e) {
      setError(errorMessage(e, "Não foi possível criar o link."));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!link || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("revoke_workout_share", { p_share_id: link.id });
      if (error) throw error;
      setLink(null);
      toast.success("Link revogado.");
    } catch (e) {
      setError(errorMessage(e, "Não foi possível revogar o link."));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Selecione e copie o link no campo abaixo.");
    }
  }
  async function nativeShare() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: workout?.nome, text: "Veja este treino no eForge.", url });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        toast.error("Não foi possível compartilhar. Copie o link.");
    }
  }
  return (
    <Dialog
      open={!!workout}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="workout-plan-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar treino</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com o link poderá ver os exercícios e copiar o treino. Seus dados
            pessoais e o histórico de execuções ficam privados.
          </DialogDescription>
        </DialogHeader>
        <h2 className="text-xl font-bold">{workout?.nome}</h2>
        {loading ? (
          <p role="status">Carregando compartilhamento…</p>
        ) : (
          <>
            {link && origin ? (
              <>
                <label htmlFor="workout-share-url">Link do treino</label>
                <Input
                  id="workout-share-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
                <p className="text-muted-foreground">
                  Esta cópia foi criada em {new Date(link.created_at).toLocaleDateString("pt-BR")}.
                  Mudanças posteriores no treino precisam de um novo link.
                </p>
                <div className="share-actions">
                  <Button disabled={busy} onClick={() => void copy()}>
                    <Copy size={18} />
                    Copiar link
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void nativeShare()}>
                    <Share2 size={18} />
                    Compartilhar
                  </Button>
                  <a className="share-open" href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={18} />
                    Abrir prévia
                  </a>
                </div>
                <Button variant="outline" disabled={busy} onClick={() => void generate()}>
                  <Link2 size={18} />
                  Gerar novo link e revogar o anterior
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void revoke()}>
                  <ShieldOff size={18} />
                  Revogar link
                </Button>
              </>
            ) : (
              <Button disabled={busy || !!error} onClick={() => void generate()}>
                {busy ? <Loader2 className="animate-spin" /> : <Link2 size={18} />}Gerar link
              </Button>
            )}
          </>
        )}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <Button variant="outline" disabled={busy} onClick={() => void generate()}>
              Tentar gerar link novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
