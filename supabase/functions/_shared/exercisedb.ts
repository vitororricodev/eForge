// Pure integration contract, shared by the Edge Function and local tests.
export type CatalogMuscleKey =
  | "chest"
  | "abs"
  | "obliques"
  | "shoulders"
  | "biceps"
  | "forearms"
  | "quads"
  | "calves"
  | "traps"
  | "lats"
  | "lower_back"
  | "glutes"
  | "hamstrings"
  | "triceps"
  | "rear_delts";
export interface ExerciseDBExercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
}
export interface MuscleMapping {
  source_name: string;
  muscle_keys: CatalogMuscleKey[];
  status: "mapped" | "pending" | "unsupported";
}
export interface SyncResult {
  id: string;
  status: "running" | "completed" | "failed";
  received: number;
  new_count: number;
  updated_count: number;
  ignored_count: number;
  error_count: number;
  total: number | null;
  cursor: string | null;
  has_next: boolean;
  started_at: string;
  finished_at: string | null;
  last_error: string | null;
  errors: { external_id?: string; message: string }[];
}
export const DEFAULT_MUSCLE_MAPPING: MuscleMapping[] = Object.entries({
  pectorals: ["chest"],
  abdominals: ["abs"],
  obliques: ["obliques"],
  deltoids: ["shoulders"],
  "rear deltoids": ["rear_delts"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  quadriceps: ["quads"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
  soleus: ["calves"],
  "latissimus dorsi": ["lats"],
  lats: ["lats"],
  trapezius: ["traps"],
  traps: ["traps"],
  // Erector spinae extends beyond the lower back; the existing avatar exposes only a lumbar region.
  // Broad/ambiguous groups (back, core, upper back, etc.) are deliberately left for review.
}).map(([source_name, keys]) => ({
  source_name,
  muscle_keys: keys as CatalogMuscleKey[],
  status: "mapped",
}));
export const normalizeMuscleName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function text(v: unknown, field: string, max = 6000): string {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new Error(`Campo inválido: ${field}`);
  return v.trim();
}
function list(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.length > 100) throw new Error(`Lista inválida: ${field}`);
  return [...new Set(v.map((x) => text(x, field)))];
}
export function parseExercise(value: unknown): ExerciseDBExercise {
  if (!object(value)) throw new Error("Exercício inválido");
  const id = text(value.exerciseId, "exerciseId", 120);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("ID externo inválido");
  const gifUrl = typeof value.gifUrl === "string" ? value.gifUrl.trim() : "";
  if (gifUrl) {
    const url = new URL(gifUrl);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("URL de mídia inválida");
  }
  return {
    exerciseId: id,
    name: text(value.name, "name", 300),
    gifUrl,
    bodyParts: list(value.bodyParts, "bodyParts"),
    equipments: list(value.equipments, "equipments"),
    targetMuscles: list(value.targetMuscles, "targetMuscles"),
    secondaryMuscles: list(value.secondaryMuscles, "secondaryMuscles"),
    instructions: list(value.instructions, "instructions"),
  };
}
export function normalizeExercise(exercise: ExerciseDBExercise, mappings = DEFAULT_MUSCLE_MAPPING) {
  const lookup = new Map(mappings.map((m) => [normalizeMuscleName(m.source_name), m]));
  const unknown = new Set<string>();
  const convert = (names: string[]) => [
    ...new Set(
      names.flatMap((name) => {
        const mapping = lookup.get(normalizeMuscleName(name));
        if (
          !mapping ||
          mapping.status === "pending" ||
          (mapping.status === "mapped" && !mapping.muscle_keys.length)
        ) {
          unknown.add(normalizeMuscleName(name));
          return [];
        }
        return mapping.status === "mapped" ? mapping.muscle_keys : [];
      }),
    ),
  ];
  const primary = convert(exercise.targetMuscles);
  const secondary = convert(exercise.secondaryMuscles).filter((key) => !primary.includes(key));
  return {
    external_id: exercise.exerciseId,
    nome: exercise.name,
    name_original: exercise.name,
    slug: `${exercise.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${exercise.exerciseId}`,
    gif_url: exercise.gifUrl || null,
    equipamentos: exercise.equipments,
    partes_corpo: exercise.bodyParts,
    instrucoes: exercise.instructions,
    musculo_principal: primary[0] ?? "",
    musculos_primarios: primary,
    musculos_secundarios: secondary,
    unmapped_muscles: [...unknown],
    review_status: unknown.size || !primary.length ? ("pending" as const) : ("approved" as const),
    external_data: exercise,
    // Tertiaries, difficulty and Portuguese translation are not provided by this API.
  };
}
export function parsePage(value: unknown) {
  if (!object(value) || value.success !== true || !object(value.meta) || !Array.isArray(value.data))
    throw new Error("Resposta inválida da ExerciseDB");
  const meta = value.meta;
  if (
    typeof meta.hasNextPage !== "boolean" ||
    typeof meta.total !== "number" ||
    !Number.isInteger(meta.total) ||
    meta.total < 0 ||
    value.data.length > 25
  )
    throw new Error("Paginação inválida da ExerciseDB");
  const nextCursor =
    typeof meta.nextCursor === "string" && /^[\w-]{1,120}$/.test(meta.nextCursor)
      ? meta.nextCursor
      : null;
  if (meta.hasNextPage && (!nextCursor || !value.data.length))
    throw new Error("Página sem cursor de continuação");
  return {
    values: value.data as unknown[],
    total: meta.total,
    hasNextPage: meta.hasNextPage,
    nextCursor,
  };
}
export async function fetchExercisePage(
  cursor: string | null,
  options: {
    fetcher?: typeof fetch;
    timeoutMs?: number;
    attempts?: number;
    wait?: (ms: number) => Promise<void>;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const url = new URL("https://oss.exercisedb.dev/api/v1/exercises");
  url.searchParams.set("limit", "25");
  if (cursor) url.searchParams.set("after", cursor);
  const attempts = Math.min(options.attempts ?? 3, 3);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
    let retryMs = 1000 * 2 ** attempt;
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        redirect: "error",
      });
      if (!response.ok) {
        if (![429, 500, 502, 503, 504].includes(response.status))
          throw new PermanentApiError(`ExerciseDB retornou HTTP ${response.status}`);
        const header = response.headers.get("Retry-After");
        const seconds =
          header && /^\d+$/.test(header)
            ? Number(header)
            : header
              ? Math.max(0, (Date.parse(header) - Date.now()) / 1000)
              : 0;
        // A long rate limit is surfaced for later resume, not retried prematurely.
        if (seconds > 30)
          throw new PermanentApiError(
            "Limite da ExerciseDB atingido. Aguarde e retome a sincronização.",
          );
        retryMs = Math.max(retryMs, Math.min(seconds || 0, 30) * 1000);
        throw new Error("Falha temporária da ExerciseDB");
      }
      const body: unknown = await response.json();
      return parsePage(body);
    } catch (error) {
      if (error instanceof PermanentApiError || attempt === attempts - 1)
        throw new Error(
          error instanceof PermanentApiError
            ? error.message
            : "Falha ao consultar a ExerciseDB. Retome a sincronização.",
        );
    } finally {
      clearTimeout(timer);
    }
    await wait(retryMs);
  }
  throw new Error("Não foi possível consultar a ExerciseDB");
}
class PermanentApiError extends Error {}
