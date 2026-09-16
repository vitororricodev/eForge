import { Activity } from "lucide-react";
import { MuscleBody, type BodyGender, type MuscleRole } from "@/components/MuscleBody";
import { buildMuscleState, draftMuscleEntries, muscleRoleLabel } from "@/lib/muscle-activity";
import type { Draft } from "@/lib/workout-storage";

const ROLE_DOT: Record<MuscleRole, string> = {
  primary: "var(--muscle-primary)",
  secondary: "var(--muscle-secondary)",
  tertiary: "var(--muscle-tertiary)",
};

export function LiveMuscleMap({ draft, gender }: { draft: Draft; gender: BodyGender }) {
  const entries = draftMuscleEntries(draft);
  if (entries.length === 0) return null;
  const state = buildMuscleState(entries);

  return (
    <section className="eforge-live-muscles mt-4 rounded-2xl p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-neon">
            <Activity className="size-4" />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Músculos ativados</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualiza a cada série concluída neste treino.
          </p>
        </div>
        <span className="rounded-full bg-neon/10 px-2.5 py-1 text-xs font-bold text-neon">
          ao vivo
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="eforge-live-body">
          <span>Frente</span>
          <div className="mx-auto h-44 w-24">
            <MuscleBody view="front" gender={gender} state={state} />
          </div>
        </div>
        <div className="eforge-live-body">
          <span>Costas</span>
          <div className="mx-auto h-44 w-24">
            <MuscleBody view="back" gender={gender} state={state} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2" aria-label="Legenda do mapa muscular">
        {(Object.keys(ROLE_DOT) as MuscleRole[]).map((role) => (
          <span key={role} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <i className="size-2.5 rounded-full" style={{ background: ROLE_DOT[role] }} />
            {muscleRoleLabel(role)}
          </span>
        ))}
      </div>
    </section>
  );
}
