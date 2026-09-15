import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Trophy, TrendingUp, Activity, Dumbbell, ChevronRight, Bell, Target, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "eForge — Dashboard" },
      { name: "description", content: "Sua ofensiva, volume da semana, metas ativas e conquistas em um só lugar." },
      { property: "og:title", content: "eForge — Dashboard" },
      { property: "og:description", content: "Ofensiva, volume, metas e conquistas em um só lugar." },
    ],
  }),
  component: Dashboard,
});

type SessionLite = { id: string; nome_treino: string; iniciado_em: string; volume_total: number; duracao_min: number | null };
type GoalLite = { id: string; titulo: string; valor_atual: number; valor_alvo: number; unidade: string; tipo_meta: string };
type AchLite = { medalha: string; descricao: string; desbloqueada: boolean; data_conquista: string | null };

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "atleta";

  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [achievements, setAchievements] = useState<AchLite[]>([]);
  const [nextWorkout, setNextWorkout] = useState<{ id: string; nome: string; count: number } | null>(null);
  const [cardioKm, setCardioKm] = useState(0);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const [s, g, a, w, we, c, m] = await Promise.all([
        supabase.from("workout_sessions").select("id,nome_treino,iniciado_em,volume_total,duracao_min")
          .eq("status", "concluida").gte("iniciado_em", since).order("iniciado_em", { ascending: false }),
        supabase.from("goals").select("id,titulo,valor_atual,valor_alvo,unidade,tipo_meta")
          .eq("status", "ativa").order("created_at", { ascending: false }).limit(3),
        supabase.from("achievements").select("medalha,descricao,desbloqueada,data_conquista")
          .order("data_conquista", { ascending: false, nullsFirst: false }),
        supabase.from("workouts").select("id,nome").order("created_at", { ascending: false }).limit(1),
        supabase.from("workout_exercises").select("id,workout_id"),
        supabase.from("cardio_logs").select("distancia_km,data_atividade")
          .gte("data_atividade", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
        supabase.from("body_measurements").select("weight_kg,measured_at").order("measured_at", { ascending: false }).limit(10),
      ]);
      setSessions((s.data ?? []) as SessionLite[]);
      setGoals((g.data ?? []) as GoalLite[]);
      setAchievements((a.data ?? []) as AchLite[]);
      const first = w.data?.[0];
      if (first) {
        const count = (we.data ?? []).filter((r: { workout_id: string }) => r.workout_id === first.id).length;
        setNextWorkout({ id: first.id, nome: first.nome, count });
      }
      setCardioKm((c.data ?? []).reduce((acc: number, r: any) => acc + (Number(r.distancia_km) || 0), 0));
      const weights = (m.data ?? []).filter((r: any) => r.weight_kg != null);
      if (weights.length >= 2) {
        setWeightDelta(Number(weights[0].weight_kg) - Number(weights[weights.length - 1].weight_kg));
      }
    })();
  }, [user?.id]);

  const weekly = useMemo(() => {
    const labels = ["D", "S", "T", "Q", "Q", "S", "S"];
    const days: { d: string; v: number }[] = [];
    const totals: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * 864e5);
      const key = day.toISOString().slice(0, 10);
      const vol = sessions
        .filter((s) => s.iniciado_em.slice(0, 10) === key)
        .reduce((acc, s) => acc + Number(s.volume_total), 0);
      totals.push(vol);
      days.push({ d: labels[day.getDay()], v: vol });
    }
    const max = Math.max(...totals, 1);
    return {
      bars: days.map((b) => ({ d: b.d, v: Math.round((b.v / max) * 100), raw: b.v })),
      total: totals.reduce((a, b) => a + b, 0),
    };
  }, [sessions]);

  const streak = useMemo(() => {
    const set = new Set(sessions.map((s) => s.iniciado_em.slice(0, 10)));
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const key = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      if (set.has(key)) n++;
      else if (i > 0) break;
    }
    return n;
  }, [sessions]);

  const unlocked = achievements.filter((a) => a.desbloqueada);
  const lastMedal = unlocked[0];
  const nextMedal = achievements.find((a) => !a.desbloqueada);
  const mainGoal = goals[0];
  const goalPct = mainGoal
    ? Math.min(100, Math.round((Number(mainGoal.valor_atual) / Math.max(1, Number(mainGoal.valor_alvo))) * 100))
    : 0;
  const weekGoalPct = Math.min(100, Math.round((new Set(sessions.filter((s) => Date.now() - new Date(s.iniciado_em).getTime() < 7 * 864e5).map((s) => s.iniciado_em.slice(0, 10))).size / 5) * 100));

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Olá,</p>
          <h1 className="mt-1 text-3xl font-black capitalize">{name} 👊</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pronto pra evoluir hoje?</p>
        </div>
        <Link to="/achievements" className="grid size-10 place-items-center rounded-full hairline surface" aria-label="Conquistas">
          <Bell className="size-5" />
        </Link>
      </div>

      {/* Streak / Today */}
      <div className="eforge-hero relative mt-6 overflow-hidden rounded-3xl border border-neon/30 p-5 glow-neon-soft"
        style={{ background: "linear-gradient(135deg, oklch(0.13 0.05 300), oklch(0.06 0 0))" }}>
        <div className="absolute -right-6 -top-6 size-32 rounded-full"
          style={{ background: "radial-gradient(closest-side, oklch(0.76 0.19 300 / 0.4), transparent)" }} />
        <div className="relative flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-neon glow-neon">
            <Flame className="size-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-3xl font-black leading-none">{streak} {streak === 1 ? "dia" : "dias"}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ofensiva atual</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-3xl font-black text-neon text-glow leading-none">{weekGoalPct}%</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">meta semanal</div>
          </div>
        </div>
      </div>

      {/* Next workout */}
      <SectionTitle>Próximo treino</SectionTitle>
      <div className="eforge-hero hairline rounded-3xl surface p-5">
        {nextWorkout ? (
          <>
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-neon/15 text-neon ring-1 ring-neon/30">
                <Dumbbell className="size-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{nextWorkout.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {nextWorkout.count} exercício{nextWorkout.count === 1 ? "" : "s"}
                </div>
              </div>
              <button
                onClick={() => navigate({ to: "/run/$workoutId", params: { workoutId: nextWorkout.id } })}
                className="rounded-full bg-neon px-4 py-2 text-xs font-bold text-primary-foreground glow-neon-soft"
              >
                Iniciar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini value={`${(weekly.total / 1000).toFixed(1)}t`} label="Volume 7d" />
              <Mini value={String(sessions.length)} label="Treinos 30d" />
              <Mini value={String(unlocked.length)} label="Medalhas" />
            </div>
          </>
        ) : (
          <div className="text-center">
            <Dumbbell className="mx-auto size-7 text-neon" />
            <p className="mt-2 font-bold">Nenhum treino criado</p>
            <p className="mt-1 text-xs text-muted-foreground">Monte seu primeiro treino para começar.</p>
            <Link to="/workouts" className="mt-4 inline-flex rounded-full bg-neon px-5 py-2 text-xs font-bold text-primary-foreground glow-neon-soft">
              Criar treino
            </Link>
          </div>
        )}
      </div>

      {/* Goals */}
      <SectionTitle>Sua meta agora</SectionTitle>
      <Link to="/goals" className="block hairline rounded-3xl surface p-5">
        {mainGoal ? (
          <>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-neon/15 text-neon ring-1 ring-neon/30">
                <Target className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{mainGoal.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(mainGoal.valor_atual)} / {Number(mainGoal.valor_alvo)} {mainGoal.unidade}
                </div>
              </div>
              <span className="text-xl font-black text-neon">{goalPct}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${goalPct}%`, background: "linear-gradient(90deg, var(--neon-soft), var(--neon-strong))" }} />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-neon/15 text-neon"><Target className="size-5" /></div>
            <div className="flex-1">
              <div className="font-bold">Defina sua primeira meta</div>
              <div className="text-xs text-muted-foreground">Carga, repetições, frequência ou peso.</div>
            </div>
            <ChevronRight className="size-5 text-neon" />
          </div>
        )}
      </Link>

      {/* Medals */}
      <SectionTitle>Medalhas</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/achievements" className="hairline rounded-3xl surface p-4">
          <div className="grid size-9 place-items-center rounded-lg bg-neon/10 text-neon"><Trophy className="size-5" /></div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Última medalha</div>
          <div className="mt-1 text-base font-black leading-tight">{lastMedal?.medalha ?? "Nenhuma ainda"}</div>
          <div className="text-[11px] text-muted-foreground">
            {lastMedal?.data_conquista
              ? new Date(lastMedal.data_conquista).toLocaleDateString("pt-BR")
              : "conquiste a primeira"}
          </div>
        </Link>
        <Link to="/achievements" className="hairline rounded-3xl surface p-4">
          <div className="grid size-9 place-items-center rounded-lg surface-2 text-muted-foreground"><Lock className="size-4" /></div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Próxima conquista</div>
          <div className="mt-1 text-base font-black leading-tight">{nextMedal?.medalha ?? "Ver catálogo"}</div>
          <div className="truncate text-[11px] text-muted-foreground">{nextMedal?.descricao ?? "9+ medalhas disponíveis"}</div>
        </Link>
      </div>

      {/* Weekly chart */}
      <SectionTitle>Esta semana</SectionTitle>
      <div className="hairline rounded-3xl surface p-5">
        <WeeklyChart bars={weekly.bars} total={weekly.total} />
      </div>

      {/* Grid: muscle map + body + cardio */}
      <SectionTitle>Sua evolução</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/muscle-map" className="group relative col-span-2 overflow-hidden rounded-3xl border border-neon/30 p-5 transition-all hover:glow-neon-soft"
          style={{ background: "linear-gradient(135deg, oklch(0.11 0.04 300 / 0.6), oklch(0.06 0 0))" }}>
          <div className="absolute right-3 top-3"><ChevronRight className="size-5 text-neon" /></div>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-neon/15 text-neon ring-1 ring-neon/40">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-neon">Diferencial</div>
              <div className="text-lg font-black">Mapa Muscular</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Visualize os músculos trabalhados nas suas sessões.</p>
          <div className="mt-4 flex gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="h-2 flex-1 rounded-full"
                style={{ background: `oklch(0.76 0.19 300 / ${0.1 + (i % 5) * 0.18})` }} />
            ))}
          </div>
        </Link>

        <Card icon={<TrendingUp className="size-5" />} title="Evolução corporal"
          value={weightDelta == null ? "—" : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)}kg`}
          sub="registros recentes" trend={weightDelta != null} />
        <Card icon={<Activity className="size-5" />} title="Cardio" value={`${cardioKm.toFixed(1)} km`} sub="esta semana" />
        <Card icon={<Trophy className="size-5" />} title="Conquistas" value={`${unlocked.length}`} sub="desbloqueadas" />
        <Card icon={<Dumbbell className="size-5" />} title="Volume 30d"
          value={`${(sessions.reduce((a, s) => a + Number(s.volume_total), 0) / 1000).toFixed(1)}t`} sub="carga total" trend />
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</h2>;
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl surface-2 px-2 py-2">
      <div className="text-sm font-black text-neon">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({ icon, title, value, sub, trend }: { icon: React.ReactNode; title: string; value: string; sub: string; trend?: boolean }) {
  return (
    <div className="hairline rounded-3xl surface p-4">
      <div className="flex items-center gap-2">
        <div className="grid size-9 place-items-center rounded-lg bg-neon/10 text-neon">{icon}</div>
        {trend && <span className="ml-auto text-[10px] font-bold text-neon">↗</span>}
      </div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-black leading-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function WeeklyChart({ bars, total }: { bars: { d: string; v: number; raw: number }[]; total: number }) {
  return (
    <>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-3xl font-black">
            {Math.round(total).toLocaleString("pt-BR")} <span className="text-sm font-bold text-muted-foreground">kg</span>
          </div>
          <div className="text-xs text-muted-foreground">Volume total levantado</div>
        </div>
        <div className="rounded-full bg-neon/15 px-2.5 py-1 text-[10px] font-bold text-neon">7 dias</div>
      </div>
      <div className="flex h-32 items-end gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(b.v, 4)}%`,
                  background: b.v > 0
                    ? "linear-gradient(180deg, var(--neon-strong), var(--neon-soft))"
                    : "oklch(1 0 0 / 0.06)",
                  boxShadow: b.v > 50 ? "0 0 12px oklch(0.76 0.19 300 / 0.5)" : "none",
                }}
              />
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">{b.d}</div>
          </div>
        ))}
      </div>
    </>
  );
}
