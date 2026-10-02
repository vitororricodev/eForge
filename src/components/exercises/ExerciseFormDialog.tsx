import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, Lock, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { muscleKeys, MUSCLES } from "@/components/muscle-map/anatomy";
import { resolveMuscleKeys } from "@/lib/muscle-activity";
import type { Exercise, ExerciseVisibility } from "@/lib/exercise-types";
type ControlType = Exercise["tipo_controle"];
type Category = Exercise["categoria"];
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

const MUSCLE_OPTIONS = muscleKeys;

export function ExerciseFormDialog({
  open,
  onOpenChange,
  editing,
  userId,
  isAdmin = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Exercise | null;
  userId: string | null;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const official = !!editing && editing.source !== "user";
  const original = useQuery({
    queryKey: ["exercises", "external-review", editing?.id],
    enabled: open && official && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("external_data")
        .eq("id", editing!.id)
        .single();
      if (error) throw error;
      const parsed = z
        .object({
          name: z.string(),
          targetMuscles: z.array(z.string()),
          secondaryMuscles: z.array(z.string()),
          instructions: z.array(z.string()),
        })
        .safeParse(data.external_data);
      return parsed.success ? parsed.data : null;
    },
  });

  const [descricao, setDescricao] = useState("");
  const [equipment, setEquipment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [namePt, setNamePt] = useState("");
  const [instructionsPt, setInstructionsPt] = useState("");
  const [active, setActive] = useState(true);
  const [approved, setApproved] = useState(false);
  const [classified, setClassified] = useState(false);
  const [otherPrimaries, setOtherPrimaries] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [tipoControle, setTipoControle] = useState<ControlType>("peso_kg");
  const [musculoPrincipal, setMusculoPrincipal] = useState<string>(MUSCLE_OPTIONS[0]);
  const [musculosSecundarios, setMusculosSecundarios] = useState<string[]>([]);
  const [musculosTerciarios, setMusculosTerciarios] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ExerciseVisibility>("private");
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
        const primaries = (
          editing.musculos_primarios.length
            ? editing.musculos_primarios
            : [editing.musculo_principal]
        ).flatMap(resolveMuscleKeys);
        setMusculoPrincipal(primaries[0] ?? "");
        setOtherPrimaries(primaries.slice(1));
        setMusculosSecundarios((editing.musculos_secundarios ?? []).flatMap(resolveMuscleKeys));
        setMusculosTerciarios((editing.musculos_terciarios ?? []).flatMap(resolveMuscleKeys));
        setVisibility(editing.visibility ?? "private");
        setCategoria(editing.categoria);
        setObservacoes(editing.observacoes ?? "");
        setPreviewUrl(editing.gif_url);
      } else {
        setNome("");
        setTipoControle("peso_kg");
        setMusculoPrincipal(MUSCLE_OPTIONS[0]);
        setMusculosSecundarios([]);
        setMusculosTerciarios([]);
        setVisibility("private");
        setCategoria("musculacao");
        setObservacoes("");
        setPreviewUrl(null);
      }
      setDescricao(editing?.descricao ?? "");
      setEquipment(editing?.equipamentos.join(", ") ?? "");
      setInstructions(editing?.instrucoes.join("\n") ?? "");
      setNamePt(editing?.name_pt_br ?? "");
      setInstructionsPt(editing?.instrucoes_pt_br.join("\n") ?? "");
      setActive(editing?.active ?? true);
      setApproved(editing?.review_status === "approved");
      setClassified(editing?.classification_reviewed ?? false);
      if (!editing) setOtherPrimaries([]);
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
      if (official && !isAdmin) throw new Error("Permissão administrativa necessária");
      if (!musculoPrincipal) throw new Error("Selecione o músculo principal");
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
        ...(!official ? { user_id: userId, source: "user" as const } : {}),
        descricao: descricao.trim() || null,
        equipamentos: [
          ...new Set(
            equipment
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
        ],
        instrucoes: instructions
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        musculos_primarios: [musculoPrincipal, ...otherPrimaries],
        ...(official
          ? {
              name_pt_br: namePt.trim() || null,
              instrucoes_pt_br: instructionsPt
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
              active,
              review_status: approved ? ("approved" as const) : ("pending" as const),
              classification_reviewed: classified,
            }
          : {}),
        nome: official && namePt.trim() ? namePt.trim() : trimmed,
        gif_url,
        tipo_controle: tipoControle,
        musculo_principal: musculoPrincipal,
        musculos_secundarios: musculosSecundarios,
        musculos_terciarios: musculosTerciarios,
        visibility: official ? ("public" as const) : visibility,
        categoria,
        observacoes: observacoes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("exercises").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("exercises")
          .insert({ ...payload, user_id: userId, source: "user" });
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
      <DialogContent className="exercise-dialog bg-surface border-border max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar exercício" : "Novo exercício"}</DialogTitle>
          <DialogDescription>Preencha as informações abaixo.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Media uploader */}
          <div>
            <Label>GIF ou imagem</Label>
            <div className="mt-2">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl surface-2 hairline">
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="w-full max-h-64 object-contain bg-black"
                  />
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
                  if (f.size > 8 * 1024 * 1024) {
                    toast.error("Arquivo acima de 8MB");
                    return;
                  }
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
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Supino reto"
              maxLength={120}
              className="mt-2 bg-surface-2 border-border"
              required
            />
          </div>

          <div>
            <Label htmlFor="ex-description">Descrição</Label>
            <Textarea
              id="ex-description"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={3000}
            />
          </div>
          <div>
            <Label htmlFor="ex-equipment">Equipamento (separe por vírgulas)</Label>
            <Input
              id="ex-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="ex-instructions">Instruções (uma etapa por linha)</Label>
            <Textarea
              id="ex-instructions"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={12000}
            />
          </div>
          {official && (
            <fieldset className="space-y-3 rounded-2xl border border-neon/30 p-3">
              <legend>Revisão do catálogo oficial</legend>
              {original.data && (
                <details>
                  <summary className="min-h-11 cursor-pointer text-neon">
                    Dados atuais da fonte
                  </summary>
                  <p>Nome: {original.data.name}</p>
                  <p>Alvos: {original.data.targetMuscles.join(", ")}</p>
                  <p>
                    Secundários: {original.data.secondaryMuscles.join(", ") || "Não informados"}
                  </p>
                  <ol className="mt-2 list-decimal pl-5">
                    {original.data.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </details>
              )}
              {original.isError && (
                <p role="status">
                  Não foi possível consultar a versão externa.{" "}
                  <Button variant="ghost" onClick={() => void original.refetch()}>
                    Tentar novamente
                  </Button>
                </p>
              )}

              <p className="text-muted-foreground">
                Nome original: {editing?.name_original}.{" "}
                {editing?.unmapped_muscles.length
                  ? `Sem correspondência: ${editing.unmapped_muscles.join(", ")}.`
                  : ""}
              </p>
              <Label htmlFor="ex-name-pt">Nome em português (opcional)</Label>
              <Input
                id="ex-name-pt"
                value={namePt}
                onChange={(e) => setNamePt(e.target.value)}
                maxLength={300}
              />
              <Label htmlFor="ex-instructions-pt">Instruções em português (opcional)</Label>
              <Textarea
                id="ex-instructions-pt"
                value={instructionsPt}
                onChange={(e) => setInstructionsPt(e.target.value)}
                maxLength={12000}
              />
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={classified}
                  onChange={(e) => setClassified(e.target.checked)}
                />
                Categoria e controle conferidos
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                Dados musculares revisados e aprovados
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Disponível na biblioteca
              </label>
            </fieldset>
          )}
          {!official && (
            <fieldset>
              <legend className="text-sm font-semibold">Visibilidade</legend>
              <p className="mt-1 text-xs text-muted-foreground">
                Defina quem pode encontrar e usar este exercício.
              </p>
              <div
                className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Visibilidade do exercício"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "private"}
                  onClick={() => setVisibility("private")}
                  className={`min-h-[72px] rounded-2xl border p-3 text-left transition-colors ${
                    visibility === "private"
                      ? "border-neon/60 bg-neon/10 text-foreground"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <Lock className="size-4" /> Só eu vejo
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed opacity-80">
                    Privado — somente você pode visualizar e usar.
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "public"}
                  onClick={() => setVisibility("public")}
                  className={`min-h-[72px] rounded-2xl border p-3 text-left transition-colors ${
                    visibility === "public"
                      ? "border-neon/60 bg-neon/10 text-foreground"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <Users className="size-4" /> Público
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed opacity-80">
                    Todos os usuários podem encontrar e usar em seus treinos.
                  </span>
                </button>
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Category)}>
                <SelectTrigger className="mt-2 bg-surface-2 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de controle</Label>
              <Select value={tipoControle} onValueChange={(v) => setTipoControle(v as ControlType)}>
                <SelectTrigger className="mt-2 bg-surface-2 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTROL_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Músculo principal</Label>
            <Select
              value={musculoPrincipal}
              onValueChange={(value) => {
                setMusculoPrincipal(value);
                setOtherPrimaries((prev) => prev.filter((m) => m !== value));
                setMusculosSecundarios((prev) => prev.filter((m) => m !== value));
                setMusculosTerciarios((prev) => prev.filter((m) => m !== value));
              }}
            >
              <SelectTrigger className="mt-2 bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MUSCLES[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {official && (
            <fieldset>
              <legend>Outros músculos principais fornecidos</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {MUSCLE_OPTIONS.filter((m) => m !== musculoPrincipal).map((m) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={otherPrimaries.includes(m)}
                    className={`min-h-11 rounded-full px-3 ${otherPrimaries.includes(m) ? "bg-neon text-primary-foreground" : "bg-surface-2"}`}
                    onClick={() => {
                      setOtherPrimaries((prev) =>
                        prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m],
                      );
                      setMusculosSecundarios((prev) => prev.filter((v) => v !== m));
                      setMusculosTerciarios((prev) => prev.filter((v) => v !== m));
                    }}
                  >
                    {MUSCLES[m].label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <Label>Músculos secundários</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLE_OPTIONS.filter(
                (m) => m !== musculoPrincipal && !otherPrimaries.includes(m),
              ).map((m) => {
                const active = musculosSecundarios.includes(m);
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleSecondary(m)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-full px-3 py-1 text-base font-semibold transition-colors ${
                      active
                        ? "bg-neon text-primary-foreground glow-neon-soft"
                        : "surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {MUSCLES[m].label}
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
              {MUSCLE_OPTIONS.filter(
                (m) => m !== musculoPrincipal && !otherPrimaries.includes(m),
              ).map((m) => {
                const active = musculosTerciarios.includes(m);
                const secondary = musculosSecundarios.includes(m);
                return (
                  <button
                    type="button"
                    key={m}
                    disabled={secondary}
                    onClick={() => toggleTertiary(m)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-full px-3 py-1.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      active
                        ? "bg-[var(--muscle-tertiary)] text-white"
                        : "surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {MUSCLES[m].label}
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
