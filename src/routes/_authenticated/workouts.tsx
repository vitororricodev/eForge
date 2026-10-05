import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Dumbbell,
  Play,
  Pencil,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  History,
  Loader2,
  Clock,
  Share2,
  ListOrdered,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { SortableList } from "@/components/workouts/SortableList";
import { WorkoutShareDialog } from "@/components/workouts/WorkoutShareDialog";
import { moveTo, errorMessage } from "@/lib/workout-sharing";
import { decimalNumber } from "@/lib/body-profile";
import "@/components/workouts/workout-plan.css";

export const Route = createFileRoute("/_authenticated/workouts")({
  head: () => ({
    meta: [
      { title: "eForge — Treinos" },
      {
        name: "description",
        content: "Monte seus treinos, execute série por série e acompanhe o volume levantado.",
      },
      { property: "og:title", content: "eForge — Treinos" },
      {
        property: "og:description",
        content: "Monte seus treinos e execute série por série com cronômetro de descanso.",
      },
    ],
  }),
  component: WorkoutsPage,
});

type ExerciseLite = { id: string; nome: string; musculo_principal: string };
type WorkoutRow = {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  ordem: number;
};
type WEItem = {
  id: string;
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
  const [planId, setPlanId] = useState("");
  const [shareWorkout, setShareWorkout] = useState<WorkoutRow | null>(null);
  const [orderDraft, setOrderDraft] = useState<WorkoutRow[] | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toDelete, setToDelete] = useState<WorkoutRow | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [w, s, we] = await Promise.all([
        supabase
          .from("workouts")
          .select("id,nome,descricao,created_at,ordem")
          .eq("user_id", user.id)
          .order("ordem")
          .order("created_at", { ascending: false })
          .order("id"),
        supabase
          .from("workout_sessions")
          .select("id,nome_treino,iniciado_em,duracao_min,volume_total,status")
          .eq("user_id", user.id)
          .order("iniciado_em", { ascending: false })
          .limit(30),
        supabase.from("workout_exercises").select("id,workout_id").eq("user_id", user.id),
      ]);
      if (w.error) throw w.error;
      if (s.error) throw s.error;
      if (we.error) throw we.error;
      setWorkouts(w.data ?? []);
      setSessions(s.data ?? []);
      const c: Record<string, number> = {};
      (we.data ?? []).forEach((r) => {
        c[r.workout_id] = (c[r.workout_id] ?? 0) + 1;
      });
      setCounts(c);
    } catch (error) {
      setLoadError(errorMessage(error, "Não foi possível carregar seus treinos."));
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveOrder() {
    if (!orderDraft || ordering) return;
    setOrdering(true);
    try {
      const { error } = await supabase.rpc("reorder_workouts", {
        p_ids: orderDraft.map((w) => w.id),
      });
      if (error) throw error;
      setWorkouts(orderDraft.map((w, index) => ({ ...w, ordem: index })));
      setOrderDraft(null);
      toast.success("Ordem dos treinos salva.");
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível salvar a ordem."));
    } finally {
      setOrdering(false);
    }
  }

  function openNew() {
    setEditing(null);
    setPlanId(crypto.randomUUID());
    setNome("");
    setDescricao("");
    setItems([]);
    setOpen(true);
  }

  async function openEdit(w: WorkoutRow) {
    setEditing(w);
    setPlanId(w.id);
    setNome(w.nome);
    setDescricao(w.descricao ?? "");
    const { data, error } = await supabase
      .from("workout_exercises")
      .select(
        "id,exercise_id,series,repeticoes,carga_kg,descanso_seg,exercises(id,nome,musculo_principal)",
      )
      .eq("workout_id", w.id)
      .order("ordem");
    if (error) {
      toast.error(error.message);
      return;
    }
    setExercises((data ?? []).flatMap((row) => (row.exercises ? [row.exercises] : [])));
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
    setItems((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        exercise_id,
        series: 3,
        repeticoes: 10,
        carga_kg: "",
        descanso_seg: 60,
      },
    ]);
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((p) => moveTo(p, idx, idx + dir));
  }

  async function save() {
    if (!user || saving) return;
    if (!nome.trim() || nome.trim().length > 120)
      return toast.error("Informe um nome de até 120 caracteres.");
    if (items.length === 0) return toast.error("Adicione ao menos um exercício.");
    const rows = items.map((it) => ({
      ...it,
      carga_kg: it.carga_kg.trim() === "" ? null : decimalNumber(it.carga_kg),
    }));
    if (
      rows.some(
        (it) =>
          !Number.isInteger(it.series) ||
          it.series < 1 ||
          it.series > 100 ||
          !Number.isInteger(it.repeticoes) ||
          it.repeticoes < 1 ||
          it.repeticoes > 1000 ||
          !Number.isInteger(it.descanso_seg) ||
          it.descanso_seg < 0 ||
          it.descanso_seg > 3600 ||
          (it.carga_kg !== null &&
            (!Number.isFinite(it.carga_kg) || it.carga_kg < 0 || it.carga_kg > 1000000)),
      )
    )
      return toast.error("Verifique séries, repetições, carga e descanso.");
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("save_workout_plan", {
        p_id: planId,
        p_name: nome.trim(),
        p_description: descricao.trim(),
        p_items: rows,
      });
      if (error) throw error;
      if (data !== planId) throw new Error("O treino não pôde ser confirmado.");
      toast.success(editing ? "Treino atualizado!" : "Treino criado!");
      setOpen(false);
      void load();
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao salvar treino."));
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
    <main className="workout-plans mx-auto max-w-2xl px-5 pt-6 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            eForge
          </p>
          <h1 className="mt-1 text-3xl font-black">Treinos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte, execute e acompanhe seu volume.
          </p>
        </div>
        <button
          disabled={!!orderDraft}
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

      {loadError && (
        <div role="alert" className="plan-error">
          <p>{loadError}</p>
          <Button variant="outline" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-neon" />
        </div>
      ) : tab === "treinos" ? (
        <div className="mt-5 space-y-3">
          {workouts.length > 1 && !orderDraft && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setOrderDraft([...workouts])}
            >
              <ListOrdered size={18} />
              Organizar treinos
            </Button>
          )}
          {orderDraft && (
            <section className="plan-order-controls" aria-label="Organizar treinos">
              <p>Escolha a ordem dos treinos. Você pode alterá-la novamente depois.</p>
              <div>
                <Button variant="outline" disabled={ordering} onClick={() => setOrderDraft(null)}>
                  Cancelar organização
                </Button>
                <Button disabled={ordering} onClick={() => void saveOrder()}>
                  {ordering ? <Loader2 className="animate-spin" /> : <Save size={18} />}Salvar ordem
                </Button>
              </div>
            </section>
          )}
          {workouts.length === 0 && !loadError && (
            <div className="hairline rounded-3xl surface p-8 text-center">
              <Dumbbell className="mx-auto size-8 text-neon" />
              <p className="mt-3 font-bold">Nenhum treino ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie seu primeiro treino usando os exercícios da sua{" "}
                <Link to="/exercises" className="text-neon">
                  biblioteca
                </Link>
                .
              </p>
              <Button onClick={openNew} className="mt-4 rounded-full">
                Criar treino
              </Button>
            </div>
          )}
          {orderDraft ? (
            <SortableList
              items={orderDraft}
              onReorder={setOrderDraft}
              disabled={ordering}
              label={(w) => w.nome}
            >
              {(w, index, handle) => (
                <div className="plan-order-card">
                  <span className="plan-number">{index + 1}</span>
                  <strong>{w.nome}</strong>
                  {handle}
                  <button
                    type="button"
                    className="plan-icon-button"
                    disabled={ordering || index === 0}
                    aria-label={`Subir treino ${w.nome}`}
                    onClick={() => setOrderDraft(moveTo(orderDraft, index, index - 1))}
                  >
                    <ArrowUp size={18} />
                  </button>
                  <button
                    type="button"
                    className="plan-icon-button"
                    disabled={ordering || index === orderDraft.length - 1}
                    aria-label={`Descer treino ${w.nome}`}
                    onClick={() => setOrderDraft(moveTo(orderDraft, index, index + 1))}
                  >
                    <ArrowDown size={18} />
                  </button>
                </div>
              )}
            </SortableList>
          ) : (
            workouts.map((w) => (
              <article key={w.id} className="hairline rounded-3xl surface p-4">
                <div className="plan-card-heading">
                  <div className="plan-card-icon">
                    <Dumbbell size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{w.nome}</h2>
                    <p className="text-muted-foreground">
                      {counts[w.id] ?? 0} exercício{counts[w.id] === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      void navigate({ to: "/run/$workoutId", params: { workoutId: w.id } })
                    }
                  >
                    <Play size={18} />
                    Iniciar
                  </Button>
                </div>
                {w.descricao && (
                  <p className="mt-3 text-muted-foreground break-words">{w.descricao}</p>
                )}
                <div className="plan-card-actions">
                  <Button
                    variant="outline"
                    aria-label={`Editar ${w.nome}`}
                    onClick={() => void openEdit(w)}
                  >
                    <Pencil size={18} />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    aria-label={`Compartilhar ${w.nome}`}
                    onClick={() => setShareWorkout(w)}
                  >
                    <Share2 size={18} />
                    Compartilhar
                  </Button>
                  <button
                    className="plan-icon-button text-destructive"
                    aria-label={`Excluir ${w.nome}`}
                    onClick={() => setToDelete(w)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sessions.length === 0 && (
            <div className="hairline rounded-3xl surface p-8 text-center">
              <History className="mx-auto size-8 text-neon" />
              <p className="mt-3 font-bold">Sem execuções ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Inicie um treino para começar seu histórico.
              </p>
            </div>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="hairline rounded-3xl surface p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">{s.nome_treino}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    s.status === "concluida"
                      ? "bg-neon/15 text-neon"
                      : "surface-2 text-muted-foreground"
                  }`}
                >
                  {s.status === "concluida"
                    ? "Concluído"
                    : s.status === "em_andamento"
                      ? "Em andamento"
                      : "Cancelado"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(s.iniciado_em).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl surface-2 px-2 py-2">
                  <div className="text-sm font-black text-neon">
                    {Math.round(Number(s.volume_total)).toLocaleString("pt-BR")} kg
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Volume
                  </div>
                </div>
                <div className="rounded-xl surface-2 px-2 py-2">
                  <div className="text-sm font-black text-neon">
                    {s.duracao_min ? `${Math.round(Number(s.duracao_min))} min` : "—"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Duração
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <WorkoutShareDialog workout={shareWorkout} onClose={() => setShareWorkout(null)} />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
      >
        <DialogContent className="workout-plan-dialog max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar treino" : "Novo treino"}</DialogTitle>
            <DialogDescription>
              Escolha exercícios da sua biblioteca e defina séries, reps e descanso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="w-nome">Nome do treino</Label>
              <Input
                maxLength={120}
                disabled={saving}
                id="w-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Peito & Tríceps"
              />
            </div>
            <div>
              <Label htmlFor="w-desc">Descrição (opcional)</Label>
              <Textarea
                id="w-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label>Adicionar exercício</Label>
              <ExercisePicker
                excludeIds={items.map((item) => item.exercise_id)}
                onSelect={(ex) => {
                  setExercises((prev) => [...prev.filter((item) => item.id !== ex.id), ex]);
                  addItem(ex.id);
                }}
              />
            </div>

            <SortableList
              items={items}
              onReorder={setItems}
              disabled={saving}
              label={(it) => exMap[it.exercise_id]?.nome ?? "Exercício"}
            >
              {(it, idx, handle) => {
                const name = exMap[it.exercise_id]?.nome ?? "Exercício indisponível";
                const update = (patch: Partial<WEItem>) =>
                  setItems((p) => p.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
                return (
                  <section className="plan-exercise" aria-label={`${idx + 1}. ${name}`}>
                    <div className="plan-exercise-title">
                      <span className="plan-number">{idx + 1}</span>
                      <h3>{name}</h3>
                    </div>
                    <div className="plan-exercise-actions">
                      {handle}
                      <span>Reordenar</span>
                      <button
                        type="button"
                        disabled={saving || idx === 0}
                        className="plan-icon-button"
                        aria-label={`Subir ${name}`}
                        onClick={() => move(idx, -1)}
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button
                        type="button"
                        disabled={saving || idx === items.length - 1}
                        className="plan-icon-button"
                        aria-label={`Descer ${name}`}
                        onClick={() => move(idx, 1)}
                      >
                        <ArrowDown size={18} />
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="plan-icon-button text-destructive"
                        aria-label={`Remover ${name}`}
                        onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="plan-fields">
                      <NumField
                        label="Séries"
                        name={name}
                        value={it.series}
                        disabled={saving}
                        onChange={(v) => update({ series: v })}
                      />
                      <NumField
                        label="Repetições"
                        name={name}
                        value={it.repeticoes}
                        disabled={saving}
                        onChange={(v) => update({ repeticoes: v })}
                      />
                      <label>
                        Carga (kg)
                        <Input
                          aria-label={`Carga de ${name}`}
                          inputMode="decimal"
                          disabled={saving}
                          value={it.carga_kg}
                          onChange={(e) => update({ carga_kg: e.target.value })}
                          placeholder="Opcional"
                        />
                      </label>
                      <NumField
                        label="Descanso (s)"
                        name={name}
                        value={it.descanso_seg}
                        disabled={saving}
                        onChange={(v) => update({ descanso_seg: v })}
                      />
                    </div>
                  </section>
                );
              }}
            </SortableList>
          </div>

          <DialogFooter>
            <Button disabled={saving} variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
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
              O treino "{toDelete?.nome}" e seus exercícios serão removidos. O histórico de
              execuções é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3" /> Ao finalizar um treino, seu mapa muscular é atualizado
        automaticamente.
      </p>
    </main>
  );
}

function NumField({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label>
      {label}
      <Input
        aria-label={`${label} de ${name}`}
        inputMode="numeric"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
      />
    </label>
  );
}
