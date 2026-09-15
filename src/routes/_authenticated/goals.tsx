import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Target, Plus, Trash2, Check, X, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type GoalType = Database["public"]["Enums"]["goal_type"];

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "eForge — Metas" }] }),
  component: GoalsPage,
});

const GOAL_TYPES: { value: GoalType; label: string; unidade: string }[] = [
  { value: "aumentar_carga", label: "Aumentar carga em exercício", unidade: "kg" },
  { value: "mais_repeticoes", label: "Fazer mais repetições", unidade: "reps" },
  { value: "treinos_semana", label: "Treinar mais vezes na semana", unidade: "x" },
  { value: "distancia_cardio", label: "Correr maior distância", unidade: "km" },
  { value: "tempo_cardio", label: "Melhorar tempo no cardio", unidade: "min" },
  { value: "reduzir_peso", label: "Reduzir peso corporal", unidade: "kg" },
  { value: "aumentar_peso", label: "Aumentar peso corporal", unidade: "kg" },
  { value: "medidas_corporais", label: "Melhorar medidas corporais", unidade: "cm" },
];

const ACHIEVEMENTS_CATALOG: Record<string, { medalha: string; descricao: string }> = {
  primeira_meta: { medalha: "Primeira Meta Batida", descricao: "Você concluiu sua primeira meta!" },
  semana_perfeita: { medalha: "Semana Perfeita", descricao: "Treinou todos os dias planejados na semana." },
  recorde_carga: { medalha: "Recorde de Carga", descricao: "Bateu um novo recorde pessoal de carga." },
  recorde_distancia: { medalha: "Recorde de Distância", descricao: "Bateu um novo recorde pessoal de distância." },
  evolucao_corporal: { medalha: "Evolução Corporal", descricao: "Atingiu sua meta de peso ou medidas." },
  consistencia_mensal: { medalha: "Consistência Mensal", descricao: "Manteve treinos consistentes por um mês." },
  guerreiro_cardio: { medalha: "Guerreiro do Cardio", descricao: "Concluiu uma meta de cardio." },
  foco_total: { medalha: "Foco Total", descricao: "Concluiu 5 metas no total." },
  corpo_evolucao: { medalha: "Corpo em Evolução", descricao: "Concluiu uma meta de medidas corporais." },
};

function inferAchievementCode(tipo: GoalType): string {
  switch (tipo) {
    case "aumentar_carga":
    case "mais_repeticoes":
      return "recorde_carga";
    case "distancia_cardio":
      return "recorde_distancia";
    case "tempo_cardio":
      return "guerreiro_cardio";
    case "reduzir_peso":
    case "aumentar_peso":
      return "evolucao_corporal";
    case "medidas_corporais":
      return "corpo_evolucao";
    case "treinos_semana":
      return "semana_perfeita";
  }
}

