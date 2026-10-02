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

export { BODY_PART_LABELS, EQUIPMENT_LABELS } from "./catalog-vocabulary";
import { BODY_PART_LABELS, EQUIPMENT_LABELS, sourceLabel } from "./catalog-vocabulary";
import { LIBRARY_CATEGORIES } from "./owned-gif-manifest";
export const bodyPartLabel = (value: string) =>
  LIBRARY_CATEGORIES[value as keyof typeof LIBRARY_CATEGORIES] ??
  sourceLabel(value, BODY_PART_LABELS);
export const equipmentLabel = (value: string) => sourceLabel(value, EQUIPMENT_LABELS);
