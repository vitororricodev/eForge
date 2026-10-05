import { supabase } from "@/integrations/supabase/client";
import { type Draft, number, totals, saveDraft, readDraft } from "./workout-storage";

let busy = false;
export async function syncDraft(draft: Draft) {
  if (busy || !navigator.onLine) return false;
  busy = true;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user.id !== draft.userId) return false;
    // Read after auth awaits: the caller's snapshot may already be stale.
    const current = readDraft(draft.userId);
    if (!current || current.id !== draft.id) return false;
    if (current.finished && current.synced) return true;
    if (!current.finished && !current.plannedExercises) return false;
    const { error } = await supabase.rpc(
      "save_workout_snapshot" as never,
      {
        payload: {
          id: current.id,
          workout_id: current.workoutId,
          nome_treino: current.name,
          iniciado_em: new Date(current.started).toISOString(),
          finalizado_em: current.finished ? new Date(current.finished).toISOString() : null,
          volume_total: totals(current).volume,
          sets: current.exercises.flatMap((exercise) =>
            exercise.sets.map((set, index) => ({
              id: set.id,
              exercise_id: exercise.exercise_id,
              nome_exercicio: exercise.nome,
              musculo_principal: exercise.musculo_principal,
              musculos_primarios: exercise.musculos_primarios?.length
                ? exercise.musculos_primarios
                : [exercise.musculo_principal],
              musculos_secundarios: exercise.musculos_secundarios,
              musculos_terciarios: exercise.musculos_terciarios ?? [],
              serie_numero: index + 1,
              repeticoes: number(set.reps),
              carga_kg: number(set.carga),
              concluida: set.done,
              kind: set.kind,
            })),
          ),
        },
      } as never,
    );
    if (error) throw error;
    const latest = readDraft(current.userId);
    if (current.finished && latest?.id === current.id && latest.revision === current.revision)
      saveDraft({ ...latest, synced: true });
    return true;
  } finally {
    busy = false;
  }
}
