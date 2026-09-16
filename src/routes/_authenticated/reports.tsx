import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  BarChart3, Dumbbell, Heart, Activity, Scale, Trophy, Flame, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "eForge — Relatórios" }] }),
  component: ReportsPage,
});

type Tab = "treino" | "cardio" | "corpo" | "muscular";

const NEON = "#b885ff";
const NEON_SOFT = "#d7b7ff";
const NEON_DIM = "rgba(184,133,255,0.35)";

function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("treino");
  const [loading, setLoading] = useState(true);

  const [cardio, setCardio] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [muscleActivity, setMuscleActivity] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const muscleLogs = (async () => {
        const full = await supabase
          .from("set_logs")
          .select("musculo_principal,musculos_secundarios,musculos_terciarios,kind,workout_sessions!inner(status,iniciado_em)")
          .eq("user_id", user.id)
          .eq("concluida", true)
          .neq("kind", "warmup")
          .eq("workout_sessions.status", "concluida");
        if (!full.error) return full;
        if (!full.error.message.toLowerCase().includes("musculos_terciarios")) return full;
        return supabase
          .from("set_logs")
          .select("musculo_principal,musculos_secundarios,kind,workout_sessions!inner(status,iniciado_em)")
          .eq("user_id", user.id)
          .eq("concluida", true)
          .neq("kind", "warmup")
          .eq("workout_sessions.status", "concluida");
      })();
      const [c, m, ma, ex] = await Promise.all([
        supabase.from("cardio_logs").select("*").order("data_atividade", { ascending: true }),
        supabase.from("body_measurements").select("*").order("measured_at", { ascending: true }),
        muscleLogs,
        supabase.from("exercises").select("*"),
      ]);
      if (cancelled) return;
      setCardio((c.data ?? []) as any[]);
      setMeasurements((m.data ?? []) as any[]);
      setMuscleActivity((ma.data ?? []).flatMap((r: any) => [
        ...(r.musculo_principal ? [{ muscle: r.musculo_principal, intensity: 1, trained_at: r.workout_sessions.iniciado_em }] : []),
        ...(r.musculos_secundarios ?? []).map((muscle: string) => ({ muscle, intensity: 0.55, trained_at: r.workout_sessions.iniciado_em })),
        ...(r.musculos_terciarios ?? []).map((muscle: string) => ({ muscle, intensity: 0.25, trained_at: r.workout_sessions.iniciado_em })),
      ]));
      setExercises((ex.data ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const cardioStats = useMemo(() => {
    const now = new Date();
    const wAgo = new Date(now); wAgo.setDate(now.getDate() - 7);
    const mAgo = new Date(now); mAgo.setDate(now.getDate() - 30);
    const w = cardio.filter(x => new Date(x.data_atividade) >= wAgo);
    const m = cardio.filter(x => new Date(x.data_atividade) >= mAgo);
    const sum = (a: any[], k: string) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const totalMin = sum(cardio, "tempo_min");
    const totalKm = sum(cardio, "distancia_km");
    const validRitmos = cardio.map(x => Number(x.ritmo_medio)).filter(n => n > 0);
    const avgRitmo = validRitmos.length ? validRitmos.reduce((a, b) => a + b, 0) / validRitmos.length : 0;

    // Series last 8 weeks
    const series: { label: string; km: number; min: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      const slice = cardio.filter(x => {
        const d = new Date(x.data_atividade); return d >= start && d < end;
      });
      series.push({
        label: `S${8 - i}`,
        km: Number(sum(slice, "distancia_km").toFixed(1)),
        min: Math.round(sum(slice, "tempo_min")),
      });
    }
    return {
      weekKm: sum(w, "distancia_km"),
      monthKm: sum(m, "distancia_km"),
      totalMin, totalKm, avgRitmo,
      count: cardio.length,
      weekCount: w.length,
      series,
    };
  }, [cardio]);

  const bodySeries = useMemo(() => {
    return measurements.map(m => ({
      date: new Date(m.measured_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      peso: m.weight_kg ? Number(m.weight_kg) : null,
      cintura: m.waist_cm ? Number(m.waist_cm) : null,
      braco: m.arm_cm ? Number(m.arm_cm) : null,
    }));
  }, [measurements]);

  const muscleStats = useMemo(() => {
    const map = new Map<string, number>();
    muscleActivity.forEach(a => {
      const key = a.muscle as string;
      map.set(key, (map.get(key) ?? 0) + Number(a.intensity || 1));
    });
    const entries = Array.from(map.entries()).map(([muscle, v]) => ({ muscle, value: v }));
    entries.sort((a, b) => b.value - a.value);
    const top = entries.slice(0, 5);
    const bottom = entries.slice(-3).reverse();

    // Weekly frequency last 4 weeks
    const now = new Date();
    const weekly: { label: string; treinos: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      const set = new Set(
        muscleActivity
          .filter(a => { const d = new Date(a.trained_at); return d >= start && d < end; })
          .map(a => a.trained_at.slice(0, 10))
      );
      weekly.push({ label: `S${4 - i}`, treinos: set.size });
    }
    return { top, bottom, weekly, total: entries.length };
  }, [muscleActivity]);

  // Workouts inferred from muscle_activity (proxy: distinct training days)
  const workoutStats = useMemo(() => {
    const days = new Set(muscleActivity.map(a => a.trained_at.slice(0, 10)));
    const now = new Date();
    const wAgo = new Date(now); wAgo.setDate(now.getDate() - 7);
    const mAgo = new Date(now); mAgo.setDate(now.getDate() - 30);
    const weekDays = new Set(
      muscleActivity.filter(a => new Date(a.trained_at) >= wAgo).map(a => a.trained_at.slice(0, 10))
    );
    const monthDays = new Set(
      muscleActivity.filter(a => new Date(a.trained_at) >= mAgo).map(a => a.trained_at.slice(0, 10))
    );
    // Weekly series last 8 weeks
    const series: { label: string; treinos: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      const set = new Set(
        muscleActivity
          .filter(a => { const d = new Date(a.trained_at); return d >= start && d < end; })
          .map(a => a.trained_at.slice(0, 10))
      );
      series.push({ label: `S${8 - i}`, treinos: set.size });
    }
    return {
      totalDays: days.size,
      weekDays: weekDays.size,
      monthDays: monthDays.size,
      exerciseCount: exercises.length,
      series,
    };
  }, [muscleActivity, exercises]);

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-4"><div className="flex flex-wrap gap-3 py-4 text-neon"><Link to="/cardio">Cardio</Link><Link to="/body-profile">Medidas</Link><Link to="/goals">Metas</Link><Link to="/achievements">Medalhas</Link><Link to="/muscle-map">Mapa muscular</Link></div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Insights</p>
        <h1 className="mt-1 text-3xl font-black">Relatórios 📊</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sua evolução em tempo real</p>
      </div>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-4 gap-1.5 rounded-2xl surface-2 p-1.5">
        <TabBtn active={tab === "treino"} onClick={() => setTab("treino")} icon={<Dumbbell className="size-4" />} label="Treino" />
        <TabBtn active={tab === "cardio"} onClick={() => setTab("cardio")} icon={<Heart className="size-4" />} label="Cardio" />
        <TabBtn active={tab === "corpo"} onClick={() => setTab("corpo")} icon={<Scale className="size-4" />} label="Corpo" />
        <TabBtn active={tab === "muscular"} onClick={() => setTab("muscular")} icon={<Activity className="size-4" />} label="Mapa" />
      </div>

      {loading ? (
        <div className="hairline mt-6 rounded-3xl surface p-6 text-center text-sm text-muted-foreground">Carregando dados…</div>
      ) : (
        <div className="mt-6 space-y-4">
          {tab === "treino" && <WorkoutTab stats={workoutStats} />}
          {tab === "cardio" && <CardioTab stats={cardioStats} />}
          {tab === "corpo" && <BodyTab data={bodySeries} measurements={measurements} />}
          {tab === "muscular" && <MuscleTab stats={muscleStats} />}
        </div>
      )}
    </main>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-all ${
        active ? "bg-neon text-primary-foreground glow-neon-soft" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="hairline rounded-2xl surface p-4">
      <div className="grid size-9 place-items-center rounded-lg bg-neon/10 text-neon">{icon}</div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, height = 200 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="hairline rounded-3xl surface p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children as any}</ResponsiveContainer>
      </div>
    </div>
  );
}

function WorkoutTab({ stats }: { stats: any }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Dumbbell className="size-5" />} label="Treinos totais" value={String(stats.totalDays)} />
        <Stat icon={<Flame className="size-5" />} label="Semana" value={String(stats.weekDays)} sub="dias treinados" />
        <Stat icon={<TrendingUp className="size-5" />} label="Mês" value={String(stats.monthDays)} sub="dias treinados" />
        <Stat icon={<BarChart3 className="size-5" />} label="Exercícios" value={String(stats.exerciseCount)} sub="cadastrados" />
      </div>
      <ChartCard title="Frequência semanal (8 semanas)">
        <BarChart data={stats.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" stroke="#888" fontSize={10} />
          <YAxis stroke="#888" fontSize={10} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
          <Bar dataKey="treinos" fill={NEON} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>
      {stats.totalDays === 0 && <EmptyHint text="Comece a treinar para gerar seu relatório" />}
    </>
  );
}

function CardioTab({ stats }: { stats: any }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Heart className="size-5" />} label="Km semana" value={stats.weekKm.toFixed(1)} />
        <Stat icon={<Activity className="size-5" />} label="Km mês" value={stats.monthKm.toFixed(1)} />
        <Stat icon={<Flame className="size-5" />} label="Tempo total" value={`${Math.round(stats.totalMin)} min`} />
        <Stat icon={<TrendingUp className="size-5" />} label="Ritmo médio" value={stats.avgRitmo ? `${stats.avgRitmo.toFixed(2)}` : "—"} sub="min/km" />
      </div>
      <ChartCard title="Distância semanal (8 semanas)">
        <AreaChart data={stats.series}>
          <defs>
            <linearGradient id="kmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NEON} stopOpacity={0.7} />
              <stop offset="100%" stopColor={NEON} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" stroke="#888" fontSize={10} />
          <YAxis stroke="#888" fontSize={10} />
          <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
          <Area type="monotone" dataKey="km" stroke={NEON} strokeWidth={2} fill="url(#kmGrad)" />
        </AreaChart>
      </ChartCard>
      <ChartCard title="Tempo semanal (min)">
        <LineChart data={stats.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" stroke="#888" fontSize={10} />
          <YAxis stroke="#888" fontSize={10} />
          <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
          <Line type="monotone" dataKey="min" stroke={NEON_SOFT} strokeWidth={2.5} dot={{ r: 3, fill: NEON }} />
        </LineChart>
      </ChartCard>
      {stats.count === 0 && <EmptyHint text="Registre seu primeiro cardio para ver os gráficos" />}
    </>
  );
}

