import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedSearch } from "@/hooks/use-exercise-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { catalogPageSchema, type Exercise, type CatalogFilters } from "@/lib/exercise-types";
import { BODY_PART_LABELS, bodyPartLabel, equipmentLabel } from "@/lib/exercise-labels";
import { CatalogPagination, CatalogControls } from "./CatalogControls";
import { ExerciseMedia } from "./ExerciseMedia";
import { ExerciseFormDialog } from "./ExerciseFormDialog";
export function CatalogManager({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CatalogFilters>({ source: "eforge" });
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deletion, setDeletion] = useState<{ ids: string[]; all: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const query = useDebouncedSearch(search);
  const catalog = useQuery({
    queryKey: ["exercises", "admin-catalog", userId, query, filters, status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_owned_catalog_page", {
        p_query: query,
        p_body_part: filters.bodyPart || null,
        p_source: filters.source || null,
        p_primary: filters.primaryMuscle || null,
        p_secondary: filters.secondaryMuscle || null,
        p_equipment: filters.equipment || null,
        p_visibility: filters.visibility || null,
        p_status: status,
        p_page: page,
      });
      if (error) throw error;
      return catalogPageSchema
        .extend({ catalog_total: z.number().int().nonnegative() })
        .parse(data);
    },
  });
  const remove = useMutation({
    mutationFn: async (selection: { ids: string[]; all: boolean }) => {
      const { data, error } = await supabase.rpc("delete_catalog_exercises", {
        p_ids: selection.ids,
        p_all: selection.all,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(`${count} exercício(s) excluído(s) da biblioteca`);
      setSelected(new Set());
      setDeletion(null);
      setPage(0);
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("restore_catalog_exercise", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício restaurado");
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const setActive = useMutation({
    mutationFn: async (exercise: Exercise) => {
      const { error } = await supabase.rpc("set_owned_exercise_active", {
        p_id: exercise.id,
        p_active: !exercise.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const available = catalog.data?.items.filter((ex) => !ex.catalog_deleted_at) ?? [];
  const allOnPage = available.length > 0 && available.every((ex) => selected.has(ex.id));
  function toggle(ex: Exercise) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(ex.id)) next.delete(ex.id);
      else if (next.size < 10000) next.add(ex.id);
      return next;
    });
  }
  function askDelete(ids: string[], all = false) {
    setConfirmation("");
    remove.reset();
    setDeletion({ ids, all });
  }
  const selectAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_owned_catalog_page", {
        p_query: query,
        p_body_part: filters.bodyPart || null,
        p_source: filters.source || null,
        p_primary: filters.primaryMuscle || null,
        p_secondary: filters.secondaryMuscle || null,
        p_equipment: filters.equipment || null,
        p_visibility: filters.visibility || null,
        p_status: status,
        p_ids_only: true,
      });
      if (error) throw error;
      return z.object({ matching_ids: z.array(z.string().uuid()) }).parse(data).matching_ids;
    },
    onSuccess: (ids) => setSelected(new Set(ids)),
    onError: (e: Error) => toast.error(e.message),
  });
  const stateQuery = useQuery({
    queryKey: ["exercises", "owned-state", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owned_catalog_state")
        .select("legacy_disabled")
        .single();
      if (error) throw error;
      return data;
    },
  });
  const selectClass =
    "h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-lg focus-visible:outline-2 focus-visible:outline-neon";
  return (
    <div className="space-y-5">
      <section
        className="rounded-2xl border border-border bg-surface p-4"
        aria-labelledby="manager-title"
      >
        <h2 id="manager-title" className="text-2xl">
          Gerenciar exercícios oficiais
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">
          Selecione e organize o catálogo oficial.
        </p>
        <Input
          aria-label="Buscar no catálogo oficial"
          placeholder="Buscar por nome"
          className="my-3 h-12"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
            setSelected(new Set());
          }}
        />
        <CatalogControls
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(0);
            setSelected(new Set());
          }}
          officialOnly
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="min-w-0 text-base text-muted-foreground">
            Mostrar
            <select
              aria-label="Mostrar"
              className={selectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
                setSelected(new Set());
              }}
            >
              <option value="all">Não excluídos</option>
              <option value="active">Disponíveis</option>
              <option value="pending">Para revisar</option>
              <option value="inactive">Inativos</option>
              <option value="deleted">Excluídos</option>
            </select>
          </label>
        </div>
        <div className="my-4 flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={!available.length}
            onClick={() =>
              setSelected((previous) => {
                const next = new Set(previous);
                available.forEach((ex) =>
                  allOnPage ? next.delete(ex.id) : next.size < 10000 && next.add(ex.id),
                );
                return next;
              })
            }
          >
            {allOnPage ? "Desmarcar página" : "Selecionar página"}
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={!catalog.data?.total || status === "deleted" || selectAll.isPending}
            onClick={() => selectAll.mutate()}
          >
            {selectAll.isPending ? "Selecionando…" : "Selecionar todos do filtro"}
          </Button>
          <Button
            className="min-h-11 text-destructive"
            variant="outline"
            disabled={!selected.size || remove.isPending}
            onClick={() => askDelete([...selected.keys()])}
          >
            Excluir selecionados ({selected.size})
          </Button>
          <Button
            className="min-h-11 text-destructive"
            variant="ghost"
            disabled={!catalog.data?.catalog_total || remove.isPending}
            onClick={() => askDelete([], true)}
          >
            Excluir todos
          </Button>
          {!!selected.size && (
            <Button className="min-h-11" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          )}
        </div>
        {!!selected.size && (
          <p role="status" className="text-lg">
            {selected.size} selecionados entre páginas. Limite de 10.000 por seleção.
          </p>
        )}
        {catalog.isPending ? (
          <p role="status">Carregando catálogo…</p>
        ) : catalog.isError ? (
          <p role="alert">
            Catálogo indisponível.{" "}
            <Button variant="ghost" onClick={() => void catalog.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : (
          <>
            <p role="status" className="mb-3 text-lg text-muted-foreground">
              {catalog.data.total} exercícios encontrados
            </p>
            {!catalog.data.total && <p className="py-5">Nenhum exercício com esses filtros.</p>}
            <ul className="space-y-3">
              {catalog.data.items.map((ex) => (
                <li key={ex.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start gap-3">
                    {!ex.catalog_deleted_at && (
                      <label className="flex min-h-11 min-w-11 items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${ex.nome}`}
                          checked={selected.has(ex.id)}
                          onChange={() => toggle(ex)}
                        />
                      </label>
                    )}
                    <ExerciseMedia
                      url={ex.gif_url}
                      name={ex.nome}
                      muscle={ex.musculo_principal}
                      className="size-16 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl leading-tight">{ex.nome}</h3>
                      <p className="text-base text-muted-foreground">
                        {(ex.partes_corpo_pt_br.length
                          ? ex.partes_corpo_pt_br
                          : ex.partes_corpo.map(bodyPartLabel)
                        ).join(", ")}{" "}
                        ·{" "}
                        {(ex.equipamentos_pt_br.length
                          ? ex.equipamentos_pt_br
                          : ex.equipamentos.map(equipmentLabel)
                        ).join(", ")}
                      </p>
                      <p className="text-base text-muted-foreground">
                        {ex.musculo_principal_anatomico || "Músculo não informado"}
                        {ex.classification_confidence
                          ? ` · Confiança ${ex.classification_confidence === "media" ? "média" : ex.classification_confidence}`
                          : ""}
                      </p>
                      <p className="text-base text-muted-foreground">
                        {ex.source === "exercisedb" && stateQuery.data?.legacy_disabled
                          ? "Legado preservado em treinos"
                          : ex.catalog_deleted_at
                            ? "Excluído da biblioteca"
                            : ex.review_status === "pending"
                              ? "Pendente de revisão"
                              : !ex.active
                                ? "Inativo"
                                : !ex.classification_reviewed
                                  ? "Classificação a revisar"
                                  : "Disponível"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ex.source === "exercisedb" && stateQuery.data?.legacy_disabled ? (
                      <p className="text-muted-foreground">Referências históricas preservadas.</p>
                    ) : ex.catalog_deleted_at ? (
                      <Button
                        className="min-h-11"
                        variant="outline"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(ex.id)}
                      >
                        <RotateCcw size={16} />
                        Restaurar
                      </Button>
                    ) : (
                      <>
                        {ex.gif_sha256 && (
                          <Button
                            className="min-h-11"
                            variant="outline"
                            disabled={setActive.isPending}
                            aria-label={`${ex.active ? "Inativar" : "Ativar"} ${ex.nome}`}
                            onClick={() => setActive.mutate(ex)}
                          >
                            {ex.active ? "Inativar" : "Ativar"}
                          </Button>
                        )}
                        <Button
                          className="min-h-11"
                          variant="outline"
                          onClick={() => setEditing(ex)}
                        >
                          Editar / revisar
                        </Button>
                        <Button
                          className="min-h-11 text-destructive"
                          variant="ghost"
                          aria-label={`Excluir ${ex.nome}`}
                          onClick={() => askDelete([ex.id])}
                        >
                          <Trash2 size={16} />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <CatalogPagination page={page} total={catalog.data.total} onChange={setPage} />
          </>
        )}
      </section>
      <ExerciseFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        editing={editing}
        userId={userId}
        isAdmin
      />
      <Dialog
        open={!!deletion}
        onOpenChange={(open) => !open && !remove.isPending && setDeletion(null)}
      >
        <DialogContent className="exercise-dialog bg-surface">
          <DialogHeader>
            <DialogTitle>
              {deletion?.all
                ? "Excluir todo o catálogo oficial?"
                : `Excluir ${deletion?.ids.length ?? 0} exercício(s)?`}
            </DialogTitle>
            <DialogDescription>
              Os itens sairão da biblioteca e poderão ser restaurados. Treinos existentes e
              histórico serão preservados. Uma nova importação não restaurará esses itens.
            </DialogDescription>
          </DialogHeader>
          {deletion?.all && (
            <>
              <p className="text-lg">
                Esta ação abrange {catalog.data?.catalog_total ?? 0} exercícios oficiais de todas as
                páginas e categorias, independentemente dos filtros.
              </p>
              <label className="text-lg">
                Digite EXCLUIR TODOS
                <Input
                  className="mt-2 h-12"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            </>
          )}
          {remove.isError && (
            <p role="alert" className="text-destructive">
              {remove.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setDeletion(null)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-11"
              variant="destructive"
              disabled={remove.isPending || (!!deletion?.all && confirmation !== "EXCLUIR TODOS")}
              onClick={() => deletion && remove.mutate(deletion)}
            >
              {remove.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
