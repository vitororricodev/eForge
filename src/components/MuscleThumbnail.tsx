import { BodyBack, BodyFront, type MuscleKey } from "@/components/MuscleBody";
import { resolveMuscleKeys } from "@/lib/muscle-activity";

const BACK_MUSCLES = new Set<MuscleKey>([
  "lats",
  "traps",
  "lower_back",
  "hamstrings",
  "glutes",
  "rear_delts",
  "triceps",
]);

export function MuscleThumbnail({ muscle }: { muscle: string }) {
  const key = resolveMuscleKeys(muscle)[0] ?? "chest";
  const back = BACK_MUSCLES.has(key);
  const levels = { [key]: 3 };
  return (
    <div className="eforge-muscle-thumb" title="Grupo muscular principal">
      {back ? <BodyBack levels={levels} /> : <BodyFront levels={levels} />}
    </div>
  );
}