function BodyTab({ data, measurements }: { data: any[]; measurements: any[] }) {
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const pesoDiff = first && last && first.weight_kg && last.weight_kg
    ? Number(last.weight_kg) - Number(first.weight_kg) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Scale className="size-5" />} label="Medidas" value={String(measurements.length)} sub="registradas" />
        <Stat
          icon={<TrendingUp className="size-5" />}
          label="Variação peso"
          value={pesoDiff != null ? `${pesoDiff > 0 ? "+" : ""}${pesoDiff.toFixed(1)} kg` : "—"}
          sub="desde início"
        />
      </div>
      {data.length > 0 ? (
        <>
          <ChartCard title="Evolução do peso (kg)">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Line type="monotone" dataKey="peso" stroke={NEON} strokeWidth={2.5} dot={{ r: 3, fill: NEON }} />
            </LineChart>
          </ChartCard>
          <ChartCard title="Cintura e Braço (cm)">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Line type="monotone" dataKey="cintura" stroke={NEON_SOFT} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="braco" stroke={NEON_DIM} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ChartCard>
        </>
      ) : (
        <EmptyHint text="Registre medidas no Perfil Corporal para ver sua evolução" />
      )}
    </>
  );
}

function MuscleTab({ stats }: { stats: any }) {
  const colors = [NEON, NEON_SOFT, "#9b6bd9", "#7c55b0", "#674d86"];
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Trophy className="size-5" />} label="Músculos" value={String(stats.total)} sub="treinados" />
        <Stat
          icon={<Activity className="size-5" />}
          label="Top músculo"
          value={stats.top[0]?.muscle ?? "—"}
        />
      </div>
      {stats.top.length > 0 ? (
        <>
          <ChartCard title="Top 5 músculos mais treinados">
            <PieChart>
              <Pie data={stats.top} dataKey="value" nameKey="muscle" innerRadius={40} outerRadius={75} paddingAngle={3}>
                {stats.top.map((_: any, i: number) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
            </PieChart>
          </ChartCard>
          <ChartCard title="Frequência (4 semanas)">
            <BarChart data={stats.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Bar dataKey="treinos" fill={NEON} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          {stats.bottom.length > 0 && (
            <div className="hairline rounded-3xl surface p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Menos treinados</h3>
              <div className="space-y-2">
                {stats.bottom.map((b: any) => (
                  <div key={b.muscle} className="flex items-center justify-between rounded-xl surface-2 px-3 py-2">
                    <span className="text-sm font-semibold capitalize">{b.muscle}</span>
                    <span className="text-xs text-muted-foreground">{b.value}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyHint text="Treine para começar a popular seu mapa muscular" />
      )}
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="hairline rounded-3xl surface p-6 text-center">
      <BarChart3 className="mx-auto size-8 text-neon" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
