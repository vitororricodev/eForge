import type { MuscleKey, MuscleRole, MuscleState } from "@/components/MuscleBody";
import type { Draft } from "@/lib/workout-storage";

export type MuscleActivityEntry = {
  muscle: string;
  role: MuscleRole;
  weight?: number;
};

const ROLE_WEIGHT: Record<MuscleRole, number> = {
  primary: 1,
  secondary: 0.55,
  tertiary: 0.25,
};

const ROLE_PRIORITY: Record<MuscleRole, number> = {
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const MUSCLE_ALIASES: Record<string, MuscleKey[]> = {
  chest: ["chest"],
  peito: ["chest"],
  peitoral: ["chest"],
  abs: ["abs"],
  abdomen: ["abs"],
  abdominal: ["abs"],
  abdominais: ["abs"],
  core: ["abs", "obliques"],
  obliques: ["obliques"],
  obliquos: ["obliques"],
  shoulders: ["shoulders"],
  shoulder: ["shoulders"],
  ombro: ["shoulders"],
  ombros: ["shoulders"],
  biceps: ["biceps"],
  biceps_braquial: ["biceps"],
  forearms: ["forearms"],
  forearm: ["forearms"],
  antebraco: ["forearms"],
  antebracos: ["forearms"],
  quads: ["quads"],
  quadriceps: ["quads"],
  calves: ["calves"],
  calf: ["calves"],
  panturrilha: ["calves"],
  panturrilhas: ["calves"],
  traps: ["traps"],
  trap: ["traps"],
  trapezio: ["traps"],
  trapezios: ["traps"],
  lats: ["lats"],
  lat: ["lats"],
  costas: ["lats"],
  dorsal: ["lats"],
  dorsais: ["lats"],
  back: ["lats"],
  lower_back: ["lower_back"],
  lombar: ["lower_back"],
  glutes: ["glutes"],
  glute: ["glutes"],
  gluteo: ["glutes"],
  gluteos: ["glutes"],
  hamstrings: ["hamstrings"],
  hamstring: ["hamstrings"],
  posterior: ["hamstrings"],
  posterior_de_coxa: ["hamstrings"],
  posteriores: ["hamstrings"],
  triceps: ["triceps"],
  rear_delts: ["rear_delts"],
  rear_delt: ["rear_delts"],
  deltoide_posterior: ["rear_delts"],
  deltoides_posteriores: ["rear_delts"],
  ombro_posterior: ["rear_delts"],
};

export function resolveMuscleKeys(value: string | null | undefined): MuscleKey[] {
  if (!value) return [];
  return MUSCLE_ALIASES[normalize(value)] ?? [];
}

function scoreToLevel(score: number) {
  if (score >= 6) return 4;
  if (score >= 3) return 3;
  if (score >= 1.5) return 2;
  if (score > 0) return 1;
  return 0;
}

export function buildMuscleState(entries: MuscleActivityEntry[]): MuscleState {
  const scores = new Map<MuscleKey, { score: number; role: MuscleRole }>();

  for (const entry of entries) {
    const keys = resolveMuscleKeys(entry.muscle);
    const contribution = entry.weight ?? ROLE_WEIGHT[entry.role];
    for (const key of keys) {
      const current = scores.get(key);
      scores.set(key, {
        score: (current?.score ?? 0) + contribution,
        role:
          !current || ROLE_PRIORITY[entry.role] > ROLE_PRIORITY[current.role]
            ? entry.role
            : current.role,
      });
    }
  }

  const state: MuscleState = {};
  for (const [key, value] of scores) {
    state[key] = {
      role: value.role,
      score: value.score,
      level: scoreToLevel(value.score),
    };
  }
  return state;
}

export function draftMuscleEntries(draft: Draft): MuscleActivityEntry[] {
  return draft.exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set) => {
      if (!set.done || set.kind === "warmup") return [];
      return [
        { muscle: exercise.musculo_principal, role: "primary" as const },
        ...(exercise.musculos_secundarios ?? []).map((muscle) => ({
          muscle,
          role: "secondary" as const,
        })),
        ...(exercise.musculos_terciarios ?? []).map((muscle) => ({
          muscle,
          role: "tertiary" as const,
        })),
      ];
    }),
  );
}

export function muscleRoleLabel(role: MuscleRole) {
  if (role === "primary") return "Principal";
  if (role === "secondary") return "Secundário";
  return "Terciário";
}
