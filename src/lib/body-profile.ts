export function decimalNumber(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export function calculateBMI(weight: number | null, height: number | null): number | null {
  if (
    !weight ||
    !height ||
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    weight <= 0 ||
    height <= 0
  )
    return null;
  return weight / (height / 100) ** 2;
}

type WeightProfile = { weight_kg: number | null; updated_at: string };
type WeightMeasurement = { weight_kg: number | null; measured_at: string; created_at: string };
export function effectiveWeight(
  profile: WeightProfile | null,
  measurements: WeightMeasurement[],
): number | null {
  const latest = measurements
    .filter((m) => m.weight_kg != null)
    .sort(
      (a, b) =>
        b.measured_at.localeCompare(a.measured_at) || b.created_at.localeCompare(a.created_at),
    )[0];
  if (!latest) return profile?.weight_kg ?? null;
  if (profile?.weight_kg == null) return latest.weight_kg;
  const updated = new Date(profile.updated_at);
  const profileDate = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, "0")}-${String(updated.getDate()).padStart(2, "0")}`;
  if (latest.measured_at !== profileDate)
    return latest.measured_at > profileDate ? latest.weight_kg : profile.weight_kg;
  return new Date(latest.created_at).getTime() > updated.getTime()
    ? latest.weight_kg
    : profile.weight_kg;
}