function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);

  // form
  const [tipo, setTipo] = useState<GoalType>("aumentar_carga");
  const [titulo, setTitulo] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [valorAlvo, setValorAlvo] = useState("");
  const [prazo, setPrazo] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setGoals(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function unlockAchievement(codigo: string) {
    if (!user) return;
    const meta = ACHIEVEMENTS_CATALOG[codigo];
    if (!meta) return;
    const { data: existing } = await supabase
      .from("achievements")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();
    if (existing?.desbloqueada) return;
    if (existing) {
      await supabase.from("achievements")
        .update({ desbloqueada: true, data_conquista: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("achievements").insert({
        user_id: user.id, codigo,
        medalha: meta.medalha, descricao: meta.descricao,
        desbloqueada: true, data_conquista: new Date().toISOString(),
      });
    }
    setCelebration(meta.medalha);
    setTimeout(() => setCelebration(null), 3200);
  }

  async function checkFocoTotal() {
    if (!user) return;
    const { count } = await supabase
      .from("goals").select("*", { count: "exact", head: true })
      .eq("status", "concluida");
    if ((count ?? 0) >= 5) await unlockAchievement("foco_total");
  }

  async function checkPrimeiraMeta() {
    if (!user) return;
    const { count } = await supabase
      .from("achievements").select("*", { count: "exact", head: true })
      .eq("desbloqueada", true);
    if ((count ?? 0) === 0) await unlockAchievement("primeira_meta");
  }

  async function createGoal() {
    if (!user) return;
    if (!titulo || !valorAlvo) { toast.error("Preencha título e valor alvo"); return; }
    const cfg = GOAL_TYPES.find(g => g.value === tipo)!;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      tipo_meta: tipo,
      titulo,
      valor_atual: Number(valorAtual || 0),
      valor_alvo: Number(valorAlvo),
      unidade: cfg.unidade,
      prazo: prazo || null,
      status: "ativa",
    });
    if (error) return toast.error(error.message);
    toast.success("Meta criada!");
    setOpen(false);
    setTitulo(""); setValorAtual(""); setValorAlvo(""); setPrazo("");
    load();
  }

  async function updateProgress(g: GoalRow, novoValor: number) {
    const isReduce = g.tipo_meta === "reduzir_peso" || g.tipo_meta === "tempo_cardio";
    const reached = isReduce ? novoValor <= g.valor_alvo : novoValor >= g.valor_alvo;
    const status = reached ? "concluida" : g.status;
    const { error } = await supabase.from("goals")
      .update({ valor_atual: novoValor, status })
      .eq("id", g.id);
    if (error) return toast.error(error.message);
    if (reached && g.status !== "concluida") {
      await checkPrimeiraMeta();
      await unlockAchievement(inferAchievementCode(g.tipo_meta));
      await checkFocoTotal();
      toast.success("Meta concluída! 🔥");
    } else {
      toast.success("Progresso atualizado");
    }
    load();
  }

  async function cancelGoal(id: string) {
    await supabase.from("goals").update({ status: "cancelada" }).eq("id", id);
    load();
  }

  async function deleteGoal(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    await supabase.from("goals").delete().eq("id", id);
    load();
  }

  const ativas = goals.filter(g => g.status === "ativa");
  const concluidas = goals.filter(g => g.status === "concluida");

  return (
    <main className="mx-auto max-w-md px-5 pt-12 pb-4">
      {celebration && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="relative rounded-3xl border border-neon/50 surface p-8 text-center glow-neon">
            <Sparkles className="mx-auto size-12 text-neon animate-pulse" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-neon">Conquista desbloqueada</p>
            <h2 className="mt-1 text-2xl font-black text-glow">{celebration}</h2>
            <p className="mt-2 text-xs text-muted-foreground">Continue evoluindo, guerreiro 🔥</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Metas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina, supere, conquiste.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="grid size-11 place-items-center rounded-full bg-neon text-primary-foreground glow-neon-soft">
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as GoalType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Supino 100kg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Valor atual</Label>
                  <Input type="number" value={valorAtual} onChange={e => setValorAtual(e.target.value)} />
                </div>
                <div>
                  <Label>Valor alvo</Label>
                  <Input type="number" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <button onClick={createGoal} className="w-full rounded-full bg-neon py-3 font-bold text-primary-foreground glow-neon-soft">
                Criar Meta
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Link to="/achievements"
        className="mt-6 flex items-center justify-between rounded-3xl border border-neon/30 surface p-4 glow-neon-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-neon/15 ring-1 ring-neon/40">
            <Trophy className="size-5 text-neon" />
          </div>
          <div>
            <p className="font-bold">Conquistas</p>
            <p className="text-xs text-muted-foreground">Veja suas medalhas</p>
          </div>
        </div>
        <ChevronRight className="size-5 text-neon" />
      </Link>

      <h2 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Ativas</h2>
      {loading ? (
        <div className="rounded-3xl surface p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : ativas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {ativas.map(g => (
            <GoalCard key={g.id} goal={g} onUpdate={updateProgress} onCancel={cancelGoal} onDelete={deleteGoal} />
          ))}
        </div>
      )}

      {concluidas.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Concluídas</h2>
          <div className="space-y-3">
            {concluidas.map(g => (
              <div key={g.id} className="rounded-3xl border border-neon/30 surface p-4 glow-neon-soft">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-neon text-primary-foreground">
                    <Check className="size-5" strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{g.titulo}</p>
                    <p className="text-xs text-neon">{g.valor_alvo} {g.unidade} alcançado</p>
                  </div>
                  <button onClick={() => deleteGoal(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function GoalCard({
  goal, onUpdate, onCancel, onDelete,
}: {
  goal: GoalRow;
  onUpdate: (g: GoalRow, v: number) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(goal.valor_atual));
  const isReduce = goal.tipo_meta === "reduzir_peso" || goal.tipo_meta === "tempo_cardio";
  const progresso = isReduce
    ? Math.max(0, Math.min(100, ((Number(goal.valor_atual) > 0 ? (1 - (Number(goal.valor_atual) - Number(goal.valor_alvo)) / Number(goal.valor_atual)) : 0)) * 100))
    : Math.max(0, Math.min(100, (Number(goal.valor_atual) / Number(goal.valor_alvo)) * 100));

  return (
    <div className="rounded-3xl border border-border surface p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-neon/15 ring-1 ring-neon/30">
          <Target className="size-5 text-neon" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{goal.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {goal.valor_atual} / {goal.valor_alvo} {goal.unidade}
            {goal.prazo && <span className="ml-2">· até {new Date(goal.prazo).toLocaleDateString("pt-BR")}</span>}
          </p>
        </div>
        <button onClick={() => onDelete(goal.id)} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progresso}%`,
            background: "linear-gradient(90deg, var(--neon-soft), var(--neon-strong))",
            boxShadow: progresso > 30 ? "0 0 12px oklch(0.76 0.19 300 / 0.5)" : "none",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>{Math.round(progresso)}%</span>
      </div>

      {editing ? (
        <div className="mt-3 flex gap-2">
          <Input type="number" value={val} onChange={e => setVal(e.target.value)} className="h-9" />
          <button onClick={() => { onUpdate(goal, Number(val)); setEditing(false); }}
            className="rounded-full bg-neon px-4 text-xs font-bold text-primary-foreground">
            Salvar
          </button>
          <button onClick={() => setEditing(false)} className="grid size-9 place-items-center rounded-full surface-2">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setEditing(true)}
            className="flex-1 rounded-full border border-neon/40 py-2 text-xs font-bold text-neon">
            Atualizar progresso
          </button>
          <button onClick={() => onCancel(goal.id)}
            className="rounded-full border border-border surface-2 px-4 text-xs font-semibold text-muted-foreground">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border surface p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-neon/10 text-neon">
        <Target className="size-7" />
      </div>
      <p className="mt-3 font-bold">Sem metas ativas</p>
      <p className="mt-1 text-xs text-muted-foreground">Crie sua primeira meta e comece a evoluir.</p>
    </div>
  );
}
