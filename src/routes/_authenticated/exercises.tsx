import { MuscleThumbnail } from "@/components/MuscleThumbnail";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, Upload, Library as LibraryIcon, X, Loader2, ImageOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { Database } from "@/integrations/supabase/types";

type ControlType = Database["public"]["Enums"] extends { exercise_control_type: infer T }
  ? T : "peso_corporal" | "peso_kg" | "repeticoes" | "segundos" | "distancia";
type Category = Database["public"]["Enums"] extends { exercise_category: infer T }
  ? T : "musculacao" | "cardio" | "funcional" | "alongamento";

type Exercise = {
  id: string;
  user_id: string;
  nome: string;
  gif_url: string | null;
  tipo_controle: ControlType;
  musculo_principal: string;
  musculos_secundarios: string[];
  musculos_terciarios: string[];
  categoria: Category;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

const CONTROL_OPTIONS: { value: ControlType; label: string }[] = [
  { value: "peso_corporal", label: "Peso corporal" },
  { value: "peso_kg", label: "Peso (kg)" },
  { value: "repeticoes", label: "Repetições" },
  { value: "segundos", label: "Segundos" },
  { value: "distancia", label: "Distância" },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "musculacao", label: "Musculação" },
  { value: "cardio", label: "Cardio" },
  { value: "funcional", label: "Funcional" },
  { value: "alongamento", label: "Alongamento" },
];

const MUSCLE_OPTIONS = [
  "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraço",
  "Abdômen", "Lombar", "Glúteo", "Quadríceps", "Posterior", "Panturrilha",
  "Trapézio", "Core",
];

