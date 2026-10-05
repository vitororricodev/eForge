import { z } from "zod";

export const sharedItemSchema = z.object({
  item_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  nome: z.string(),
  gif_url: z.string().nullable(),
  musculo_principal: z.string(),
  musculos_primarios: z.array(z.string()),
  musculos_secundarios: z.array(z.string()),
  categoria: z.string().nullable(),
  equipamentos: z.array(z.string()),
  descricao: z.string().nullable(),
  instrucoes: z.array(z.string()),
  series: z.number().int(),
  repeticoes: z.number().int(),
  carga_kg: z.number().nullable(),
  descanso_seg: z.number().int(),
  available: z.boolean(),
});
export const sharedWorkoutSchema = z.object({
  nome: z.string(),
  descricao: z.string().nullable(),
  created_at: z.string(),
  items: z.array(sharedItemSchema),
});
export const shareLinkSchema = z.object({
  id: z.string().uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string(),
});
export type SharedWorkout = z.infer<typeof sharedWorkoutSchema>;
export type ShareLink = z.infer<typeof shareLinkSchema>;

export function shareOrigin(
  configured: string | undefined,
  currentOrigin: string,
  native: boolean,
): string | undefined {
  const value = configured?.trim() || (native ? "" : currentOrigin);
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.username || url.password) return;
    if (
      url.protocol === "https:" ||
      (!native && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return url.origin;
  } catch {
    return;
  }
}

// Só permite voltar para uma página pública de treino deste aplicativo.
export function shareReturnPath(value: unknown): string | undefined {
  return typeof value === "string" && /^\/share\/[a-f0-9]{64}$/.test(value) ? value : undefined;
}

const returnKey = "eforge:share-return";
export function rememberShareReturn(path: unknown): void {
  try {
    const safe = shareReturnPath(path);
    if (safe)
      sessionStorage.setItem(
        returnKey,
        JSON.stringify({ path: safe, expires: Date.now() + 30 * 60 * 1000 }),
      );
    else sessionStorage.removeItem(returnKey);
  } catch {
    /* O link também continua na URL de entrada. */
  }
}
export function consumeShareReturn(): string | undefined {
  try {
    const raw = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.expires > Date.now()) return shareReturnPath(saved.path);
  } catch {
    return;
  }
}

export function moveTo<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string")
    return error.message;
  return fallback;
}
