import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  X,
  Ruler,
  Scale,
  Target,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  calculateBMI,
  classifyBMI,
  decimalNumber,
  effectiveWeight,
  formatBodyNumber,
  heightCentimeters,
} from "@/lib/body-profile";
import { BMIResult } from "@/components/body-profile/BMIResult";
import { errorMessage } from "@/lib/workout-sharing";
import "@/components/workouts/workout-plan.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/body-profile")({
  head: () => ({ meta: [{ title: "eForge — Perfil Corporal" }] }),
  component: BodyProfilePage,
});

const FITNESS_GOALS = [
  { value: "perder_peso", label: "Perder peso" },
  { value: "ganhar_massa", label: "Ganhar massa" },
  { value: "manter_peso", label: "Manter peso" },
  { value: "condicionamento", label: "Condicionamento" },
  { value: "hipertrofia", label: "Hipertrofia" },
  { value: "saude_geral", label: "Saúde geral" },
] as const;

type Profile = {
  id: string;
  display_name: string | null;
  sex: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  objetivo_fitness: string | null;
  updated_at: string;
};

type Measurement = {
  id: string;
  user_id: string;
  measured_at: string;
  created_at: string;
  weight_kg: number | null;
  arm_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  abdomen_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
};

const profileSchema = z.object({
  weight_kg: z.number().min(20).max(400),
  height_cm: z.number().min(80).max(260),
  age: z.number().int().min(10).max(120),
  sex: z.enum(["masculino", "feminino", "outro"]),
  objetivo_fitness: z.enum([
    "perder_peso",
    "ganhar_massa",
    "manter_peso",
    "condicionamento",
    "hipertrofia",
    "saude_geral",
  ]),
});

const measurementSchema = z.object({
  measured_at: z.string().min(1),
  weight_kg: z.number().min(20).max(400).optional().nullable(),
  arm_cm: z.number().min(10).max(100).optional().nullable(),
  chest_cm: z.number().min(40).max(200).optional().nullable(),
  waist_cm: z.number().min(30).max(200).optional().nullable(),
  abdomen_cm: z.number().min(30).max(200).optional().nullable(),
  hip_cm: z.number().min(40).max(200).optional().nullable(),
  thigh_cm: z.number().min(20).max(150).optional().nullable(),
  calf_cm: z.number().min(15).max(100).optional().nullable(),
});

