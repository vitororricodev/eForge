import { z } from "zod";
import type { MuscleKey } from "@/components/MuscleBody";
export type ExerciseSource = "exercisedb" | "eforge" | "user";
export type ExerciseVisibility = "public" | "private";
export const exerciseSchema = z.object({
  gif_path: z.string().nullable().default(null),
  gif_sha256: z.string().nullable().default(null),
  musculo_principal_anatomico: z.string().nullable().default(null),
  classification_confidence: z.enum(["alta", "media", "baixa"]).nullable().default(null),
  catalog_deleted_at: z.string().nullable().optional(),
  equipamentos_pt_br: z.array(z.string()).default([]),
  partes_corpo_pt_br: z.array(z.string()).default([]),
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  nome: z.string(),
  gif_url: z.string().nullable(),
  tipo_controle: z.enum(["peso_corporal", "peso_kg", "repeticoes", "segundos", "distancia"]),
  categoria: z.enum(["musculacao", "cardio", "funcional", "alongamento"]),
  musculo_principal: z.string(),
  musculos_primarios: z.array(z.string()),
  musculos_secundarios: z.array(z.string()),
  musculos_terciarios: z.array(z.string()),
  visibility: z.enum(["private", "public"]),
  source: z.enum(["user", "eforge", "exercisedb"]),
  external_id: z.string().nullable(),
  name_original: z.string().nullable(),
  name_pt_br: z.string().nullable(),
  slug: z.string().nullable(),
  descricao: z.string().nullable(),
  equipamentos: z.array(z.string()),
  partes_corpo: z.array(z.string()),
  instrucoes: z.array(z.string()),
  instrucoes_pt_br: z.array(z.string()),
  dificuldade: z.string().nullable(),
  active: z.boolean(),
  review_status: z.enum(["approved", "pending"]),
  classification_reviewed: z.boolean(),
  unmapped_muscles: z.array(z.string()),
  observacoes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_synced_at: z.string().nullable(),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export const catalogPageSchema = z.object({
  items: z.array(exerciseSchema),
  total: z.number().int().nonnegative(),
});
export interface CatalogFilters {
  query?: string;
  muscles?: MuscleKey[];
  equipment?: string;
  primaryMuscle?: string;
  secondaryMuscle?: string;
  visibility?: ExerciseVisibility;
  bodyPart?: string;
  category?: string;
  control?: string;
  source?: ExerciseSource;
  page?: number;
  pageSize?: number;
  review?: boolean;
}
export const MUSCLE_GROUPS: { label: string; value: string; muscles: MuscleKey[] }[] = [
  {
    label: "Tronco",
    value: "trunk",
    muscles: ["chest", "abs", "obliques", "lats", "lower_back", "traps"],
  },
  {
    label: "Membros superiores",
    value: "upper",
    muscles: ["shoulders", "rear_delts", "biceps", "triceps", "forearms"],
  },
  {
    label: "Membros inferiores",
    value: "lower",
    muscles: ["glutes", "quads", "hamstrings", "calves"],
  },
];
