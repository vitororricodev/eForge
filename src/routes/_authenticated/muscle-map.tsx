import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MuscleMapScreen } from "@/components/muscle-map/MuscleMapScreen";
import { getTrainingWeekWindow, formatTrainingWeekLabel } from "@/lib/muscle-activity";
import {
  mergeLocalMuscleSets,
  muscleStateFromSets,
  summarizeMuscleSets,
} from "@/lib/muscle-map-data";
import { useExerciseCatalog } from "@/hooks/use-exercise-catalog";
import type { MuscleKey } from "@/components/MuscleBody";
import { readDraft } from "@/lib/workout-storage";

export const Route = createFileRoute("/_authenticated/muscle-map")({
  head: () => ({ meta: [{ title: "eForge — Mapa muscular" }] }),
  component: MuscleMap,
});

function MuscleMap() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<MuscleKey | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    window.addEventListener("storage", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("storage", tick);
    };
  }, []);
  const week = getTrainingWeekWindow(new Date(clock));
  const activity = useQuery({
    queryKey: ["muscle-map-week", user?.id, week.key],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select(
          "id,session_id,musculo_principal,musculos_primarios,musculos_secundarios,musculos_terciarios,kind,workout_sessions!inner(status,iniciado_em)",
        )
        .eq("user_id", user!.id)
        .eq("concluida", true)
        .neq("kind", "warmup")
        .eq("workout_sessions.status", "concluida")
        .gte("workout_sessions.iniciado_em", week.start.toISOString())
        .lt("workout_sessions.iniciado_em", week.end.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });
  const exercises = useExerciseCatalog(
    { muscles: selected ? [selected] : [], pageSize: 3 },
    !!selected,
  );
  const draft = user && typeof window !== "undefined" ? readDraft(user.id) : null;
  const rows = mergeLocalMuscleSets(activity.data ?? [], draft, user?.id ?? "", week);
  return (
    <MuscleMapScreen
      onSelectionChange={setSelected}
      weekLabel={formatTrainingWeekLabel(week)}
      summary={summarizeMuscleSets(rows)}
      training={muscleStateFromSets(rows)}
      activityLoading={activity.isLoading}
      activityError={activity.isError}
      onRetry={() => {
        void activity.refetch();
      }}
      exercises={(muscle) => (muscle === selected ? (exercises.data?.items ?? []) : [])}
      exercisesLoading={exercises.isLoading}
      exercisesError={exercises.isError}
      renderExerciseLink={(muscle, children, className, exercise) => (
        <Link to="/exercises" search={{ muscle, q: exercise?.nome }} className={className}>
          {children}
        </Link>
      )}
    />
  );
}
