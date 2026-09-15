import { Medal } from "@/components/Medal";
import { ACHIEVEMENTS_CATALOG } from "@/lib/achievements";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Lock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Achievement = Database["public"]["Tables"]["achievements"]["Row"];

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "eForge — Conquistas" }] }),
  component: AchievementsPage,
});

const CATALOG = Object.entries(ACHIEVEMENTS_CATALOG).map(([codigo, value]) => ({codigo, ...value}));

function AchievementsPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<Record<string, Achievement>>({});
  const [doneGoals, setDoneGoals] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("achievements").select("*").eq("desbloqueada", true);
      const map: Record<string, Achievement> = {};
      (data ?? []).forEach(a => { map[a.codigo] = a; });
      setUnlocked(map);
      const { count } = await supabase.from("goals").select("*", { count: "exact", head: true }).eq("status", "concluida");
      setDoneGoals(count ?? 0);
    })();
  }, [user?.id]);

  const totalUnlocked = Object.keys(unlocked).length;
  const focoProgress = Math.min(100, (doneGoals / 5) * 100);

  return (
    <main className="mx-auto max-w-md px-5 pt-12 pb-4">
      <h1 className="text-3xl font-black">Conquistas</h1>
      <p className="mt-1 text-sm text-muted-foreground">{totalUnlocked} de {CATALOG.length} medalhas desbloqueadas</p>

      <div className="mt-6 rounded-3xl border border-neon/30 surface p-5 glow-neon-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-neon text-primary-foreground glow-neon">
            <Trophy className="size-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Próxima conquista</p>
            <p className="font-bold">Foco Total</p>
            <p className="text-xs text-muted-foreground">{doneGoals} / 5 metas concluídas</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full"
            style={{ width: `${focoProgress}%`, background: "linear-gradient(90deg, var(--neon-soft), var(--neon-strong))" }} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {CATALOG.map(m => {
          const got = unlocked[m.codigo];
          return (
            <div key={m.codigo}
              className={`eforge-medal-card relative overflow-hidden rounded-3xl p-4 transition-all ${
                got
                  ? "border border-neon/40 surface glow-neon-soft"
                  : "border border-border surface"
              }`}>
              <Medal code={m.codigo} unlocked={!!got} />
              <p className="mt-3 text-sm font-black leading-tight">{m.medalha}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{m.descricao}</p>
              {got?.data_conquista && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-neon">
                  {new Date(got.data_conquista).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
