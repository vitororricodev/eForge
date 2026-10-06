import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { Brand } from "@/components/Brand";
import { ArrowLeft, Check, Plus, Timer, Trash2, Trophy, Volume2 } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  readDraft,
  saveDraft,
  remaining,
  totals,
  attachWorkoutPlan,
  restoreDraftExercises,
  draftKey,
  type Draft,
  type Exercise,
} from "@/lib/workout-storage";
import { syncDraft } from "@/lib/workout-sync";
import { createRestAudio } from "@/lib/rest-audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "@/components/workouts/workout-run.css";

export const Route = createFileRoute("/_authenticated/run/$workoutId")({ component: Run });

function Run() {
  const { user } = useAuth();
  const userId = user?.id;
  const { workoutId } = Route.useParams();
  const navigate = useNavigate();
  const [historyRows, setHistoryRows] = useState<
    { exercise_id: string | null; carga_kg: number | null; repeticoes: number | null }[]
  >([]);
  const [sound, setSound] = useState(false);
  const restAudio = useRef<ReturnType<typeof createRestAudio> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const apply = useCallback((next: Draft) => {
    try {
      const saved = saveDraft(next);
      draftRef.current = saved;
      setDraft(saved);
      return true;
    } catch {
      toast.error("Armazenamento cheio. Não foi possível salvar a alteração.");
      return false;
    }
  }, []);
  const update = useCallback(
    (change: (current: Draft) => Draft) => {
      const current = draftRef.current;
      return current && !current.finished ? apply(change(current)) : false;
    },
    [apply],
  );

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const old = readDraft(userId);
      setError("");
      if (old && (!old.finished || !old.synced)) {
        if (old.workoutId !== workoutId) {
          await navigate({
            to: "/run/$workoutId",
            params: { workoutId: old.workoutId },
            replace: true,
          });
          return;
        }
        apply(old);
        if (old.finished || old.plannedExercises) return;
      } else {
        draftRef.current = null;
        setDraft(null);
      }
      const [
        { data: workout, error: workoutError },
        { data: rows, error: rowsError },
        { data: history },
      ] = await Promise.all([
        supabase.from("workouts").select("nome").eq("id", workoutId).eq("user_id", userId).single(),
        supabase
          .from("workout_exercises")
          .select(
            "*,exercises(nome,musculo_principal,musculos_primarios,musculos_secundarios,musculos_terciarios)",
          )
          .eq("workout_id", workoutId)
          .eq("user_id", userId)
          .order("ordem"),
        supabase
          .from("set_logs")
          .select("exercise_id,carga_kg,repeticoes")
          .eq("user_id", userId)
          .eq("concluida", true)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (workoutError || rowsError) throw workoutError || rowsError;
      if (!active) return;
      setHistoryRows(history || []);
      const plannedExercises: Exercise[] = (rows || []).map((row) => {
        const previous = history?.find((entry) => entry.exercise_id === row.exercise_id);
        return {
          plan_item_id: row.id || row.exercise_id,
          exercise_id: row.exercise_id,
          nome: row.exercises?.nome || "Exercício",
          musculo_principal: row.exercises?.musculo_principal || "",
          musculos_primarios: row.exercises?.musculos_primarios || [],
          musculos_secundarios: row.exercises?.musculos_secundarios || [],
          musculos_terciarios: row.exercises?.musculos_terciarios || [],
          descanso_seg: row.descanso_seg,
          previous: previous ? `${previous.repeticoes} × ${previous.carga_kg} kg` : undefined,
          sets: Array.from({ length: row.series }, () => ({
            id: crypto.randomUUID(),
            reps: String(previous?.repeticoes ?? row.repeticoes),
            carga: String(previous?.carga_kg ?? row.carga_kg ?? 0),
            done: false,
            kind: "normal",
          })),
        };
      });
      // Reconcile the latest local version, not the snapshot from before the request.
      const latest = draftRef.current ?? readDraft(userId);
      if (latest && (!latest.finished || !latest.synced)) {
        if (latest.workoutId !== workoutId) {
          await navigate({
            to: "/run/$workoutId",
            params: { workoutId: latest.workoutId },
            replace: true,
          });
          return;
        }
        const repaired = attachWorkoutPlan(latest, plannedExercises);
        apply(repaired);
        return;
      }
      const next: Draft = {
        id: crypto.randomUUID(),
        userId,
        workoutId,
        name: workout!.nome,
        started: Date.now(),
        restUntil: 0,
        exercises: plannedExercises,
        plannedExercises: structuredClone(plannedExercises),
      };
      apply(next);
    })().catch((err) => {
      if (!active) return;
      if (draftRef.current) setStatus("Salvo no aparelho • sincronização pendente");
      else setError(err.message || "Não foi possível abrir o treino.");
    });
    return () => {
      active = false;
    };
  }, [userId, workoutId, apply, navigate, resumeAttempt]);
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      const current = draftRef.current;
      const saved = readDraft(userId);
      if (current && saved?.id === current.id && (saved.revision ?? 0) > (current.revision ?? 0)) {
        const restored = restoreDraftExercises(
          { ...saved, plannedExercises: current.plannedExercises ?? saved.plannedExercises },
          current.exercises,
        );
        if (
          restored.exercises.length > saved.exercises.length ||
          (!saved.plannedExercises && restored.plannedExercises)
        )
          apply(restored);
        else {
          draftRef.current = restored;
          setDraft(restored);
        }
      }
      if (
        navigator.onLine &&
        draftRef.current &&
        !draftRef.current.finished &&
        !draftRef.current.plannedExercises
      )
        setResumeAttempt((attempt) => attempt + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === draftKey(userId)) refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, apply]);
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      const current = readDraft(userId);
      if (current && !current.synced)
        void syncDraft(current)
          .then((ok) => {
            if (ok) setStatus("Salvo na sua conta");
          })
          .catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [userId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      void syncDraft(draft)
        .then((ok) =>
          setStatus(ok ? "Salvo na sua conta" : "Salvo no aparelho • sincronização pendente"),
        )
        .catch(() => setStatus("Salvo no aparelho • sincronização pendente"));
    }, 700);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const online = () => {
      if (draft)
        void syncDraft(draft)
          .then((ok) => setStatus(ok ? "Sincronizado" : "Sincronização pendente"))
          .catch(() => setStatus("Sincronização pendente"));
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [draft]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (draft && !draft.finished) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft]);
  useEffect(() => {
    return () => {
      restAudio.current?.dispose();
      restAudio.current = null;
    };
  }, []);
  useEffect(() => {
    if (draft?.finished) restAudio.current?.stop();
  }, [draft?.finished]);
  useEffect(() => {
    if (draft?.restUntil && remaining(draft.restUntil, now) === 0) {
      navigator.vibrate?.([200, 100, 200]);
      if (sound) restAudio.current?.play();
      update((current) =>
        current.restUntil <= Date.now() ? { ...current, restUntil: 0 } : current,
      );
    }
  }, [now, draft, sound, update]);
  function change(index: number, fn: (exercise: Exercise) => Exercise) {
    const slot = draft?.exercises[index];
    if (slot)
      update((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          (exercise.plan_item_id ?? exercise.exercise_id) ===
          (slot.plan_item_id ?? slot.exercise_id)
            ? fn(exercise)
            : exercise,
        ),
      }));
  }
  if (error)
    return (
      <main className="p-6">
        <p role="alert">{error}</p>
        <Link to="/workouts">Voltar aos treinos</Link>
      </main>
    );
  if (!draft)
    return (
      <main className="p-6" aria-busy="true">
        Preparando seu treino…
      </main>
    );
  const stats = totals(draft);
  const rest = remaining(draft.restUntil, now);
  const plannedSets = draft.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const elapsed = Math.max(0, Math.floor((now - draft.started) / 60_000));
  const restLabel = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`;
  if (draft.finished)
    return (
      <main className="eforge-finished mx-auto max-w-md p-5">
        <Brand />
        <div className="eforge-finish-trophy">
          <Trophy size={64} strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl">Treino concluído</h1>
        <p className="my-6">
          {stats.sets} séries • {stats.volume.toLocaleString("pt-BR")} kg
        </p>
        <p role="status">{status}</p>
        <Link className="block py-4 text-neon" to="/muscle-map">
          Ver músculos trabalhados
        </Link>
        <Link to="/workouts">Meus treinos</Link>
      </main>
    );
  return (
    <main className="eforge-run workout-run">
      <header className="workout-run-header">
        <div className="workout-run-topbar">
          <Link
            to="/workouts"
            onClick={(event) => {
              if (!confirm("Sair da tela? Seu treino ficará salvo para continuar."))
                event.preventDefault();
            }}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Salvar e sair
          </Link>
          <Brand compact />
        </div>
        <p className="workout-run-eyebrow">Treino em andamento</p>
        <h1>{draft.name}</h1>
        <p className="workout-run-guidance">
          Registre a carga e as repetições. Marque cada série ao concluir.
        </p>
        <div className="workout-run-preferences">
          <label>
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => {
                const enabled = event.target.checked;
                restAudio.current ??= createRestAudio();
                restAudio.current.setEnabled(enabled);
                setSound(enabled);
              }}
            />
            <Volume2 size={17} aria-hidden="true" /> Som no descanso
          </label>
          <p role="status">{status || "Salvo no aparelho"}</p>
        </div>
      </header>
      <section className="workout-run-progress" aria-label="Resumo do treino">
        <dl className="workout-run-stats">
          <div>
            <dt>Tempo</dt>
            <dd>
              {elapsed}
              <span> min</span>
            </dd>
          </div>
          <div>
            <dt>Séries feitas</dt>
            <dd>
              {stats.sets}
              <span> / {plannedSets}</span>
            </dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>
              {stats.volume.toLocaleString("pt-BR")}
              <span> kg</span>
            </dd>
          </div>
        </dl>
        <progress value={stats.sets} max={plannedSets || 1} aria-label="Séries concluídas" />
      </section>
      {rest > 0 && (
        <aside className="eforge-rest workout-run-rest" aria-label="Descanso entre séries">
          <div className="workout-run-rest-heading">
            <span>
              <Timer size={18} aria-hidden="true" /> Descanso
            </span>
            <strong role="timer" aria-label={`${rest} segundos de descanso restantes`}>
              {restLabel}
            </strong>
          </div>
          <div className="workout-run-rest-actions">
            <button
              type="button"
              aria-label="Diminuir descanso em 15 segundos"
              onClick={() =>
                update((current) => ({
                  ...current,
                  restUntil: Math.max(Date.now(), current.restUntil - 15_000),
                }))
              }
            >
              −15s
            </button>
            <button
              type="button"
              aria-label="Aumentar descanso em 15 segundos"
              onClick={() =>
                update((current) => ({ ...current, restUntil: current.restUntil + 15_000 }))
              }
            >
              +15s
            </button>
            <button
              type="button"
              onClick={() => update((current) => ({ ...current, restUntil: 0 }))}
            >
              Pular descanso
            </button>
          </div>
        </aside>
      )}
      <div className="workout-run-exercises">
        {draft.exercises.map((exercise, exerciseIndex) => (
          <section
            className="workout-run-exercise"
            key={exercise.plan_item_id ?? exercise.exercise_id}
            aria-label={exercise.nome}
          >
            <div className="workout-run-exercise-heading">
              <div>
                <p>
                  Exercício {exerciseIndex + 1} de {draft.exercises.length}
                </p>
                <h2>{exercise.nome}</h2>
              </div>
              <span className="workout-run-exercise-count">
                {exercise.sets.filter((set) => set.done).length}/{exercise.sets.length}
                <span> feitas</span>
              </span>
            </div>
            <div className="workout-run-replace">
              <ExercisePicker
                label="Substituir exercício"
                excludeIds={draft.exercises.map((item) => item.exercise_id)}
                onSelect={(choice) => {
                  if (
                    exercise.sets.some((set) => set.done) &&
                    !confirm("Substituir remove as séries deste exercício. Continuar?")
                  )
                    return;
                  change(exerciseIndex, (current) => ({
                    ...current,
                    exercise_id: choice.id,
                    nome: choice.nome,
                    musculo_principal: choice.musculo_principal,
                    musculos_primarios: choice.musculos_primarios,
                    musculos_secundarios: choice.musculos_secundarios,
                    musculos_terciarios: choice.musculos_terciarios,
                    previous: undefined,
                    sets: current.sets.map((set) => ({
                      ...set,
                      id: crypto.randomUUID(),
                      done: false,
                      carga: "0",
                    })),
                  }));
                }}
              />
            </div>
            <p className="workout-run-previous">
              Último registro: <span>{exercise.previous || "primeiro treino"}</span>
            </p>
            <div className="workout-run-set-labels" aria-hidden="true">
              <span>#</span>
              <span>Repetições</span>
              <span>Carga (kg)</span>
              <span>Feita</span>
            </div>
            {exercise.sets.map((set, setIndex) => (
              <div className="workout-run-set" data-done={set.done} key={set.id}>
                <div className="workout-run-set-fields">
                  <span className="workout-run-set-number">{setIndex + 1}</span>
                  {(["reps", "carga"] as const).map((key) => (
                    <Input
                      key={key}
                      aria-label={`${exercise.nome} série ${setIndex + 1} ${key === "reps" ? "repetições" : "carga"}`}
                      inputMode={key === "reps" ? "numeric" : "decimal"}
                      value={set[key]}
                      onChange={(event) => {
                        const value = event.target.value;
                        if ((key === "reps" ? /^\d*$/ : /^\d*([.,]\d*)?$/).test(value))
                          change(exerciseIndex, (current) => ({
                            ...current,
                            sets: current.sets.map((item) =>
                              item.id === set.id ? { ...item, [key]: value } : item,
                            ),
                          }));
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    aria-label="Concluir série"
                    aria-description={`${exercise.nome}, série ${setIndex + 1}${set.done ? ", já concluída; toque para desfazer" : ""}`}
                    aria-pressed={set.done}
                    className="workout-run-complete"
                    onClick={() => {
                      update((current) => ({
                        ...current,
                        exercises: current.exercises.map((item) =>
                          (item.plan_item_id ?? item.exercise_id) !==
                          (exercise.plan_item_id ?? exercise.exercise_id)
                            ? item
                            : {
                                ...item,
                                sets: item.sets.map((series) =>
                                  series.id === set.id ? { ...series, done: !series.done } : series,
                                ),
                              },
                        ),
                        restUntil: !current.exercises
                          .find((item) => item.sets.some((series) => series.id === set.id))
                          ?.sets.find((series) => series.id === set.id)?.done
                          ? Date.now() + exercise.descanso_seg * 1000
                          : current.restUntil,
                      }));
                      navigator.vibrate?.(40);
                    }}
                  >
                    <Check size={22} aria-hidden="true" />
                  </button>
                </div>
                <div className="workout-run-set-options">
                  <select
                    aria-label="Tipo da série"
                    aria-description={`${exercise.nome}, série ${setIndex + 1}`}
                    value={set.kind}
                    onChange={(event) =>
                      change(exerciseIndex, (current) => ({
                        ...current,
                        sets: current.sets.map((item) =>
                          item.id === set.id ? { ...item, kind: event.target.value } : item,
                        ),
                      }))
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="warmup">Aquecimento</option>
                    <option value="drop">Drop-set</option>
                    <option value="failure">Falha</option>
                  </select>
                  {set.done && <span className="workout-run-set-status">Concluída</span>}
                  <button
                    type="button"
                    aria-label="Remover série"
                    aria-description={`${exercise.nome}, série ${setIndex + 1}`}
                    onClick={() =>
                      change(exerciseIndex, (current) => ({
                        ...current,
                        sets: current.sets.filter((item) => item.id !== set.id),
                      }))
                    }
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="workout-run-add"
              onClick={() =>
                change(exerciseIndex, (current) => ({
                  ...current,
                  sets: [
                    ...current.sets,
                    {
                      ...(current.sets.at(-1) || { reps: "10", carga: "0", kind: "normal" }),
                      id: crypto.randomUUID(),
                      done: false,
                    },
                  ],
                }))
              }
            >
              <Plus size={18} aria-hidden="true" /> Adicionar série
            </button>
            <details className="workout-run-history">
              <summary>Séries anteriores</summary>
              {historyRows.some((entry) => entry.exercise_id === exercise.exercise_id) ? (
                historyRows
                  .filter((entry) => entry.exercise_id === exercise.exercise_id)
                  .slice(0, 12)
                  .map((entry, i) => (
                    <p key={i}>
                      {entry.repeticoes} repetições × {entry.carga_kg} kg
                    </p>
                  ))
              ) : (
                <p>Nenhuma série anterior disponível nesta sessão.</p>
              )}
            </details>
          </section>
        ))}
        {!draft.exercises.length && (
          <section className="workout-run-exercise">
            <h2>Este treino está vazio</h2>
            <p>Adicione exercícios ao treino para começar.</p>
            <Link className="workout-run-add" to="/workouts">
              Voltar aos treinos
            </Link>
          </section>
        )}
      </div>
      <footer className="workout-run-footer">
        <Button
          disabled={saving || !draft.exercises.length}
          onClick={async () => {
            if (!stats.sets) return toast.error("Conclua ao menos uma série.");
            if (!confirm("Finalizar o treino com as séries concluídas?")) return;
            setSaving(true);
            const current = draftRef.current;
            if (!current) {
              setSaving(false);
              return;
            }
            const finished = { ...current, finished: Date.now(), restUntil: 0 };
            if (!apply(finished)) {
              setSaving(false);
              return;
            }
            try {
              await syncDraft(finished);
            } catch {
              toast("Treino salvo no aparelho. Será sincronizado ao reconectar.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Salvando treino…" : "Finalizar treino"}
        </Button>
      </footer>
    </main>
  );
}
