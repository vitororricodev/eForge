import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDebouncedSearch, useExerciseCatalog } from "@/hooks/use-exercise-catalog";
import type { CatalogFilters, Exercise } from "@/lib/exercise-types";
import { CatalogControls, CatalogPagination } from "./CatalogControls";
import { ExerciseMedia } from "./ExerciseMedia";
import { muscleLabel } from "@/lib/exercise-labels";

export function ExercisePicker({
  onSelect,
  excludeIds = [],
  label = "Adicionar exercício",
}: {
  onSelect: (exercise: Exercise) => void;
  excludeIds?: string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({ page: 0 });
  const query = useDebouncedSearch(search);
  const catalog = useExerciseCatalog({ ...filters, query }, open);
  return (
    <>
      <Button variant="outline" className="h-11 w-full" onClick={() => setOpen(true)}>
        <Plus size={18} />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="exercise-dialog max-h-[90dvh] overflow-y-auto bg-surface sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar exercício</DialogTitle>
            <DialogDescription>Busque na biblioteca e escolha para seu treino.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
            <Input
              aria-label="Buscar exercício para o treino"
              placeholder="Buscar por nome"
              className="exercise-search-input h-11 pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters((f) => ({ ...f, page: 0 }));
              }}
            />
          </div>
          <CatalogControls filters={filters} onChange={setFilters} enabled={open} />
          {catalog.isPending ? (
            <p role="status">Carregando biblioteca…</p>
          ) : catalog.isError ? (
            <p role="alert">
              Não foi possível carregar.{" "}
              <button className="min-h-11 text-neon" onClick={() => void catalog.refetch()}>
                Tentar novamente
              </button>
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">{catalog.data.total} exercícios encontrados</p>
              <ul className="space-y-2">
                {catalog.data.items.map((ex) => (
                  <li key={ex.id}>
                    <button
                      disabled={excludeIds.includes(ex.id)}
                      className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-border p-3 text-left focus-visible:outline-2 focus-visible:outline-neon disabled:opacity-45"
                      onClick={() => {
                        onSelect(ex);
                        setOpen(false);
                      }}
                    >
                      <ExerciseMedia
                        url={ex.gif_url}
                        name={ex.nome}
                        muscle={ex.musculo_principal}
                        className="size-14 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block text-xl leading-tight">{ex.nome}</strong>
                        <span className="text-base text-muted-foreground">
                          {muscleLabel(ex.musculo_principal)}
                          {excludeIds.includes(ex.id) ? " · Já no treino" : ""}
                        </span>
                      </span>
                      <Plus className="size-5 shrink-0 text-neon" />
                    </button>
                  </li>
                ))}
              </ul>
              {!catalog.data.total && <p>Nenhum exercício encontrado. Ajuste os filtros.</p>}
              <CatalogPagination
                page={filters.page ?? 0}
                total={catalog.data.total}
                onChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