export const Route = createFileRoute("/_authenticated/exercises")({
  head: () => ({ meta: [{ title: "eForge — Exercícios" }] }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [fMuscle, setFMuscle] = useState<string>("all");
  const [fCategory, setFCategory] = useState<string>("all");
  const [fControl, setFControl] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exercises", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Exercise[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (q && !e.nome.toLowerCase().includes(q)) return false;
      if (fMuscle !== "all" && e.musculo_principal !== fMuscle) return false;
      if (fCategory !== "all" && e.categoria !== fCategory) return false;
      if (fControl !== "all" && e.tipo_controle !== fControl) return false;
      return true;
    });
  }, [exercises, search, fMuscle, fCategory, fControl]);

  const deleteMutation = useMutation({
    mutationFn: async (ex: Exercise) => {
      if (ex.gif_url) {
        // Try extract storage path: .../object/public/exercise-media/<path>
        const marker = "/exercise-media/";
        const idx = ex.gif_url.indexOf(marker);
        if (idx >= 0) {
          const path = ex.gif_url.slice(idx + marker.length);
          await supabase.storage.from("exercise-media").remove([path]);
        }
      }
      const { error } = await supabase.from("exercises").delete().eq("id", ex.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício excluído");
      qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Biblioteca
          </p>
          <h1 className="mt-1 text-3xl font-black">Exercícios</h1>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="rounded-full bg-neon text-primary-foreground glow-neon-soft hover:bg-neon/90 h-10 px-4 font-bold"
        >
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {/* Search */}
      <div className="mt-5 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome…"
          className="pl-9 h-11 rounded-2xl bg-surface border-border"
        />
      </div>

      {/* Filters */}
      <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
        <FilterSelect
          value={fMuscle} onChange={setFMuscle} placeholder="Músculo"
          options={[{ value: "all", label: "Todos músculos" },
            ...MUSCLE_OPTIONS.map((m) => ({ value: m, label: m }))]}
        />
        <FilterSelect
          value={fCategory} onChange={setFCategory} placeholder="Categoria"
          options={[{ value: "all", label: "Todas categorias" },
            ...CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))]}
        />
        <FilterSelect
          value={fControl} onChange={setFControl} placeholder="Controle"
          options={[{ value: "all", label: "Todos controles" },
            ...CONTROL_OPTIONS.map((c) => ({ value: c.value, label: c.label }))]}
        />
      </div>

      {/* List */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-neon" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => { setEditing(null); setFormOpen(true); }} hasAny={exercises.length > 0} />
        ) : (
          <ul className="space-y-3">
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                onEdit={() => { setEditing(ex); setFormOpen(true); }}
                onDelete={() => setToDelete(ex)}
              />
            ))}
          </ul>
        )}
      </div>

      <ExerciseFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        userId={user?.id ?? null}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exercício?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.nome} será removido permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) { deleteMutation.mutate(toDelete); setToDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function FilterSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-full bg-surface border-border min-w-[140px] text-xs font-semibold">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ExerciseCard({
  ex, onEdit, onDelete,
}: { ex: Exercise; onEdit: () => void; onDelete: () => void }) {
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === ex.categoria)?.label ?? ex.categoria;
  const controlLabel = CONTROL_OPTIONS.find((c) => c.value === ex.tipo_controle)?.label ?? ex.tipo_controle;
  return (
    <li className="hairline rounded-3xl surface p-3 flex gap-3 animate-fade-up">
      <div className="size-20 shrink-0 overflow-hidden rounded-2xl surface-2 grid place-items-center">
        {ex.gif_url ? (
          <img src={ex.gif_url} alt={ex.nome} className="size-full object-cover" loading="lazy" />
        ) : (
          <MuscleThumbnail muscle={ex.musculo_principal} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold leading-tight truncate">{ex.nome}</div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">{ex.musculo_principal}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="secondary" className="bg-neon/15 text-neon border-0 text-[10px] font-semibold">
            {categoryLabel}
          </Badge>
          <Badge variant="secondary" className="bg-surface-2 text-foreground border-0 text-[10px] font-semibold">
            {controlLabel}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onEdit}
          className="grid size-8 place-items-center rounded-full surface-2 hover:bg-neon/15 hover:text-neon transition-colors"
          aria-label="Editar"
        >
          <Pencil className="size-4" />
        </button>
        <button
          onClick={onDelete}
          className="grid size-8 place-items-center rounded-full surface-2 hover:bg-destructive/20 hover:text-destructive transition-colors"
          aria-label="Excluir"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="mt-6 hairline rounded-3xl surface px-6 py-12 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-neon/15 text-neon ring-1 ring-neon/30 glow-neon-soft">
        <LibraryIcon className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold">
        {hasAny ? "Nenhum resultado" : "Sua biblioteca está vazia"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasAny ? "Ajuste a busca ou os filtros." : "Cadastre seu primeiro exercício para começar."}
      </p>
      {!hasAny && (
        <Button
          onClick={onCreate}
          className="mt-5 rounded-full bg-neon text-primary-foreground hover:bg-neon/90 glow-neon-soft font-bold"
        >
          <Plus className="size-4" /> Cadastrar exercício
        </Button>
      )}
    </div>
  );
}

