export function decimalNumber(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

// O schema/RPC continuam em centímetros. Aceita também a altura digitada em metros.
export function heightCentimeters(value: number | string | null | undefined): number | null {
  const height = typeof value === "string" ? decimalNumber(value) : value;
  if (height == null || !Number.isFinite(height) || height <= 0) return null;
  const cm = height <= 3 ? Math.round(height * 10000) / 100 : height;
  return cm >= 80 && cm <= 260 ? cm : null;
}

export function formatBodyNumber(value: number | null): string {
  return value != null && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", {
        useGrouping: false,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "—";
}

export function calculateBMI(weight: number | null, height: number | null): number | null {
  const cm = heightCentimeters(height);
  if (weight == null || cm == null || !Number.isFinite(weight) || weight < 20 || weight > 400)
    return null;
  return weight / (cm / 100) ** 2;
}

export type BMIReference = {
  group: "adult" | "older";
  min: number;
  max: number;
  minInclusive: boolean;
};

// SISVAN: adultos de 20–59 anos; para 60+, pontos de corte próprios.
// Adolescentes precisam de IMC por idade/curva de crescimento, não da tabela adulta.
export function getBMIReference(age: number | null): BMIReference | null {
  if (age == null || !Number.isInteger(age) || age < 20 || age > 120) return null;
  return age >= 60
    ? { group: "older", min: 22, max: 27, minInclusive: false }
    : { group: "adult", min: 18.5, max: 25, minInclusive: true };
}

export type BMIClassification = {
  state: "below" | "within" | "above";
  label: string;
  detail?: string;
};

export function classifyBMI(bmi: number | null, age: number | null): BMIClassification | null {
  const reference = getBMIReference(age);
  if (bmi == null || !Number.isFinite(bmi) || bmi <= 0 || !reference) return null;
  if (bmi < reference.min || (!reference.minInclusive && bmi === reference.min))
    return { state: "below", label: "Abaixo do peso" };
  if (bmi < reference.max) return { state: "within", label: "Na faixa de referência" };
  const detail =
    reference.group === "older" || bmi < 30
      ? "Sobrepeso"
      : bmi < 35
        ? "Obesidade grau 1"
        : bmi < 40
          ? "Obesidade grau 2"
          : "Obesidade grau 3";
  return { state: "above", label: "Acima do peso", detail };
}

export function bmiWeightRange(height: number | null, age: number | null) {
  const cm = heightCentimeters(height);
  const reference = getBMIReference(age);
  if (!cm || !reference) return null;
  const squared = (cm / 100) ** 2;
  return { min: reference.min * squared, max: reference.max * squared };
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
