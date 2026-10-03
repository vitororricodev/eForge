import type { MuscleKey, MuscleRole, MuscleState } from "@/components/MuscleBody";
import {
  buildMuscleState,
  resolveMuscleKeys,
  type MuscleActivityEntry,
  type TrainingWeekWindow,
} from "./muscle-activity";
import type { Draft } from "./workout-storage";

export type MuscleFields = {
  musculo_principal: string | null;
  musculos_primarios?: string[] | null;
  musculos_secundarios: string[] | null;
  musculos_terciarios?: string[] | null;
};
export type CompletedMuscleSet = MuscleFields & { id: string; session_id: string; kind: string };
export type MuscleSummary = Partial<Record<MuscleKey, { sets: number; sessions: number }>>;
// Preserve each snapshot's role. A muscle is counted once per set, with the strongest role winning.
export function muscleStateFromSets(rows: CompletedMuscleSet[]): MuscleState {
  const seenSets = new Set<string>();
  const entries: MuscleActivityEntry[] = [];
  for (const row of rows) {
    if (row.kind === "warmup" || seenSets.has(row.id)) continue;
    seenSets.add(row.id);
    const seenMuscles = new Set<MuscleKey>();
    const groups: [MuscleRole, (string | null)[]][] = [
      [
        "primary",
        row.musculos_primarios?.length ? row.musculos_primarios : [row.musculo_principal],
      ],
      ["secondary", row.musculos_secundarios ?? []],
      ["tertiary", row.musculos_terciarios ?? []],
    ];
    for (const [role, muscles] of groups) {
      for (const key of muscles.flatMap(resolveMuscleKeys)) {
        if (seenMuscles.has(key)) continue;
        seenMuscles.add(key);
        entries.push({ muscle: key, role });
      }
    }
  }
  return buildMuscleState(entries);
}
export function relatedMuscles(row: MuscleFields): MuscleKey[] {
  return [
    ...new Set(
      [
        row.musculo_principal,
        ...(row.musculos_primarios ?? []),
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
          musculos_primarios: exercise.musculos_primarios ?? [exercise.musculo_principal],
          musculos_secundarios: exercise.musculos_secundarios,
          musculos_terciarios: exercise.musculos_terciarios ?? [],
        })),
    ),
  ];
}
