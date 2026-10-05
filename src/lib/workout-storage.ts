export type Series = { id: string; reps: string; carga: string; done: boolean; kind: string };
export type Exercise = {
  exercise_id: string;
  // Identifies the planned slot even when its exercise is replaced during the session.
  plan_item_id?: string;
  nome: string;
  musculo_principal: string;
  musculos_primarios?: string[];
  musculos_secundarios: string[];
  musculos_terciarios?: string[];
  descanso_seg: number;
  previous?: string;
  sets: Series[];
};
export type Draft = {
  id: string;
  userId: string;
  workoutId: string;
  name: string;
  started: number;
  restUntil: number;
  exercises: Exercise[];
  // Starting plan, used only to recover missing exercises, never to reset series.
  plannedExercises?: Exercise[];
  revision?: number;
  finished?: number;
  synced?: boolean;
};
export const draftKey = (userId: string) => `eforge:v1:${userId}:draft`;
const exerciseKey = (exercise: Exercise) => exercise.plan_item_id ?? exercise.exercise_id;

export function restoreDraftExercises(draft: Draft, backup = draft.plannedExercises): Draft {
  if (!backup?.length) return draft;
  const keys = new Set(draft.exercises.map(exerciseKey));
  const missing = backup.filter(
    (exercise) =>
      !keys.has(exerciseKey(exercise)) &&
      !draft.exercises.some(
        (item) =>
          item.exercise_id === exercise.exercise_id &&
          (!item.plan_item_id || !exercise.plan_item_id),
      ),
  );
  if (!missing.length) return draft;
  const order = new Map(backup.map((exercise, index) => [exerciseKey(exercise), index]));
  const exercises = [...draft.exercises, ...structuredClone(missing)];
  exercises.sort(
    (a, b) =>
      (order.get(exerciseKey(a)) ?? backup.length) - (order.get(exerciseKey(b)) ?? backup.length),
  );
  return { ...draft, exercises };
}

// Upgrade pre-fix drafts against the registered plan, preserving progress and replacements.
export function attachWorkoutPlan(draft: Draft, plan: Exercise[]): Draft {
  if (draft.finished || draft.plannedExercises) return restoreDraftExercises(draft);
  const available = new Map(plan.map((exercise) => [exerciseKey(exercise), exercise]));
  const exercises = draft.exercises.map((exercise) => {
    const original =
      available.get(exerciseKey(exercise)) ??
      [...available.values()].find((item) => item.exercise_id === exercise.exercise_id);
    if (!original) return exercise;
    available.delete(exerciseKey(original));
    return { ...exercise, plan_item_id: original.plan_item_id };
  });
  // Old substitutions have no slot identity. Keep their records and bind them
  // to unused slots instead of discarding series or re-adding the original exercise.
  exercises.forEach((exercise, index) => {
    if (exercise.plan_item_id) return;
    const original =
      available.get(exerciseKey(plan[index] ?? exercise)) ?? available.values().next().value;
    if (!original) return;
    available.delete(exerciseKey(original));
    exercises[index] = { ...exercise, plan_item_id: original.plan_item_id };
  });
  return restoreDraftExercises({ ...draft, exercises, plannedExercises: structuredClone(plan) });
}

export function readDraft(userId: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(userId)) || "null");
    return draft?.userId === userId && Array.isArray(draft.exercises)
      ? restoreDraftExercises(draft)
      : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): Draft {
  const current = readDraft(draft.userId);
  const sameSession = current?.id === draft.id && current.workoutId === draft.workoutId;
  if (sameSession && current.finished && !draft.finished) return current;
  let next = draft;
  if (sameSession) {
    // A timer, stale tab or delayed callback cannot truncate the exercise list.
    next = restoreDraftExercises(
      { ...draft, plannedExercises: current.plannedExercises ?? draft.plannedExercises },
      current.exercises,
    );
  }
  next = restoreDraftExercises(next);
  next = { ...next, revision: (sameSession ? (current.revision ?? 0) : 0) + 1 };
  localStorage.setItem(draftKey(next.userId), JSON.stringify(next));
  return next;
}

export function number(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
export function totals(draft: Draft) {
  return draft.exercises.reduce(
    (total, exercise) => {
      for (const set of exercise.sets)
        if (set.done) {
          total.sets++;
          total.volume += number(set.reps) * number(set.carga);
        }
      return total;
    },
    { sets: 0, volume: 0 },
  );
}
export function remaining(until: number, now = Date.now()) {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
