import { MUSCLES } from "@/components/muscle-map/anatomy";
import { resolveMuscleKeys } from "./muscle-activity";
export function muscleLabel(value: string) {
  return (
    resolveMuscleKeys(value)
      .map((key) => MUSCLES[key].label)
      .join(", ") ||
    value ||
    "Não mapeado"
  );
}
