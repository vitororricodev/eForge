import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Dumbbell, Play, Pencil, Trash2, X, ArrowUp, ArrowDown, History, Loader2, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/workouts")({
  head: () => ({
    meta: [
      { title: "eForge — Treinos" },
      { name: "description", content: "Monte seus treinos, execute série por série e acompanhe o volume levantado." },
      { property: "og:title", content: "eForge — Treinos" },
      { property: "og:description", content: "Monte seus treinos e execute série por série com cronômetro de descanso." },
    ],
  }),
  component: WorkoutsPage,
});

type ExerciseLite = { id: string; nome: string; musculo_principal: string };
type WorkoutRow = { id: string; nome: string; descricao: string | null; created_at: string };
type WEItem = {
  id?: string;
  exercise_id: string;
  series: number;
  repeticoes: number;
  carga_kg: string;
  descanso_seg: number;
};
type SessionRow = {
  id: string;
  nome_treino: string;
  iniciado_em: string;
  duracao_min: number | null;
  volume_total: number;
  status: string;
};

function WorkoutsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [exercises, setExercises] = useState<ExerciseLite[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"treinos" | "historico">("treinos");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutRow | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [items, setItems] = useState<WEItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<WorkoutRow | null>(null);

  async function load() {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [w, e, s, we] = await Promise.all([
      supabase.from("workouts").select("id,nome,descricao,created_at").order("created_at", { ascending: false }),
      supabase.from("exercises").select("id,nome,musculo_principal").order("nome"),
      supabase.from("workout_sessions").select("id,nome_treino,iniciado_em,duracao_min,volume_total,status")
        .order("iniciado_em", { ascending: false }).limit(30),
      supabase.from("workout_exercises").select("id,workout_id"),
    ]);
    if (w.error) toast.error(w.error.message);
    setWorkouts(w.data ?? []);
    setExercises(e.data ?? []);
    setSessions(s.data ?? []);
    const c: Record<string, number> = {};
    (we.data ?? []).forEach((r: { workout_id: string }) => {
      c[r.workout_id] = (c[r.workout_id] ?? 0) + 1;
    });
    setCounts(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  function openNew() {
    setEditing(null);
    setNome("");
    setDescricao("");
    setItems([]);
    setOpen(true);
  }

  async function openEdit(w: WorkoutRow) {
    setEditing(w);
    setNome(w.nome);
    setDescricao(w.descricao ?? "");
    const { data } = await supabase
      .from("workout_exercises")
      .select("id,exercise_id,series,repeticoes,carga_kg,descanso_seg")
      .eq("workout_id", w.id)
      .order("ordem");
    setItems(
      (data ?? []).map((r) => ({
        id: r.id,
        exercise_id: r.exercise_id,
        series: r.series,
        repeticoes: r.repeticoes,
        carga_kg: r.carga_kg == null ? "" : String(r.carga_kg),
        descanso_seg: r.descanso_seg,
      })),
    );
    setOpen(true);
  }

  function addItem(exercise_id: string) {
    if (items.some((i) => i.exercise_id === exercise_id)) return;
    setItems((p) => [...p, { exercise_id, series: 3, repeticoes: 10, carga_kg: "", descanso_seg: 60 }]);
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((p) => {
      const next = [...p];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return p;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }

  async function save() {
    if (!user) return;
    if (!nome.trim()) return toast.error("Dê um nome ao treino.");
    if (items.length === 0) return toast.error("Adicione ao menos um exercício.");
    setSaving(true);
    try {
      let workoutId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("workouts")
          .update({ nome: nome.trim(), descricao: descricao.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
        await supabase.from("workout_exercises").delete().eq("workout_id", editing.id);
      } else {
        const { data, error } = await supabase.from("workouts")
          .insert({ user_id: user.id, nome: nome.trim(), descricao: descricao.trim() || null })
          .select("id").single();
        if (error) throw error;
        workoutId = data.id;
      }
      const rows = items.map((it, i) => ({
        workout_id: workoutId!,
        user_id: user.id,
        exercise_id: it.exercise_id,
        ordem: i,
        series: Number(it.series) || 1,
        repeticoes: Number(it.repeticoes) || 1,
        carga_kg: it.carga_kg === "" ? null : Number(it.carga_kg),
        descanso_seg: Number(it.descanso_seg) || 60,
      }));
      const { error: e2 } = await supabase.from("workout_exercises").insert(rows);
      if (e2) throw e2;
      toast.success(editing ? "Treino atualizado!" : "Treino criado!");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar treino");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("workouts").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Treino excluído.");
      load();
    }
    setToDelete(null);
  }

  const exMap = useMemo(() => {
    const m: Record<string, ExerciseLite> = {};
    exercises.forEach((e) => (m[e.id] = e));
    return m;
  }, [exercises]);

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">eForge</p>
          <h1 className="mt-1 text-3xl font-black">Treinos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monte, execute e acompanhe seu volume.</p>
        </div>
        <button
          onClick={openNew}
          className="grid size-11 place-items-center rounded-full bg-neon text-primary-foreground glow-neon-soft"
          aria-label="Novo treino"
        >
          <Plus className="size-5" strokeWidth={3} />
        </button>
      </div>

      <div className="mt-6 flex gap-2 rounded-full hairline surface p-1">
        {(["treinos", "historico"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t ? "bg-neon text-primary-foreground glow-neon-soft" : "text-muted-foreground"
            }`}
          >
            {t === "treinos" ? "Meus treinos" : "Histórico"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="size-6 animate-spin text-neon" /></div>
      ) : tab === "treinos" ? (
        <div className="mt-5 space-y-3">
          {workouts.length === 0 && (
            <div className="hairline rounded-3xl surface p-8 text-center">
              <Dumbbell className="mx-auto size-8 text-neon" />
              <p className="mt-3 font-bold">Nenhum treino ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie seu primeiro treino usando os exercícios da sua{" "}
                <Link to="/exercises" className="text-neon">biblioteca</Link>.
              </p>
              <Button onClick={openNew} className="mt-4 rounded-full">Criar treino</Button>
            </div>
          )}
          {workouts.map((w) => (
            <div key={w.id} className="hairline rounded-3xl surface p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-neon/15 text-neon ring-1 ring-neon/30">
                  <Dumbbell className="size-6" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{w.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {counts[w.id] ?? 0} exercício{(counts[w.id] ?? 0) === 1 ? "" : "s"}
                    {w.descricao ? ` · ${w.descricao}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => navigate({ to: "/run/$workoutId", params: { workoutId: w.id } })}
                  className="flex items-center gap-1 rounded-full bg-neon px-4 py-2 text-xs font-bold text-primary-foreground glow-neon-soft"
                >
                  <Play className="size-3.5" strokeWidth={3} /> Iniciar
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(w)} className="flex items-center gap-1 rounded-full surface-2 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Pencil className="size-3" /> Editar
                </button>
                <button onClick={() => setToDelete(w)} className="flex items-center gap-1 rounded-full surface-2 px-3 py-1.5 text-[11px] font-semibold text-destructive">
                  <Trash2 className="size-3" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sessions.length === 0 && (
            <div className="hairline rounded-3xl surface p-8 text-center">
              <History className="mx-auto size-8 text-neon" />
              <p className="mt-3 font-bold">Sem execuções ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Inicie um treino para começar seu histórico.</p>
            </div>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="hairline rounded-3xl surface p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">{s.nome_treino}</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  s.status === "concluida" ? "bg-neon/15 text-neon" : "surface-2 text-muted-foreground"
                }`}>
                  {s.status === "concluida" ? "Concluído" : s.status === "em_andamento" ? "Em andamento" : "Cancelado"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(s.iniciado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl surface-2 px-2 py-2">
                  <div className="text-sm font-black text-neon">{Math.round(Number(s.volume_total)).toLocaleString("pt-BR")} kg</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume</div>
                </div>
                <div className="rounded-xl surface-2 px-2 py-2">
                  <div className="text-sm font-black text-neon">{s.duracao_min ? `${Math.round(Number(s.duracao_min))} min` : "—"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duração</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar treino" : "Novo treino"}</DialogTitle>
            <DialogDescription>Escolha exercícios da sua biblioteca e defina séries, reps e descanso.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="w-nome">Nome do treino</Label>
              <Input id="w-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Peito & Tríceps" />
            </div>
            <div>
              <Label htmlFor="w-desc">Descrição (opcional)</Label>
              <Textarea id="w-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            </div>

            <div>
              <Label>Adicionar exercício</Label>
              {exercises.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre exercícios na <Link to="/exercises" className="text-neon">biblioteca</Link> primeiro.
                </p>
              ) : (
                <Select value="" onValueChange={addItem}>
                  <SelectTrigger><SelectValue placeholder="Selecionar da biblioteca" /></SelectTrigger>
                  <SelectContent>
                    {exercises.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome} · {e.musculo_principal}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.exercise_id} className="rounded-2xl hairline surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-neon/15 text-[11px] font-bold text-neon">{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{exMap[it.exercise_id]?.nome ?? "Exercício"}</span>
                    <button onClick={() => move(idx, -1)} aria-label="Subir"><ArrowUp className="size-4 text-muted-foreground" /></button>
                    <button onClick={() => move(idx, 1)} aria-label="Descer"><ArrowDown className="size-4 text-muted-foreground" /></button>
                    <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} aria-label="Remover">
                      <X className="size-4 text-destructive" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <NumField label="Séries" value={it.series} onChange={(v) => setItems((p) => p.map((x, i) => i === idx ? { ...x, series: v } : x))} />
                    <NumField label="Reps" value={it.repeticoes} onChange={(v) => setItems((p) => p.map((x, i) => i === idx ? { ...x, repeticoes: v } : x))} />
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Carga</span>
                      <Input
                        inputMode="decimal"
                        value={it.carga_kg}
                        onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, carga_kg: e.target.value } : x))}
                        className="mt-1 h-9"
                        placeholder="kg"
                      />
                    </div>
                    <NumField label="Desc(s)" value={it.descanso_seg} onChange={(v) => setItems((p) => p.map((x, i) => i === idx ? { ...x, descanso_seg: v } : x))} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="rounded-full">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Salvar treino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
            <AlertDialogDescription>
              O treino "{toDelete?.nome}" e seus exercícios serão removidos. O histórico de execuções é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3" /> Ao finalizar um treino, seu mapa muscular é atualizado automaticamente.
      </p>
    </main>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="mt-1 h-9"
      />
    </div>
  );
}
