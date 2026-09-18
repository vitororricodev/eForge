import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MuscleMapScreen } from "@/components/muscle-map/MuscleMapScreen";
import { getTrainingWeekWindow, formatTrainingWeekLabel } from "@/lib/muscle-activity";
import { mergeLocalMuscleSets, relatedMuscles, summarizeMuscleSets } from "@/lib/muscle-map-data";
import { readDraft } from "@/lib/workout-storage";

export const Route = createFileRoute("/_authenticated/muscle-map")({
  head: () => ({ meta: [{ title: "eForge — Mapa muscular" }] }),
  component: MuscleMap,
});

function MuscleMap() {
  const { user } = useAuth();
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
          "id,session_id,musculo_principal,musculos_secundarios,musculos_terciarios,kind,workout_sessions!inner(status,iniciado_em)",
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
  const exercises = useQuery({
    queryKey: ["muscle-map-exercises", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Existing RLS controls access to personal/public exercises.
      const { data, error } = await supabase
        .from("exercises")
        .select("id,nome,musculo_principal,musculos_secundarios,musculos_terciarios")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const draft = user && typeof window !== "undefined" ? readDraft(user.id) : null;
  const rows = mergeLocalMuscleSets(activity.data ?? [], draft, user?.id ?? "", week);
  return (
    <MuscleMapScreen
      weekLabel={formatTrainingWeekLabel(week)}
      summary={summarizeMuscleSets(rows)}
      activityLoading={activity.isLoading}
      activityError={activity.isError}
      onRetry={() => {
        void activity.refetch();
      }}
      exercises={(muscle) =>
        (exercises.data ?? []).filter((exercise) => relatedMuscles(exercise).includes(muscle))
      }
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
