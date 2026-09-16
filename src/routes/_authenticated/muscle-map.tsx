import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Info, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BodyFront, BodyBack, type MuscleKey, type MuscleLevels } from "@/components/MuscleBody";

export const Route = createFileRoute("/_authenticated/muscle-map")({
  head: () => ({ meta: [{ title: "eForge — Músculos Treinados" }] }),
  component: MuscleMap,
});

const MUSCLE_LABEL: Record<MuscleKey, string> = {
  chest: "Peito",
  abs: "Abdômen",
  obliques: "Oblíquos",
  shoulders: "Ombros",
  biceps: "Bíceps",
  forearms: "Antebraços",
  quads: "Quadríceps",
  calves: "Panturrilhas",
  traps: "Trapézio",
  lats: "Dorsal",
  lower_back: "Lombar",
  glutes: "Glúteos",
  hamstrings: "Posterior",
  triceps: "Tríceps",
  rear_delts: "Deltóide post.",
};

function startOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // monday-first
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString("pt-BR")} — ${end.toLocaleDateString("pt-BR")}`;
}

function aggregateLevels(rows: { muscle: string; intensity: number }[]): MuscleLevels {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.muscle) continue;
    totals.set(row.muscle, (totals.get(row.muscle) ?? 0) + row.intensity);
  }

  const levels: MuscleLevels = {};
  for (const [muscle, total] of totals) {
    let level = 0;
    if (total >= 8) level = 4;
    else if (total >= 5) level = 3;
    else if (total >= 3) level = 2;
    else if (total >= 1) level = 1;
    (levels as Record<string, number>)[muscle] = level;
  }
  return levels;
}

function MuscleMap() {
  const { user } = useAuth();
  const weekStart = useMemo(() => startOfCurrentWeek(), []);
  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  const { data } = useQuery({
    queryKey: ["muscle-activity", user?.id, weekStart.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("musculo_principal,musculos_secundarios,kind,workout_sessions!inner(status,iniciado_em)")
        .eq("user_id", user!.id)
        .eq("concluida", true)
        .eq("workout_sessions.status", "concluida")
        .gte("workout_sessions.iniciado_em", weekStart.toISOString());

      if (error) throw error;

      return (data ?? []).flatMap((row) => [
        { muscle: row.musculo_principal || "", intensity: row.kind === "warmup" ? 0 : 1 },
        ...row.musculos_secundarios.map((muscle: string) => ({
          muscle,
          intensity: row.kind === "warmup" ? 0 : 0.4,
        })),
      ]);
    },
  });

  const levels = useMemo<MuscleLevels>(
    () => ({
      ...Object.fromEntries(Object.keys(MUSCLE_LABEL).map((key) => [key, 0])),
      ...aggregateLevels(data || []),
    }),
    [data],
  );

  const ranked = useMemo(() => {
    return (Object.entries(levels) as [MuscleKey, number][]).sort((a, b) => b[1] - a[1]);
  }, [levels]);

  const top = ranked.filter(([, level]) => level > 0).slice(0, 4);
  const activeCount = ranked.filter(([, level]) => level > 0).length;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-6 sm:px-5 sm:pt-10">
      <div className="flex items-start gap-3">
        <Link to="/dashboard" className="grid size-10 shrink-0 place-items-center rounded-full hairline surface">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Evolução</p>
          <h1 className="text-3xl font-black leading-none sm:text-4xl">Músculos Treinados</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            O avatar reinicia automaticamente a cada semana. Fora de ativação, o corpo permanece em cinza translúcido.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl hairline surface px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarDays className="size-4 text-neon" />
            Semana atual
          </div>
          <div className="mt-1 text-sm font-semibold">{weekLabel}</div>
          <p className="mt-2 text-xs text-muted-foreground">Ao virar a semana, o mapa volta ao estado neutro sem apagar o histórico dos treinos.</p>
        </div>

        <div className="rounded-3xl hairline surface px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="size-4 text-neon" />
            Atividade
          </div>
          <div className="mt-1 text-sm font-semibold">{activeCount} regiões ativadas</div>
          <p className="mt-2 text-xs text-muted-foreground">Roxo aparece apenas nos músculos trabalhados nesta semana.</p>
        </div>
      </div>

      {!data?.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma série sincronizada nesta semana.</p>}

      <section className="eforge-map-panel relative mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,16,29,0.96),rgba(8,8,15,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(165,118,255,0.12),transparent_42%),radial-gradient(circle_at_50%_78%,rgba(98,76,176,0.12),transparent_45%)]" />

        <div className="relative z-10 grid gap-4 sm:grid-cols-2 sm:gap-6">
          <FigureCard title="Vista frontal">
            <BodyFront levels={levels} />
          </FigureCard>

          <FigureCard title="Vista posterior">
            <BodyBack levels={levels} />
          </FigureCard>
        </div>

        <div className="relative z-10 mt-4 grid gap-3 rounded-2xl border border-white/8 bg-black/18 px-4 py-3 sm:grid-cols-3">
          <LegendSwatch label="Baixa" description="Ativação leve" color="rgba(153,104,222,0.48)" glow="rgba(153,104,222,0.26)" />
          <LegendSwatch label="Média" description="Ativação consistente" color="rgba(185,128,255,0.74)" glow="rgba(185,128,255,0.30)" />
          <LegendSwatch label="Alta" description="Maior foco" color="rgba(220,186,255,0.92)" glow="rgba(220,186,255,0.34)" />
        </div>
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl hairline surface p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Info className="size-4" /> legenda visual
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Cinza translúcido = sem ativação na semana. Quanto mais intenso o roxo, maior o acúmulo de trabalho naquele grupo muscular.
          </p>
        </div>

        <div className="rounded-3xl hairline surface p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Mais trabalhados</div>
          <ul className="mt-3 space-y-2">
            {top.length ? (
              top.map(([muscle, level]) => (
                <li key={muscle} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{MUSCLE_LABEL[muscle]}</span>
                  <span className="font-bold text-neon">{["—", "leve", "média", "alta", "máxima"][level]}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Conclua treinos para começar a colorir o avatar.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}

function FigureCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,16,28,0.92),rgba(8,8,15,0.82))] p-3">
      <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{title}</div>
      <div className="mx-auto h-[380px] max-w-[240px] sm:h-[420px] sm:max-w-[260px]">{children}</div>
    </div>
  );
}

function LegendSwatch({
  label,
  description,
  color,
  glow,
}: {
  label: string;
  description: string;
  color: string;
  glow: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="block h-5 w-5 rounded-full border border-white/20"
        style={{ background: color, boxShadow: `0 0 16px ${glow}` }}
      />
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
