import "./catalog.css";
import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MUSCLES, muscleKeys } from "@/components/muscle-map/anatomy";
import { useCatalogFacets } from "@/hooks/use-exercise-catalog";
import { MUSCLE_GROUPS, type CatalogFilters } from "@/lib/exercise-types";

export function CatalogControls({
  filters,
  onChange,
  enabled = true,
}: {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  enabled?: boolean;
}) {
  const id = useId();
  const facets = useCatalogFacets(enabled);
  const change = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch, page: 0 });
  const options = (items: { value: string; label: string }[]) =>
    items.map((item) => (
      <option key={item.value} value={item.value}>
        {item.label}
      </option>
    ));
  const group = MUSCLE_GROUPS.find(
    (item) =>
      item.muscles.length === filters.muscles?.length &&
      item.muscles.every((m) => filters.muscles?.includes(m)),
  );
  const controls = [
    {
      key: "muscle",
      label: "Músculo",
      value: filters.muscles?.length === 1 ? filters.muscles[0] : "",
      change: (value: string) =>
        change({ muscles: value ? [value as (typeof muscleKeys)[number]] : [] }),
      items: muscleKeys.map((key) => ({ value: key, label: MUSCLES[key].label })),
    },
    {
      key: "group",
      label: "Grupo muscular",
      value: group?.value ?? "",
      change: (value: string) =>
        change({ muscles: MUSCLE_GROUPS.find((item) => item.value === value)?.muscles ?? [] }),
      items: MUSCLE_GROUPS,
    },
    {
      key: "equipment",
      label: "Equipamento",
      value: filters.equipment ?? "",
      change: (value: string) => change({ equipment: value }),
      items: (facets.data?.equipments ?? []).map((value) => ({ value, label: value })),
    },
    {
      key: "body",
      label: "Parte do corpo",
      value: filters.bodyPart ?? "",
      change: (value: string) => change({ bodyPart: value }),
      items: (facets.data?.bodyParts ?? []).map((value) => ({ value, label: value })),
    },
    {
      key: "source",
      label: "Biblioteca",
      value: filters.source ?? "",
      change: (value: string) =>
        change({ source: value ? (value as CatalogFilters["source"]) : undefined }),
      items: [
        { value: "exercisedb", label: "ExerciseDB" },
        { value: "eforge", label: "eForge" },
        { value: "user", label: "Personalizados" },
      ],
    },
    {
      key: "category",
      label: "Categoria",
      value: filters.category ?? "",
      change: (value: string) => change({ category: value }),
      items: [
        { value: "musculacao", label: "Musculação" },
        { value: "cardio", label: "Cardio" },
        { value: "funcional", label: "Funcional" },
        { value: "alongamento", label: "Alongamento" },
      ],
    },
    {
      key: "control",
      label: "Controle",
      value: filters.control ?? "",
      change: (value: string) => change({ control: value }),
      items: [
        { value: "peso_kg", label: "Peso (kg)" },
        { value: "peso_corporal", label: "Peso corporal" },
        { value: "repeticoes", label: "Repetições" },
        { value: "segundos", label: "Segundos" },
        { value: "distancia", label: "Distância" },
      ],
    },
  ];
  return (
    <details className="mt-3 rounded-2xl border border-border bg-surface p-3">
      <summary className="min-h-11 cursor-pointer content-center text-lg">
        Filtrar exercícios
      </summary>
      <div className="grid grid-cols-2 gap-3 py-2">
        {controls.map((control) => (
          <div key={control.key} className="min-w-0">
            <label
              htmlFor={`${id}-${control.key}`}
              className="block text-base text-muted-foreground"
            >
              {control.label}
            </label>
            <select
              id={`${id}-${control.key}`}
              value={control.value}
              onChange={(e) => control.change(e.target.value)}
              className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-base focus-visible:outline-2 focus-visible:outline-neon"
            >
              <option value="">Todos</option>
              {options(control.items)}
            </select>
          </div>
        ))}
      </div>
      {facets.isError && (
        <p role="status" className="text-muted-foreground">
          Equipamentos indisponíveis.{" "}
          <button className="min-h-11 text-neon" onClick={() => void facets.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <Button
        variant="ghost"
        className="h-11"
        onClick={() => onChange({ query: filters.query, page: 0, review: filters.review })}
      >
        Limpar filtros
      </Button>
    </details>
  );
}
export function CatalogPagination({
  page,
  pageSize = 20,
  total,
  onChange,
}: {
  page: number;
  pageSize?: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label="Páginas da biblioteca"
      className="mt-5 flex items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        className="h-11"
        aria-label="Página anterior"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={18} />
      </Button>
      <span role="status" className="text-muted-foreground">
        Página {page + 1} de {pages}
      </span>
      <Button
        variant="outline"
        className="h-11"
        aria-label="Próxima página"
        disabled={page + 1 >= pages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={18} />
      </Button>
    </nav>
  );
}
