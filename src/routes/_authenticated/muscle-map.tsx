import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Info, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  MuscleBody,
  type BodyGender,
  type MuscleKey,
  type MuscleRole,
} from "@/components/MuscleBody";
import {
  buildMuscleState,
  draftMuscleEntries,
  muscleRoleLabel,
  type MuscleActivityEntry,
} from "@/lib/muscle-activity";
import { readDraft } from "@/lib/workout-storage";

export const Route = createFileRoute("/_authenticated/muscle-map")({
  head: () => ({ meta: [{ title: "eForge — Mapa Muscular" }] }),
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
  lats: "Dorsais",
  lower_back: "Lombar",
  glutes: "Glúteos",
  hamstrings: "Posteriores",
  triceps: "Tríceps",
  rear_delts: "Deltoide posterior",
};

const ROLE_COLOR: Record<MuscleRole, string> = {
  primary: "var(--muscle-primary)",
  secondary: "var(--muscle-secondary)",
  tertiary: "var(--muscle-tertiary)",
};

type SetLogRow = {
  session_id: string;
  musculo_principal: string | null;
  musculos_secundarios: string[];
  musculos_terciarios?: string[];
  kind: string;
};

function rowsToEntries(rows: SetLogRow[]): MuscleActivityEntry[] {
  return rows.flatMap((row) => {
    if (row.kind === "warmup") return [];
    return [
      ...(row.musculo_principal
        ? [{ muscle: row.musculo_principal, role: "primary" as const }]
        : []),
      ...(row.musculos_secundarios ?? []).map((muscle) => ({
        muscle,
        role: "secondary" as const,
      })),
      ...(row.musculos_terciarios ?? []).map((muscle) => ({
        muscle,
        role: "tertiary" as const,
      })),
    ];
  });
}

function MuscleMap() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [view, setView] = useState<"front" | "back">("front");
  const [genderOverride, setGenderOverride] = useState<BodyGender | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["muscle-map-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("sex")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: activity = [], isLoading, error } = useQuery({
    queryKey: ["muscle-activity", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const withTertiary = await supabase
        .from("set_logs")
        .select(
          "session_id,musculo_principal,musculos_secundarios,musculos_terciarios,kind,workout_sessions!inner(status,iniciado_em)",
        )
        .eq("user_id", user!.id)
        .eq("concluida", true)
        .eq("workout_sessions.status", "concluida")
        .gte("workout_sessions.iniciado_em", since.toISOString());

      let serverRows: SetLogRow[] = [];
      if (!withTertiary.error) {
        serverRows = (withTertiary.data ?? []) as SetLogRow[];
      } else if (withTertiary.error.message.toLowerCase().includes("musculos_terciarios")) {
        // Compatibilidade durante rollout: a tela continua funcionando antes da migration nova.
        const fallback = await supabase
          .from("set_logs")
          .select(
            "session_id,musculo_principal,musculos_secundarios,kind,workout_sessions!inner(status,iniciado_em)",
          )
          .eq("user_id", user!.id)
          .eq("concluida", true)
          .eq("workout_sessions.status", "concluida")
          .gte("workout_sessions.iniciado_em", since.toISOString());
        if (fallback.error) throw fallback.error;
        serverRows = (fallback.data ?? []) as SetLogRow[];
      } else {
        throw withTertiary.error;
      }

      const localDraft = readDraft(user!.id);
      const includeLocal =
        !!localDraft?.finished && localDraft.finished >= since.getTime();

      const localEntries = includeLocal ? draftMuscleEntries(localDraft) : [];
      const rowsWithoutLocalSession = includeLocal
        ? serverRows.filter((row) => row.session_id !== localDraft.id)
        : serverRows;

      return [...rowsToEntries(rowsWithoutLocalSession), ...localEntries];
    },
  });

  const state = useMemo(() => buildMuscleState(activity), [activity]);
  const ranked = useMemo(
    () =>
      (Object.entries(state) as [MuscleKey, NonNullable<(typeof state)[MuscleKey]>][])
        .filter(([, value]) => value.level > 0)
        .sort((a, b) => b[1].score - a[1].score),
    [state],
  );
  const gender: BodyGender =
    genderOverride ?? (profile?.sex === "feminino" ? "female" : "male");

  return (
    <main className="mx-auto max-w-md px-5 pb-8 pt-8">
      <header className="flex items-center gap-3">
        <Link
          to="/reports"
          aria-label="Voltar para evolução"
          className="grid size-11 shrink-0 place-items-center rounded-xl hairline surface"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-neon">Evolução muscular</p>
          <h1 className="text-3xl">Mapa muscular</h1>
        </div>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Cada região muda de cor conforme sua participação nos exercícios concluídos: principal,
        secundária ou terciária.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="eforge-control-card">
          <span><CalendarDays className="size-4" /> Período</span>
          <select aria-label="Período do mapa muscular" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Últimas 24 horas</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </label>
        <div className="eforge-control-card">
          <span><UserRound className="size-4" /> Avatar</span>
          <div className="eforge-mini-segmented" role="group" aria-label="Tipo de avatar">
            <button type="button" aria-pressed={gender === "male"} onClick={() => setGenderOverride("male")}>Masculino</button>
            <button type="button" aria-pressed={gender === "female"} onClick={() => setGenderOverride("female")}>Feminino</button>
          </div>
        </div>
      </div>

      <div className="eforge-view-toggle mt-4" role="group" aria-label="Vista do corpo">
        <button type="button" aria-pressed={view === "front"} onClick={() => setView("front")}>Frente</button>
        <button type="button" aria-pressed={view === "back"} onClick={() => setView("back")}>Costas</button>
      </div>

      <section className="eforge-map-panel relative mt-4 overflow-hidden rounded-3xl hairline p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-x-8 top-6 h-40 rounded-full bg-neon/5 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Atividade</p>
            <p className="text-sm font-bold">{ranked.length ? `${ranked.length} regiões ativadas` : "Sem registros no período"}</p>
          </div>
          {isLoading && <span className="text-xs text-muted-foreground">Atualizando…</span>}
        </div>

        <div className="relative mx-auto mt-2 h-[430px] w-full max-w-[285px]">
          <MuscleBody view={view} gender={gender} state={state} />
        </div>

        {!isLoading && ranked.length === 0 && (
          <div className="relative -mt-2 rounded-2xl border border-dashed border-border bg-black/20 px-4 py-3 text-center text-sm text-muted-foreground">
            Conclua séries em um treino para acender o mapa muscular.
          </div>
        )}
        {error && (
          <p role="alert" className="relative mt-3 text-center text-sm text-destructive">
            Não foi possível sincronizar o histórico agora. O último treino salvo no aparelho ainda é considerado quando disponível.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl hairline surface p-4" aria-label="Legenda do mapa muscular">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Info className="size-4" /> Participação no exercício
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(ROLE_COLOR) as MuscleRole[]).map((role) => (
            <div key={role} className="eforge-role-legend">
              <i style={{ background: ROLE_COLOR[role] }} />
              <span>{muscleRoleLabel(role)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O brilho aumenta com a quantidade de séries. Aquecimento não entra no cálculo.
        </p>
      </section>

      {ranked.length > 0 && (
        <section className="mt-4 rounded-2xl hairline surface p-4">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Mais trabalhados</div>
          <div className="mt-3 space-y-2">
            {ranked.slice(0, 5).map(([muscle, value]) => (
              <div key={muscle} className="flex items-center gap-3 rounded-xl surface-2 px-3 py-2.5">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: ROLE_COLOR[value.role] }} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{MUSCLE_LABEL[muscle]}</span>
                <span className="text-xs text-muted-foreground">{muscleRoleLabel(value.role)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
