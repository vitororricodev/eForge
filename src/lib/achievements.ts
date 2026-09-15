import { supabase } from "@/integrations/supabase/client";

export const ACHIEVEMENTS_CATALOG: Record<string, { medalha: string; descricao: string }> = {
  primeira_meta: { medalha: "Primeira Meta Batida", descricao: "Você concluiu sua primeira meta!" },
  semana_perfeita: { medalha: "Semana Perfeita", descricao: "Treinou todos os dias planejados na semana." },
  recorde_carga: { medalha: "Recorde de Carga", descricao: "Bateu um novo recorde pessoal de carga." },
  recorde_distancia: { medalha: "Recorde de Distância", descricao: "Bateu um novo recorde pessoal de distância." },
  evolucao_corporal: { medalha: "Evolução Corporal", descricao: "Atingiu sua meta de peso ou medidas." },
  consistencia_mensal: { medalha: "Consistência Mensal", descricao: "Manteve treinos consistentes por um mês." },
  guerreiro_cardio: { medalha: "Guerreiro do Cardio", descricao: "Concluiu uma meta de cardio." },
  foco_total: { medalha: "Foco Total", descricao: "Concluiu 5 metas no total." },
  corpo_evolucao: { medalha: "Corpo em Evolução", descricao: "Concluiu uma meta de medidas corporais." },
  primeiro_treino: { medalha: "Primeiro Treino", descricao: "Concluiu seu primeiro treino no eForge." },
  dez_treinos: { medalha: "Dez Treinos", descricao: "Concluiu 10 treinos registrados." },
};

/** Unlocks an achievement for the current user. Returns the medal name when newly unlocked. */
export async function unlockAchievement(userId: string, codigo: string): Promise<string | null> {
  const meta = ACHIEVEMENTS_CATALOG[codigo];
  if (!meta) return null;
  const { data: existing } = await supabase
    .from("achievements")
    .select("*")
    .eq("codigo", codigo)
    .maybeSingle();
  if (existing?.desbloqueada) return null;
  if (existing) {
    await supabase
      .from("achievements")
      .update({ desbloqueada: true, data_conquista: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("achievements").insert({
      user_id: userId,
      codigo,
      medalha: meta.medalha,
      descricao: meta.descricao,
      desbloqueada: true,
      data_conquista: new Date().toISOString(),
    });
  }
  return meta.medalha;
}

/** Checks workout-count based achievements after finishing a session. */
export async function checkWorkoutAchievements(userId: string): Promise<string | null> {
  const { count } = await supabase
    .from("workout_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "concluida");
  const total = count ?? 0;
  if (total >= 10) {
    const m = await unlockAchievement(userId, "dez_treinos");
    if (m) return m;
  }
  if (total >= 1) return unlockAchievement(userId, "primeiro_treino");
  return null;
}
