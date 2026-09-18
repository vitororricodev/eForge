import type { MuscleKey } from "@/components/MuscleBody";
import { resolveMuscleKeys, type TrainingWeekWindow } from "./muscle-activity";
import type { Draft } from "./workout-storage";

export type MuscleFields = {
  musculo_principal: string | null;
  musculos_secundarios: string[] | null;
  musculos_terciarios?: string[] | null;
};
export type CompletedMuscleSet = MuscleFields & { id: string; session_id: string; kind: string };
export type MuscleSummary = Partial<Record<MuscleKey, { sets: number; sessions: number }>>;
export function relatedMuscles(row: MuscleFields): MuscleKey[] {
  return [
    ...new Set(
      [
        row.musculo_principal,
        ...(row.musculos_secundarios ?? []),
        ...(row.musculos_terciarios ?? []),
      ].flatMap(resolveMuscleKeys),
    ),
  ];
}
export function summarizeMuscleSets(rows: CompletedMuscleSet[]): MuscleSummary {
  const groups = new Map<MuscleKey, { sets: Set<string>; sessions: Set<string> }>();
  for (const row of rows) {
    if (row.kind === "warmup") continue;
    for (const key of relatedMuscles(row)) {
      const group = groups.get(key) ?? { sets: new Set<string>(), sessions: new Set<string>() };
      group.sets.add(row.id);
      group.sessions.add(row.session_id);
      groups.set(key, group);
    }
  }
  return Object.fromEntries(
    [...groups].map(([key, group]) => [
      key,
      { sets: group.sets.size, sessions: group.sessions.size },
    ]),
  );
}
// Only finished drafts belonging to this user/week are considered. IDs prevent double counting during sync.
export function mergeLocalMuscleSets(
  rows: CompletedMuscleSet[],
  draft: Draft | null,
  userId: string,
  week: TrainingWeekWindow,
): CompletedMuscleSet[] {
  if (
    !draft ||
    draft.userId !== userId ||
    !draft.finished ||
    draft.synced ||
    draft.started < week.start.getTime() ||
    draft.started >= week.end.getTime()
  )
    return rows;
  const ids = new Set(rows.map((row) => row.id));
  return [
    ...rows,
    ...draft.exercises.flatMap((exercise) =>
      exercise.sets
        .filter((set) => set.done && !ids.has(set.id))
        .map((set) => ({
          id: set.id,
          session_id: draft.id,
          kind: set.kind,
          musculo_principal: exercise.musculo_principal,
          musculos_secundarios: exercise.musculos_secundarios,
          musculos_terciarios: exercise.musculos_terciarios ?? [],
        })),
    ),
  ];
}
