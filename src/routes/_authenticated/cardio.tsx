import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Heart, Plus, Pencil, Trash2, Bike, Footprints, Activity, Save, X, Flame, Timer, Route as RouteIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/cardio")({
  head: () => ({ meta: [{ title: "eForge — Cardio" }] }),
  component: CardioPage,
});

type CardioType = "corrida" | "caminhada" | "bicicleta";

type CardioLog = {
  id: string;
  user_id: string;
  tipo_cardio: CardioType;
  distancia_km: number | null;
  tempo_min: number | null;
  ritmo_medio: number | null;
  calorias: number | null;
  observacoes: string | null;
  data_atividade: string;
};

const TYPES: { value: CardioType; label: string; icon: typeof Heart }[] = [
  { value: "corrida", label: "Corrida", icon: Footprints },
  { value: "caminhada", label: "Caminhada", icon: Activity },
  { value: "bicicleta", label: "Bicicleta", icon: Bike },
];

const schema = z.object({
  tipo_cardio: z.enum(["corrida", "caminhada", "bicicleta"]),
  data_atividade: z.string().min(1),
  distancia_km: z.number().min(0).max(500).nullable(),
  tempo_min: z.number().min(0).max(1440).nullable(),
  calorias: z.number().int().min(0).max(10000).nullable(),
  observacoes: z.string().max(500).nullable(),
});

function CardioPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CardioLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CardioLog | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cardio_logs")
      .select("*")
      .order("data_atividade", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cardio");
    else setLogs((data ?? []) as CardioLog[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    const w = logs.filter(l => new Date(l.data_atividade) >= weekAgo);
    const m = logs.filter(l => new Date(l.data_atividade) >= monthAgo);
    const sum = (arr: CardioLog[], k: "distancia_km" | "tempo_min" | "calorias") =>
      arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    return {
      weekKm: sum(w, "distancia_km"),
      weekMin: sum(w, "tempo_min"),
      monthKm: sum(m, "distancia_km"),
      totalKcal: sum(m, "calorias"),
      count: logs.length,
    };
  }, [logs]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (l: CardioLog) => { setEditing(l); setOpen(true); };

  const handleDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("cardio_logs").delete().eq("id", delId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Atividade removida"); setLogs(l => l.filter(x => x.id !== delId)); }
    setDelId(null);
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Atividades</p>
          <h1 className="mt-1 text-3xl font-black">Cardio 🔥</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe sua resistência</p>
        </div>
        <button onClick={openNew} className="grid size-11 place-items-center rounded-full bg-neon text-primary-foreground glow-neon-soft">
          <Plus className="size-5" strokeWidth={2.8} />
        </button>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <SummaryCard icon={<RouteIcon className="size-5" />} label="Semana" value={`${stats.weekKm.toFixed(1)} km`} />
        <SummaryCard icon={<Timer className="size-5" />} label="Tempo semana" value={`${Math.round(stats.weekMin)} min`} />
        <SummaryCard icon={<Activity className="size-5" />} label="Mês" value={`${stats.monthKm.toFixed(1)} km`} />
        <SummaryCard icon={<Flame className="size-5" />} label="Kcal mês" value={`${stats.totalKcal}`} />
      </div>

      {/* History */}
      <h2 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Histórico</h2>
      {loading ? (
        <div className="hairline rounded-3xl surface p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : logs.length === 0 ? (
        <div className="hairline rounded-3xl surface p-8 text-center">
          <Heart className="mx-auto size-10 text-neon" />
          <p className="mt-3 font-bold">Nenhuma atividade ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">Registre seu primeiro cardio e comece a evoluir.</p>
          <button onClick={openNew} className="mt-4 rounded-full bg-neon px-5 py-2 text-xs font-bold text-primary-foreground glow-neon-soft">
            Registrar agora
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((l) => {
            const meta = TYPES.find(t => t.value === l.tipo_cardio)!;
            const Icon = meta.icon;
            return (
              <div key={l.id} className="hairline rounded-2xl surface p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-neon/15 text-neon ring-1 ring-neon/30">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold capitalize">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.data_atividade).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <button onClick={() => openEdit(l)} className="grid size-8 place-items-center rounded-lg surface-2 text-muted-foreground hover:text-neon">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => setDelId(l.id)} className="grid size-8 place-items-center rounded-lg surface-2 text-muted-foreground hover:text-red-400">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Mini label="km" value={l.distancia_km != null ? Number(l.distancia_km).toFixed(1) : "—"} />
                  <Mini label="min" value={l.tempo_min != null ? String(Math.round(Number(l.tempo_min))) : "—"} />
                  <Mini label="min/km" value={l.ritmo_medio != null ? Number(l.ritmo_medio).toFixed(2) : "—"} />
                  <Mini label="kcal" value={l.calorias != null ? String(l.calorias) : "—"} />
                </div>
                {l.observacoes && (
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{l.observacoes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CardioDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        userId={user?.id ?? ""}
        onSaved={(row) => {
          setLogs(prev => {
            const without = prev.filter(p => p.id !== row.id);
            return [row, ...without].sort((a, b) => b.data_atividade.localeCompare(a.data_atividade));
          });
        }}
      />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="hairline rounded-2xl surface p-4">
      <div className="grid size-9 place-items-center rounded-lg bg-neon/10 text-neon">{icon}</div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black leading-tight">{value}</div>
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg surface-2 px-1 py-1.5">
      <div className="text-sm font-black text-neon">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function CardioDialog({
  open, onOpenChange, editing, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: CardioLog | null;
  userId: string;
  onSaved: (row: CardioLog) => void;
}) {
  const [tipo, setTipo] = useState<CardioType>("corrida");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [dist, setDist] = useState<string>("");
  const [tempo, setTempo] = useState<string>("");
  const [kcal, setKcal] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTipo(editing.tipo_cardio);
        setData(editing.data_atividade);
        setDist(editing.distancia_km?.toString() ?? "");
        setTempo(editing.tempo_min?.toString() ?? "");
        setKcal(editing.calorias?.toString() ?? "");
        setObs(editing.observacoes ?? "");
      } else {
        setTipo("corrida");
        setData(new Date().toISOString().slice(0, 10));
        setDist(""); setTempo(""); setKcal(""); setObs("");
      }
    }
  }, [open, editing]);

  const ritmo = useMemo(() => {
    const d = parseFloat(dist), t = parseFloat(tempo);
    if (!d || !t || d <= 0) return null;
    return Number((t / d).toFixed(2));
  }, [dist, tempo]);

  const save = async () => {
    const parsed = schema.safeParse({
      tipo_cardio: tipo,
      data_atividade: data,
      distancia_km: dist === "" ? null : parseFloat(dist),
      tempo_min: tempo === "" ? null : parseFloat(tempo),
      calorias: kcal === "" ? null : parseInt(kcal, 10),
      observacoes: obs.trim() === "" ? null : obs.trim(),
    });
    if (!parsed.success) { toast.error("Verifique os campos preenchidos"); return; }

    setSaving(true);
    const payload = {
      ...parsed.data,
      ritmo_medio: ritmo,
      user_id: userId,
    };

    if (editing) {
      const { data: row, error } = await supabase
        .from("cardio_logs").update(payload).eq("id", editing.id).select("*").single();
      setSaving(false);
      if (error || !row) { toast.error("Erro ao salvar"); return; }
      toast.success("Atividade atualizada");
      onSaved(row as CardioLog);
    } else {
      const { data: row, error } = await supabase
        .from("cardio_logs").insert(payload).select("*").single();
      setSaving(false);
      if (error || !row) { toast.error("Erro ao salvar"); return; }
      toast.success("Atividade registrada");
      onSaved(row as CardioLog);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar atividade" : "Novo cardio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Tipo</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TYPES.map(t => {
                const Icon = t.icon;
                const active = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-all ${
                      active ? "border-neon bg-neon/10 text-neon glow-neon-soft" : "border-border surface-2 text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-[11px] font-bold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Calorias</Label>
              <Input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" />
            </div>
            <div>
              <Label className="text-xs">Distância (km)</Label>
              <Input type="number" step="0.01" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="5.0" />
            </div>
            <div>
              <Label className="text-xs">Tempo (min)</Label>
              <Input type="number" step="0.1" inputMode="decimal" value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="30" />
            </div>
          </div>
          {ritmo != null && (
            <div className="rounded-xl border border-neon/30 bg-neon/5 px-3 py-2 text-xs">
              Ritmo médio estimado: <span className="font-bold text-neon">{ritmo} min/km</span>
            </div>
          )}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Como foi o treino?" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1.5 rounded-full surface-2 px-4 py-2 text-xs font-bold text-muted-foreground"
          >
            <X className="size-4" /> Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-neon px-4 py-2 text-xs font-bold text-primary-foreground glow-neon-soft disabled:opacity-50"
          >
            <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