function fmtDate(s: string) {
  return new Date(s.includes("T") ? s : s + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BodyProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState<Measurement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState("");
  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [p, m] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("body_measurements")
          .select("*")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (m.error) throw m.error;
      setProfile(p.data);
      setMeasurements(m.data ?? []);
    } catch (error) {
      setLoadError(errorMessage(error, "Não foi possível carregar o perfil."));
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);

  const currentWeight = effectiveWeight(profile, measurements);
  const height = heightCentimeters(profile?.height_cm);
  const bmi = calculateBMI(currentWeight, height);
  const bmiClass = classifyBMI(bmi, profile?.age ?? null);

  const chartData = useMemo(() => {
    return [...measurements]
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      .map((m) => ({
        date: new Date(m.measured_at + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        peso: m.weight_kg,
        cintura: m.waist_cm,
        braco: m.arm_cm,
        coxa: m.thigh_cm,
      }));
  }, [measurements]);

  return (
    <main className="mx-auto max-w-md px-5 pt-12 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Evolução</p>
          <h1 className="text-3xl font-black">Perfil Corporal</h1>
        </div>
        <button
          disabled={loading || !!loadError}
          onClick={() => setProfileOpen(true)}
          className="rounded-full bg-neon px-4 py-2 text-xs font-bold text-primary-foreground glow-neon-soft"
        >
          Editar perfil
        </button>
      </div>

      {loadError && (
        <div role="alert" className="plan-error">
          <p>{loadError}</p>
          <button className="min-h-11" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}
      {/* Cards principais */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={<Scale className="size-4" />}
          label="Peso atual"
          value={currentWeight ? `${formatBodyNumber(currentWeight)} kg` : "—"}
        />
        <StatCard
          icon={<Ruler className="size-4" />}
          label="Altura"
          value={height ? `${height.toLocaleString("pt-BR")} cm` : "—"}
        />
        <StatCard
          icon={<Activity className="size-4" />}
          label="IMC"
          value={formatBodyNumber(bmi)}
          sub={bmiClass?.label}
          subTone={
            bmiClass?.state === "above"
              ? "text-yellow-300"
              : bmiClass?.state === "below"
                ? "text-sky-300"
                : "text-neon"
          }
        />
        <StatCard
          icon={<Target className="size-4" />}
          label="Objetivo"
          value={FITNESS_GOALS.find((g) => g.value === profile?.objetivo_fitness)?.label ?? "—"}
        />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Calendar className="size-3" />
        Última atualização: {profile?.updated_at ? fmtDate(profile.updated_at) : "nunca"}
      </p>

      {/* IMC visual */}
      {bmi != null && (
        <div className="mt-6">
          <BMIResult
            weight={currentWeight}
            height={height}
            age={profile?.age ?? null}
            goal={profile?.objetivo_fitness}
            title="Índice de Massa Corporal"
          />
        </div>
      )}

      {/* Gráficos */}
      {chartData.length >= 2 && (
        <section className="mt-8 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Evolução
          </h2>
          <ChartCard title="Peso (kg)" dataKey="peso" data={chartData} />
          <ChartCard title="Cintura (cm)" dataKey="cintura" data={chartData} />
          <ChartCard title="Braço (cm)" dataKey="braco" data={chartData} />
          <ChartCard title="Coxa (cm)" dataKey="coxa" data={chartData} />
        </section>
      )}

      {/* Medidas */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Histórico de Medidas
          </h2>
          <button
            onClick={() => {
              setEditingMeasure(null);
              setMeasureOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-bold text-neon"
          >
            <Plus className="size-3.5" /> Nova medida
          </button>
        </div>

        {loading ? (
          <div className="mt-6 grid place-items-center py-10 text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : measurements.length === 0 ? (
          <div className="mt-6 hairline rounded-3xl surface p-8 text-center">
            <Ruler className="mx-auto size-10 text-neon opacity-60" />
            <p className="mt-3 font-bold">Nenhuma medida ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registre suas primeiras medidas para acompanhar sua evolução.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {measurements.map((m, i) => {
              const prev = measurements[i + 1];
              return (
                <li key={m.id} className="hairline rounded-2xl surface p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-neon">
                      {fmtDate(m.measured_at)}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        aria-label={`Editar medida de ${fmtDate(m.measured_at)}`}
                        onClick={() => {
                          setEditingMeasure(m);
                          setMeasureOpen(true);
                        }}
                        className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-neon hover:border-neon/40"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        aria-label={`Excluir medida de ${fmtDate(m.measured_at)}`}
                        onClick={() => setDeleteId(m.id)}
                        className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MeasureCell
                      label="Peso"
                      value={m.weight_kg}
                      unit="kg"
                      prev={prev?.weight_kg}
                    />
                    <MeasureCell label="Braço" value={m.arm_cm} unit="cm" prev={prev?.arm_cm} />
                    <MeasureCell label="Peito" value={m.chest_cm} unit="cm" prev={prev?.chest_cm} />
                    <MeasureCell
                      label="Cintura"
                      value={m.waist_cm}
                      unit="cm"
                      prev={prev?.waist_cm}
                    />
                    <MeasureCell
                      label="Abdômen"
                      value={m.abdomen_cm}
                      unit="cm"
                      prev={prev?.abdomen_cm}
                    />
                    <MeasureCell label="Quadril" value={m.hip_cm} unit="cm" prev={prev?.hip_cm} />
                    <MeasureCell label="Coxa" value={m.thigh_cm} unit="cm" prev={prev?.thigh_cm} />
                    <MeasureCell
                      label="Panturrilha"
                      value={m.calf_cm}
                      unit="cm"
                      prev={prev?.calf_cm}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={profile}
        currentWeight={currentWeight}
        userId={user?.id}
        onSaved={() => {
          setProfileOpen(false);
          void load();
        }}
      />

      <MeasurementDialog
        open={measureOpen}
        onOpenChange={setMeasureOpen}
        editing={editingMeasure}
        userId={user?.id}
        onSaved={() => {
          setMeasureOpen(false);
          void load();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir medida?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteId) return;
                const { error } = await supabase
                  .from("body_measurements")
                  .delete()
                  .eq("id", deleteId);
                if (error) toast.error("Erro ao excluir");
                else {
                  toast.success("Medida excluída");
                  void load();
                }
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  subTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
}) {
  return (
    <div className="hairline rounded-2xl surface p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="text-neon">{icon}</span>
        {label}
      </div>
      <p className="mt-2 truncate text-lg font-black">{value}</p>
      {sub && (
        <p className={`text-[11px] font-bold ${subTone ?? "text-muted-foreground"}`}>{sub}</p>
      )}
    </div>
  );
}

function MeasureCell({
  label,
  value,
  unit,
  prev,
}: {
  label: string;
  value: number | null;
  unit: string;
  prev?: number | null;
}) {
  if (value == null)
    return (
      <div className="rounded-lg border border-border/60 p-2">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-bold text-muted-foreground">—</p>
      </div>
    );
  const diff = prev != null ? value - prev : null;
  return (
    <div className="rounded-lg border border-border/60 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold">
        {value}
        <span className="text-muted-foreground"> {unit}</span>
      </p>
      {diff != null && diff !== 0 && (
        <p
          className={`flex items-center gap-0.5 text-[10px] font-bold ${diff > 0 ? "text-neon" : "text-orange-400"}`}
        >
          {diff > 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
          {Math.abs(diff).toFixed(1)}
        </p>
      )}
      {diff === 0 && (
        <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Minus className="size-2.5" />0
        </p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  dataKey,
  data,
}: {
  title: string;
  dataKey: "peso" | "cintura" | "braco" | "coxa";
  data: {
    date: string;
    peso: number | null;
    cintura: number | null;
    braco: number | null;
    coxa: number | null;
  }[];
}) {
  const hasData = data.some((d) => d[dataKey] != null);
  if (!hasData) return null;
  return (
    <div className="hairline rounded-2xl surface p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="oklch(0.2 0 0)" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="oklch(0.62 0 0)" fontSize={10} />
            <YAxis stroke="oklch(0.62 0 0)" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.09 0 0)",
                border: "1px solid oklch(0.2 0 0)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "oklch(0.62 0 0)" }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="oklch(0.76 0.19 300)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "oklch(0.76 0.19 300)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "0.1",
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  help?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode={step === "1" ? "numeric" : "decimal"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="surface-2 border-border"
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

function ProfileDialog({
  open,
  onOpenChange,
  profile,
  currentWeight,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  currentWeight: number | null;
  userId?: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    weight_kg: "",
    height_cm: "",
    age: "",
    sex: "masculino",
    objetivo_fitness: "saude_geral",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm({
      weight_kg: currentWeight?.toString() ?? "",
      height_cm: heightCentimeters(profile?.height_cm)?.toString() ?? "",
      age: profile?.age?.toString() ?? "",
      sex: profile?.sex ?? "masculino",
      objetivo_fitness: profile?.objetivo_fitness ?? "saude_geral",
    });
    setError("");
  }, [open, profile, currentWeight]);
  const height = heightCentimeters(form.height_cm);
  async function handleSave() {
    if (!userId || saving) return;
    const parsed = profileSchema.safeParse({
      weight_kg: decimalNumber(form.weight_kg),
      height_cm: height,
      age: decimalNumber(form.age),
      sex: form.sex,
      objetivo_fitness: form.objetivo_fitness,
    });
    if (!parsed.success) {
      setError("Verifique peso (20–400 kg), altura (80–260 cm), idade (10–120 anos) e objetivo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const p = parsed.data;
      const { data, error } = await supabase.rpc("save_body_profile", {
        p_weight: p.weight_kg,
        p_height: p.height_cm,
        p_age: p.age,
        p_sex: p.sex,
        p_goal: p.objetivo_fitness,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data) || data.id !== userId)
        throw new Error("Não foi possível confirmar o perfil salvo.");
      toast.success("Perfil atualizado");
      onSaved();
    } catch (error) {
      setError(errorMessage(error, "Erro ao salvar perfil. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent className="workout-plan-dialog max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perfil físico</DialogTitle>
          <DialogDescription>
            Atualize seus dados. O IMC é calculado automaticamente com peso e altura.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving} className="grid grid-cols-2 gap-3">
          <NumField
            label="Peso (kg)"
            value={form.weight_kg}
            onChange={(value) => setForm({ ...form, weight_kg: value })}
          />
          <NumField
            label="Altura (m ou cm)"
            value={form.height_cm}
            onChange={(value) => setForm({ ...form, height_cm: value })}
            help="Ex.: 1,85 ou 185."
          />
          <NumField
            label="Idade"
            step="1"
            value={form.age}
            onChange={(value) => setForm({ ...form, age: value })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="profile-sex">Sexo</Label>
            <Select
              disabled={saving}
              value={form.sex}
              onValueChange={(value) => setForm({ ...form, sex: value })}
            >
              <SelectTrigger id="profile-sex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="profile-goal">Objetivo fitness</Label>
            <Select
              disabled={saving}
              value={form.objetivo_fitness}
              onValueChange={(value) => setForm({ ...form, objetivo_fitness: value })}
            >
              <SelectTrigger id="profile-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FITNESS_GOALS.map((goal) => (
                  <SelectItem key={goal.value} value={goal.value}>
                    {goal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>
        <BMIResult
          weight={decimalNumber(form.weight_kg)}
          height={height}
          age={decimalNumber(form.age)}
          goal={form.objetivo_fitness}
        />
        {error && (
          <p role="alert" className="plan-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <button disabled={saving} onClick={() => onOpenChange(false)} className="share-open">
            <X size={18} />
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={() => void handleSave()}
            className="share-login share-open"
          >
            <Save size={18} />
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeasurementDialog({
  open,
  onOpenChange,
  editing,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Measurement | null;
  userId?: string;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Record<string, string>>({
    measured_at: today,
    weight_kg: "",
    arm_cm: "",
    chest_cm: "",
    waist_cm: "",
    abdomen_cm: "",
    hip_cm: "",
    thigh_cm: "",
    calf_cm: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        measured_at: editing.measured_at,
        weight_kg: editing.weight_kg?.toString() ?? "",
        arm_cm: editing.arm_cm?.toString() ?? "",
        chest_cm: editing.chest_cm?.toString() ?? "",
        waist_cm: editing.waist_cm?.toString() ?? "",
        abdomen_cm: editing.abdomen_cm?.toString() ?? "",
        hip_cm: editing.hip_cm?.toString() ?? "",
        thigh_cm: editing.thigh_cm?.toString() ?? "",
        calf_cm: editing.calf_cm?.toString() ?? "",
      });
    } else {
      setForm({
        measured_at: today,
        weight_kg: "",
        arm_cm: "",
        chest_cm: "",
        waist_cm: "",
        abdomen_cm: "",
        hip_cm: "",
        thigh_cm: "",
        calf_cm: "",
      });
    }
  }, [open, editing, today]);

  function toNum(s: string) {
    if (!s.trim()) return null;
    return decimalNumber(s);
  }

  async function handleSave() {
    if (!userId) return;
    const payload = {
      measured_at: form.measured_at,
      weight_kg: toNum(form.weight_kg),
      arm_cm: toNum(form.arm_cm),
      chest_cm: toNum(form.chest_cm),
      waist_cm: toNum(form.waist_cm),
      abdomen_cm: toNum(form.abdomen_cm),
      hip_cm: toNum(form.hip_cm),
      thigh_cm: toNum(form.thigh_cm),
      calf_cm: toNum(form.calf_cm),
    };
    const parsed = measurementSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error("Verifique os valores das medidas");
      return;
    }
    const hasAny = Object.entries(payload).some(([k, v]) => k !== "measured_at" && v != null);
    if (!hasAny) {
      toast.error("Preencha ao menos uma medida");
      return;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("body_measurements").update(payload).eq("id", editing.id)
      : await supabase.from("body_measurements").insert({ ...payload, user_id: userId });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar medida");
      return;
    }
    toast.success(editing ? "Medida atualizada" : "Medida registrada");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="workout-plan-dialog max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar medida" : "Nova medida"}</DialogTitle>
          <DialogDescription>Registre a data e ao menos uma medida.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="measure-date" className="text-xs">
            Data do registro
          </Label>
          <Input
            id="measure-date"
            type="date"
            value={form.measured_at}
            onChange={(e) => setForm({ ...form, measured_at: e.target.value })}
            className="surface-2 border-border"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Peso (kg)"
            value={form.weight_kg}
            onChange={(v) => setForm({ ...form, weight_kg: v })}
          />
          <NumField
            label="Braço (cm)"
            value={form.arm_cm}
            onChange={(v) => setForm({ ...form, arm_cm: v })}
          />
          <NumField
            label="Peito (cm)"
            value={form.chest_cm}
            onChange={(v) => setForm({ ...form, chest_cm: v })}
          />
          <NumField
            label="Cintura (cm)"
            value={form.waist_cm}
            onChange={(v) => setForm({ ...form, waist_cm: v })}
          />
          <NumField
            label="Abdômen (cm)"
            value={form.abdomen_cm}
            onChange={(v) => setForm({ ...form, abdomen_cm: v })}
          />
          <NumField
            label="Quadril (cm)"
            value={form.hip_cm}
            onChange={(v) => setForm({ ...form, hip_cm: v })}
          />
          <NumField
            label="Coxa (cm)"
            value={form.thigh_cm}
            onChange={(v) => setForm({ ...form, thigh_cm: v })}
          />
          <NumField
            label="Panturrilha (cm)"
            value={form.calf_cm}
            onChange={(v) => setForm({ ...form, calf_cm: v })}
          />
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold"
          >
            <X className="size-3.5" /> Cancelar
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-full bg-neon px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Save className="size-3.5" /> {saving ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