function ExerciseFormDialog({
  open, onOpenChange, editing, userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Exercise | null;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [tipoControle, setTipoControle] = useState<ControlType>("peso_kg");
  const [musculoPrincipal, setMusculoPrincipal] = useState<string>(MUSCLE_OPTIONS[0]);
  const [musculosSecundarios, setMusculosSecundarios] = useState<string[]>([]);
  const [musculosTerciarios, setMusculosTerciarios] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<Category>("musculacao");
  const [observacoes, setObservacoes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setNome(editing.nome);
        setTipoControle(editing.tipo_controle);
        setMusculoPrincipal(editing.musculo_principal);
        setMusculosSecundarios(editing.musculos_secundarios ?? []);
        setMusculosTerciarios(editing.musculos_terciarios ?? []);
        setCategoria(editing.categoria);
        setObservacoes(editing.observacoes ?? "");
        setPreviewUrl(editing.gif_url);
      } else {
        setNome("");
        setTipoControle("peso_kg");
        setMusculoPrincipal(MUSCLE_OPTIONS[0]);
        setMusculosSecundarios([]);
        setMusculosTerciarios([]);
        setCategoria("musculacao");
        setObservacoes("");
        setPreviewUrl(null);
      }
      setFile(null);
      setRemoveExistingMedia(false);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setRemoveExistingMedia(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const toggleSecondary = (m: string) => {
    const adding = !musculosSecundarios.includes(m);
    setMusculosSecundarios((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
    if (adding) setMusculosTerciarios((prev) => prev.filter((x) => x !== m));
  };

  const toggleTertiary = (m: string) => {
    const adding = !musculosTerciarios.includes(m);
    setMusculosTerciarios((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
    if (adding) setMusculosSecundarios((prev) => prev.filter((x) => x !== m));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado");
      const trimmed = nome.trim();
      if (!trimmed) throw new Error("Informe o nome do exercício");

      let gif_url: string | null = editing?.gif_url ?? null;

      if (removeExistingMedia && !file) gif_url = null;

      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("exercise-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("exercise-media").getPublicUrl(path);
        gif_url = data.publicUrl;

        // Cleanup old file
        if (editing?.gif_url) {
          const marker = "/exercise-media/";
          const idx = editing.gif_url.indexOf(marker);
          if (idx >= 0) {
            const oldPath = editing.gif_url.slice(idx + marker.length);
            await supabase.storage.from("exercise-media").remove([oldPath]);
          }
        }
      }

      const payload = {
        user_id: userId,
        nome: trimmed,
        gif_url,
        tipo_controle: tipoControle,
        musculo_principal: musculoPrincipal,
        musculos_secundarios: musculosSecundarios,
        musculos_terciarios: musculosTerciarios,
        categoria,
        observacoes: observacoes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("exercises").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exercises").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Exercício atualizado" : "Exercício cadastrado");
      qc.invalidateQueries({ queryKey: ["exercises"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar exercício" : "Novo exercício"}</DialogTitle>
          <DialogDescription>Preencha as informações abaixo.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          {/* Media uploader */}
          <div>
            <Label>GIF ou imagem</Label>
            <div className="mt-2">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl surface-2 hairline">
                  <img src={previewUrl} alt="preview" className="w-full max-h-64 object-contain bg-black" />
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setRemoveExistingMedia(true);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-destructive"
                    aria-label="Remover"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl border border-dashed border-neon/40 bg-surface-2 px-4 py-8 text-center transition-colors hover:bg-neon/5"
                >
                  <Upload className="mx-auto size-6 text-neon" />
                  <div className="mt-2 text-sm font-semibold">Enviar GIF ou imagem</div>
                  <div className="text-xs text-muted-foreground">PNG, JPG, GIF ou WebP</div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 8 * 1024 * 1024) { toast.error("Arquivo acima de 8MB"); return; }
                  setFile(f);
                }}
              />
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs font-semibold text-neon hover:underline"
                >
                  Trocar arquivo
                </button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="nome">Nome do exercício</Label>
            <Input
              id="nome" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Supino reto"
              maxLength={120}
              className="mt-2 bg-surface-2 border-border"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Category)}>
                <SelectTrigger className="mt-2 bg-surface-2 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de controle</Label>
              <Select value={tipoControle} onValueChange={(v) => setTipoControle(v as ControlType)}>
                <SelectTrigger className="mt-2 bg-surface-2 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTROL_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Músculo principal</Label>
            <Select value={musculoPrincipal} onValueChange={(value) => {
                setMusculoPrincipal(value);
                setMusculosSecundarios((prev) => prev.filter((m) => m !== value));
                setMusculosTerciarios((prev) => prev.filter((m) => m !== value));
              }}>
              <SelectTrigger className="mt-2 bg-surface-2 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MUSCLE_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Músculos secundários</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLE_OPTIONS.filter((m) => m !== musculoPrincipal).map((m) => {
                const active = musculosSecundarios.includes(m);
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleSecondary(m)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-neon text-primary-foreground glow-neon-soft"
                        : "surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <Label>Músculos terciários</Label>
              <span className="text-[11px] text-muted-foreground">apoio menor no movimento</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.filter((m) => m !== musculoPrincipal).map((m) => {
                const active = musculosTerciarios.includes(m);
                const secondary = musculosSecundarios.includes(m);
                return (
                  <button
                    type="button"
                    key={m}
                    disabled={secondary}
                    onClick={() => toggleTertiary(m)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      active
                        ? "bg-[var(--muscle-tertiary)] text-white"
                        : "surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              placeholder="Detalhes de execução, cadência, dicas…"
              className="mt-2 bg-surface-2 border-border min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-neon text-primary-foreground hover:bg-neon/90 glow-neon-soft font-bold"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
