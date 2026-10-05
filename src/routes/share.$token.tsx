import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, Dumbbell, Link2Off, Loader2, LogIn, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { muscleLabel } from "@/lib/exercise-labels";
import { errorMessage, sharedWorkoutSchema } from "@/lib/workout-sharing";
import type { Exercise } from "@/lib/exercise-types";
import "@/components/workouts/workout-plan.css";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "eForge — Treino compartilhado" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedWorkoutPage,
});

function SharedWorkoutPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const query = useQuery({
    queryKey: ["shared-workout", token, user?.id ?? "public"],
    enabled: !authLoading && validToken,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_workout", { p_token: token });
      if (error) throw error;
      return data ? sharedWorkoutSchema.parse(data) : null;
    },
  });
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFor, setCopyFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [replacements, setReplacements] = useState<Record<string, Pick<Exercise, "id" | "nome">>>(
    {},
  );
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyError, setCopyError] = useState("");
  const workout = query.data;
  const missing = workout?.items.filter((item) => !item.available) ?? [];
  const unresolved = missing.filter((item) => !replacements[item.item_id]).length;

  function openCopy() {
    if (!workout || !user) return;
    setCopyFor(user.id);
    setName(workout.nome);
    setReplacements({});
    setRequestId(crypto.randomUUID());
    setCopyError("");
    setCopyOpen(true);
  }
  async function importWorkout() {
    if (!user || copyFor !== user.id || !workout || saving || unresolved) return;
    if (!name.trim() || name.trim().length > 120) {
      setCopyError("Informe um nome de até 120 caracteres.");
      return;
    }
    setSaving(true);
    setCopyError("");
    try {
      const mapping = Object.fromEntries(
        missing.map((item) => [item.item_id, replacements[item.item_id].id]),
      );
      const { data, error } = await supabase.rpc("import_shared_workout", {
        p_token: token,
        p_name: name.trim(),
        p_replacements: mapping,
        p_request_id: requestId,
      });
      if (error) throw error;
      if (!data) throw new Error("Não foi possível confirmar a cópia.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user.id !== copyFor) return;
      toast.success("Treino copiado para Meus treinos.");
      setCopyOpen(false);
      await navigate({ to: "/workouts" });
    } catch (error) {
      setCopyError(errorMessage(error, "Não foi possível copiar. Tente novamente."));
      void query.refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shared-workout">
      <header className="shared-header">
        <Link to={user ? "/workouts" : "/welcome"} aria-label="eForge">
          <Brand />
        </Link>
        <span>
          <Dumbbell size={18} />
          Treino compartilhado
        </span>
      </header>
      {!validToken || (!query.isPending && !query.isError && !workout) ? (
        <section className="share-state">
          <Link2Off size={40} />
          <h1>Link indisponível</h1>
          <p>Este compartilhamento foi revogado, removido ou o link está incorreto.</p>
          <Link to={user ? "/workouts" : "/welcome"} className="share-open">
            Voltar ao eForge
          </Link>
        </section>
      ) : authLoading || query.isPending ? (
        <section className="share-state" role="status">
          <Loader2 className="animate-spin" />
          <p>Carregando treino…</p>
        </section>
      ) : query.isError ? (
        <section className="share-state" role="alert">
          <h1>Não foi possível abrir o treino</h1>
          <p>Confira sua conexão e tente novamente.</p>
          <Button onClick={() => void query.refetch()}>
            <RefreshCw size={18} />
            Tentar novamente
          </Button>
        </section>
      ) : (
        workout && (
          <>
            <section className="shared-intro">
              <p className="plan-eyebrow">Treine no seu ritmo</p>
              <h1>{workout.nome}</h1>
              {workout.descricao && <p className="break-words">{workout.descricao}</p>}
              <div className="share-summary">
                <Dumbbell size={18} />
                <span>
                  {workout.items.length} exercícios ·{" "}
                  {workout.items.reduce((n, item) => n + item.series, 0)} séries planejadas
                </span>
              </div>
              <p className="share-note">
                Ao copiar, o treino fica no seu programa e pode ser editado sem alterar o original.
              </p>
            </section>
            <section aria-label="Exercícios do treino">
              <ol className="shared-exercises">
                {workout.items.map((item, index) => (
                  <li key={item.item_id}>
                    <article className="shared-exercise">
                      <div className="shared-exercise-main">
                        <ExerciseMedia
                          url={item.gif_url}
                          name={item.nome}
                          muscle={item.musculo_principal}
                          className="shared-media"
                        />
                        <div>
                          <span className="plan-eyebrow">Exercício {index + 1}</span>
                          <h2>{item.nome}</h2>
                          <p className="text-muted-foreground">
                            {muscleLabel(item.musculo_principal)}
                          </p>
                          <p>
                            {item.series} séries × {item.repeticoes} repetições
                          </p>
                          <p className="text-muted-foreground">
                            Descanso: {item.descanso_seg}s
                            {item.carga_kg !== null
                              ? ` · Carga: ${item.carga_kg.toLocaleString("pt-BR")} kg`
                              : ""}
                          </p>
                        </div>
                      </div>
                      {user && (
                        <p className={item.available ? "share-available" : "share-unavailable"}>
                          {item.available ? <Check size={17} /> : <RefreshCw size={17} />}{" "}
                          {item.available
                            ? "Disponível na sua biblioteca"
                            : "Escolha um substituto ao copiar"}
                        </p>
                      )}
                      {(item.instrucoes.length > 0 ||
                        item.descricao ||
                        item.equipamentos.length > 0 ||
                        item.musculos_secundarios.length > 0) && (
                        <details>
                          <summary>Detalhes do exercício</summary>
                          {item.descricao && <p>{item.descricao}</p>}
                          {item.equipamentos.length > 0 && (
                            <p>Equipamento: {item.equipamentos.join(", ")}</p>
                          )}
                          {item.musculos_primarios.length > 0 && (
                            <p>Principal: {item.musculos_primarios.map(muscleLabel).join(", ")}</p>
                          )}
                          {item.musculos_secundarios.length > 0 && (
                            <p>
                              Secundários: {item.musculos_secundarios.map(muscleLabel).join(", ")}
                            </p>
                          )}
                          {item.instrucoes.length > 0 && (
                            <ol>
                              {item.instrucoes.map((text, i) => (
                                <li key={i}>{text}</li>
                              ))}
                            </ol>
                          )}
                        </details>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
            </section>
            <div className="shared-copy-bar">
              {user ? (
                <Button onClick={openCopy}>
                  <Copy size={19} />
                  Copiar para meus treinos
                </Button>
              ) : (
                <Link to="/login" search={{ redirect: `/share/${token}` }} className="share-login">
                  <LogIn size={19} />
                  Entrar para copiar este treino
                </Link>
              )}
            </div>
          </>
        )
      )}

      <Dialog
        open={copyOpen && copyFor === user?.id}
        onOpenChange={(open) => {
          if (!saving) setCopyOpen(open);
        }}
      >
        <DialogContent className="workout-plan-dialog share-copy-dialog max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Copiar treino</DialogTitle>
            <DialogDescription>
              Os exercícios disponíveis serão reutilizados. Escolha substitutos apenas para os
              indisponíveis; a ordem, as séries, as repetições e o descanso serão mantidos.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="copy-workout-name">Nome do seu treino</label>
          <Input
            id="copy-workout-name"
            maxLength={120}
            disabled={saving}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ol className="copy-items">
            {workout?.items.map((item, index) => (
              <li key={item.item_id}>
                <h3>
                  {index + 1}. {item.nome}
                </h3>
                <p className="text-muted-foreground">
                  {item.series} × {item.repeticoes} · {item.descanso_seg}s de descanso
                </p>
                {item.available ? (
                  <p className="share-available">
                    <Check size={17} />
                    Usar exercício da biblioteca
                  </p>
                ) : (
                  <div className="copy-replacement">
                    <p className="share-unavailable">Indisponível na sua biblioteca</p>
                    {replacements[item.item_id] && (
                      <p className="share-available">
                        <Check size={17} />
                        Substituto: {replacements[item.item_id].nome}
                      </p>
                    )}
                    <fieldset disabled={saving}>
                      <ExercisePicker
                        label={`${replacements[item.item_id] ? "Trocar" : "Escolher"} substituto de ${item.nome}`}
                        excludeIds={[
                          ...(workout?.items.filter((x) => x.available).map((x) => x.exercise_id) ??
                            []),
                          ...Object.entries(replacements)
                            .filter(([key]) => key !== item.item_id)
                            .map(([, ex]) => ex.id),
                        ]}
                        onSelect={(ex) =>
                          setReplacements((prev) => ({
                            ...prev,
                            [item.item_id]: { id: ex.id, nome: ex.nome },
                          }))
                        }
                      />
                    </fieldset>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {unresolved > 0 && (
            <p role="status">
              Escolha {unresolved} substituto{unresolved === 1 ? "" : "s"} para continuar.
            </p>
          )}
          {copyError && (
            <p role="alert" className="plan-error">
              {copyError}
            </p>
          )}
          {!workout && <p role="alert">Este link não está mais disponível.</p>}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setCopyOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving || unresolved > 0 || !workout}
              onClick={() => void importWorkout()}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Copy size={18} />}Salvar cópia do
              treino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
