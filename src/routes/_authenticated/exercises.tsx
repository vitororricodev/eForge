import { muscleLabel } from "@/lib/exercise-labels";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Library, ShieldCheck } from "lucide-react";
import { isMuscleKey, MUSCLES } from "@/components/muscle-map/anatomy";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useCatalogAdmin,
  useDebouncedSearch,
  useExerciseCatalog,
} from "@/hooks/use-exercise-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { ExerciseFormDialog } from "@/components/exercises/ExerciseFormDialog";
import { CatalogControls, CatalogPagination } from "@/components/exercises/CatalogControls";
import { ExerciseDetails, AddToWorkoutDialog } from "@/components/exercises/ExerciseDetails";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import type { Exercise, CatalogFilters } from "@/lib/exercise-types";
import type { MuscleKey } from "@/components/MuscleBody";

export const Route = createFileRoute("/_authenticated/exercises")({
  head: () => ({ meta: [{ title: "eForge — Biblioteca de exercícios" }] }),
  validateSearch: (search: Record<string, unknown>): { muscle?: MuscleKey; q?: string } => ({
    muscle: isMuscleKey(search.muscle) ? search.muscle : undefined,
    q: typeof search.q === "string" ? search.q.slice(0, 120) : undefined,
  }),
  component: ExercisesPage,
});
function ExercisesPage() {
  const { user } = useAuth();
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const admin = useCatalogAdmin();
  const [search, setSearch] = useState(routeSearch.q ?? "");
  const [filters, setFilters] = useState<CatalogFilters>({
    page: 0,
    muscles: routeSearch.muscle ? [routeSearch.muscle] : [],
  });
  useEffect(() => {
    setSearch(routeSearch.q ?? "");
    setFilters((f) => ({ ...f, page: 0, muscles: routeSearch.muscle ? [routeSearch.muscle] : [] }));
  }, [routeSearch.q, routeSearch.muscle]);
  const query = useDebouncedSearch(search);
  const catalog = useExerciseCatalog({ ...filters, query });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [add, setAdd] = useState<Exercise | null>(null);
  const create = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const deleteMutation = useMutation({
    mutationFn: async (ex: Exercise) => {
      if (ex.source !== "user" || ex.user_id !== user?.id)
        throw new Error("Você só pode excluir seus próprios exercícios");
      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", ex.id)
        .eq("user_id", user.id)
        .eq("source", "user");
      if (error) throw error;
      const marker = "/exercise-media/";
      const index = ex.gif_url?.indexOf(marker) ?? -1;
      if (ex.gif_url && index >= 0)
        await supabase.storage
          .from("exercise-media")
          .remove([ex.gif_url.slice(index + marker.length)]);
    },
    onSuccess: () => {
      toast.success("Exercício excluído");
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <main className="exercise-catalog-page mx-auto max-w-5xl px-4 pb-6 pt-6 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base uppercase tracking-widest text-neon">Biblioteca</p>
          <h1 className="text-4xl">Exercícios</h1>
          <p className="mt-1 text-lg text-muted-foreground">Encontre seu próximo movimento.</p>
        </div>
        <Button className="h-11 rounded-full px-4" onClick={create}>
          <Plus size={18} />
          Novo
        </Button>
      </header>
      {admin.data && (
        <Link
          to="/admin/exercises"
          className="mt-3 flex min-h-11 items-center gap-2 text-lg text-neon"
        >
          <ShieldCheck size={18} />
          Gerenciar biblioteca oficial
        </Link>
      )}
      {routeSearch.muscle &&
        filters.muscles?.length === 1 &&
        filters.muscles[0] === routeSearch.muscle && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border p-3">
            <span className="text-lg">Relacionados a {MUSCLES[routeSearch.muscle].label}</span>
            <Button
              variant="ghost"
              className="h-11 text-neon"
              aria-label="Limpar filtro do mapa muscular"
              onClick={() => {
                setSearch("");
                setFilters({ page: 0 });
                void navigate({ search: {} });
              }}
            >
              Limpar
            </Button>
          </div>
        )}
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" />
        <Input
          aria-label="Buscar por nome"
          value={search}
          maxLength={120}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilters((f) => ({ ...f, page: 0 }));
          }}
          placeholder="Buscar por nome…"
          className="exercise-search-input h-12 rounded-2xl bg-surface pl-10 text-lg"
        />
      </div>
      <CatalogControls filters={filters} onChange={setFilters} />
      <div className="mt-5" aria-busy={catalog.isFetching}>
        {catalog.isPending ? (
          <p role="status" className="py-8 text-center text-lg text-muted-foreground">
            Carregando biblioteca…
          </p>
        ) : catalog.isError ? (
          <div role="alert" className="rounded-2xl border border-border bg-surface p-5">
            <p>Não foi possível carregar a biblioteca.</p>
            <Button className="mt-3 h-11" onClick={() => void catalog.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-lg text-muted-foreground" role="status">
              {catalog.data.total} exercício{catalog.data.total === 1 ? "" : "s"} encontrado
              {catalog.data.total === 1 ? "" : "s"}
            </p>
            {!catalog.data.total ? (
              <div className="rounded-3xl border border-border bg-surface p-8 text-center">
                <Library className="mx-auto size-8 text-neon" />
                <h2 className="mt-3 text-2xl">Nenhum exercício encontrado</h2>
                <p className="text-lg text-muted-foreground">
                  Ajuste os filtros ou cadastre seu exercício.
                </p>
                <Button variant="outline" className="mt-4 h-11" onClick={create}>
                  Cadastrar exercício
                </Button>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.data.items.map((ex) => (
                  <li key={ex.id} className="rounded-2xl border border-border bg-surface p-3">
                    <div className="flex gap-3">
                      <ExerciseMedia
                        url={ex.gif_url}
                        name={ex.nome}
                        muscle={ex.musculo_principal}
                        className="size-20 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl leading-tight">{ex.nome}</h2>
                        <p className="mt-1 text-base text-muted-foreground">
                          {muscleLabel(ex.musculo_principal)}
                        </p>
                        <p className="text-base text-muted-foreground">
                          {ex.equipamentos.join(", ") || "Equipamento não informado"}
                        </p>
                      </div>
                    </div>
                    <div className="my-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="border-0 bg-neon/15 text-sm text-neon">
                        {ex.source === "user"
                          ? ex.visibility === "public"
                            ? "Comunidade"
                            : "Só eu"
                          : "Oficial · " + (ex.source === "exercisedb" ? "ExerciseDB" : "eForge")}
                      </Badge>
                      {!ex.classification_reviewed && (
                        <Badge variant="outline" className="text-sm">
                          Categoria a revisar
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        onClick={() => setDetail(ex)}
                      >
                        Detalhes
                      </Button>
                      <Button
                        className="h-11 flex-1"
                        aria-label={`Adicionar ${ex.nome} ao treino`}
                        onClick={() => setAdd(ex)}
                      >
                        Ao treino
                        <Plus size={16} />
                      </Button>
                    </div>
                    {((ex.source === "user" && ex.user_id === user?.id) ||
                      (admin.data && ex.source !== "user")) && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="ghost"
                          className="h-11 text-muted-foreground"
                          aria-label={`Editar ${ex.nome}`}
                          onClick={() => {
                            setEditing(ex);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                          Editar
                        </Button>
                        {ex.source === "user" && (
                          <Button
                            variant="ghost"
                            className="h-11 text-destructive"
                            aria-label={`Excluir ${ex.nome}`}
                            onClick={() => setToDelete(ex)}
                          >
                            <Trash2 size={16} />
                            Excluir
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <CatalogPagination
              page={filters.page ?? 0}
              total={catalog.data.total}
              onChange={(page) => {
                setFilters((f) => ({ ...f, page }));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
      <p className="mt-7 text-base text-muted-foreground">
        Catálogo ExerciseDB e mídias por{" "}
        <a
          href="https://ascendapi.com"
          target="_blank"
          rel="noreferrer"
          className="text-neon underline"
        >
          AscendAPI
        </a>
        . Instruções originais podem estar em inglês.
      </p>
      <ExerciseDetails
        exercise={detail}
        onClose={() => setDetail(null)}
        onAdd={(ex) => {
          setDetail(null);
          setAdd(ex);
        }}
      />
      <AddToWorkoutDialog exercise={add} onClose={() => setAdd(null)} />
      <ExerciseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        userId={user?.id ?? null}
        isAdmin={!!admin.data}
      />
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exercício?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.nome} será removido. Os registros de séries concluídas são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteMutation.mutate(toDelete);
                setToDelete(null);
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
