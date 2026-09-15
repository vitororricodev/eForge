import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BodyFront, BodyBack, type MuscleLevels, type MuscleKey } from "@/components/MuscleBody";
import { ArrowLeft, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/muscle-map")({
  head: () => ({ meta: [{ title: "eForge — Mapa Muscular" }] }),
  component: MuscleMap,
});

const MUSCLE_LABEL: Record<MuscleKey, string> = {
  chest: "Peito", abs: "Abdômen", obliques: "Oblíquos", shoulders: "Ombros",
  biceps: "Bíceps", forearms: "Antebraços", quads: "Quadríceps", calves: "Panturrilhas",
  traps: "Trapézio", lats: "Dorsal", lower_back: "Lombar", glutes: "Glúteos",
  hamstrings: "Posterior", triceps: "Tríceps", rear_delts: "Deltóide post.",
};

function aggregateLevels(rows: { muscle: string; intensity: number }[]): MuscleLevels {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.muscle, (totals.get(r.muscle) ?? 0) + r.intensity);
  }
  const levels: MuscleLevels = {};
  for (const [m, t] of totals) {
    let lvl = 0;
    if (t >= 8) lvl = 4;
    else if (t >= 5) lvl = 3;
    else if (t >= 3) lvl = 2;
    else if (t >= 1) lvl = 1;
    (levels as Record<string, number>)[m] = lvl;
  }
  return levels;
}

function MuscleMap() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [view, setView] = useState<"front" | "back">("front");

  const { data } = useQuery({
    queryKey: ["muscle-activity", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase.from("set_logs")
        .select("musculo_principal,musculos_secundarios,kind,workout_sessions!inner(status,iniciado_em)")
        .eq("user_id", user!.id).eq("concluida",true)
        .eq("workout_sessions.status","concluida").gte("workout_sessions.iniciado_em",since.toISOString());
      if(error) throw error;
      return (data ?? []).flatMap((r) => [{muscle:r.musculo_principal || "",intensity:r.kind === "warmup" ? 0 : 1}, ...r.musculos_secundarios.map((muscle:string)=>({muscle,intensity:r.kind === "warmup" ? 0 : 0.4}))]);
    },
  });

  const levels = useMemo<MuscleLevels>(() => ({...Object.fromEntries(Object.keys(MUSCLE_LABEL).map(k=>[k,0])),...aggregateLevels(data||[])}),[data]);

  const ranked = useMemo(() => {
    return (Object.entries(levels) as [MuscleKey, number][])
      .sort((a, b) => b[1] - a[1]);
  }, [levels]);

  const top = ranked.slice(0, 3);
  const low = [...ranked].reverse().slice(0, 3);

  return (
    <main className="mx-auto max-w-md px-5 pt-10">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="grid size-10 place-items-center rounded-full hairline surface">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Sua atividade</p>
          <h1 className="text-2xl font-black">Mapa Muscular</h1>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">Séries registradas por músculo. A cor não representa recuperação ou fadiga.</p>
      <select className="mt-3 p-3 surface rounded-xl" aria-label="Período" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>Últimas 24 horas</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select>
      {!data?.length && <p className="mt-3">Nenhuma série sincronizada neste período.</p>}
      {/* Toggle */}
      <div className="mt-6 inline-flex w-full rounded-full border border-border surface p-1">
        {(["front", "back"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-widest transition-all ${
              view === v ? "bg-neon text-primary-foreground glow-neon-soft" : "text-muted-foreground"
            }`}>
            {v === "front" ? "Frente" : "Costas"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="eforge-map-panel relative mt-6 hairline rounded-3xl surface p-6">
        <div className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ background: "radial-gradient(closest-side at 50% 30%, oklch(0.76 0.19 300 / 0.08), transparent 70%)" }} />
        <div className="relative mx-auto h-[420px] w-full max-w-[260px]">
          {view === "front" ? <BodyFront levels={levels} /> : <BodyBack levels={levels} />}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between rounded-2xl hairline surface px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Info className="size-3" /> Intensidade
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className="h-3 w-6 rounded"
              style={{
                background:
                  lvl === 0 ? "oklch(0.22 0 0)" :
                  lvl === 1 ? "oklch(0.55 0.12 300 / 0.55)" :
                  lvl === 2 ? "oklch(0.72 0.20 300 / 0.85)" :
                  lvl === 3 ? "oklch(0.88 0.26 300)" :
                              "oklch(0.84 0.15 300)",
                boxShadow: lvl >= 3 ? "0 0 8px oklch(0.76 0.19 300 / 0.5)" : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Summaries */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Summary title="Mais treinados" rows={top} positive />
        <Summary title="Pouco treinados" rows={low} />
      </div>
      <div className="h-6" />
    </main>
  );
}

function Summary({ title, rows, positive }: { title: string; rows: [MuscleKey, number][]; positive?: boolean }) {
  return (
    <div className="hairline rounded-3xl surface p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <ul className="mt-3 space-y-2">
        {rows.map(([m, lvl]) => (
          <li key={m} className="flex items-center justify-between text-sm">
            <span className="font-semibold">{MUSCLE_LABEL[m]}</span>
            <span className={positive ? "text-neon font-bold" : "text-muted-foreground font-semibold"}>
              {["—", "baixo", "médio", "alto", "máx"][lvl]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
