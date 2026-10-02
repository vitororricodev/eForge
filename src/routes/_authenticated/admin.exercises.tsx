import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useCatalogAdmin,
  useDebouncedSearch,
  useExerciseCatalog,
} from "@/hooks/use-exercise-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExerciseSyncPanel } from "@/components/exercises/ExerciseSyncPanel";
import { MuscleMappingPanel } from "@/components/exercises/MuscleMappingPanel";
import { ExerciseFormDialog } from "@/components/exercises/ExerciseFormDialog";
import { CatalogPagination } from "@/components/exercises/CatalogControls";
import type { Exercise } from "@/lib/exercise-types";
export const Route = createFileRoute("/_authenticated/admin/exercises")({
  head: () => ({ meta: [{ title: "eForge — Administração de exercícios" }] }),
  component: AdminExercises,
});
function AdminExercises() {
  const { user } = useAuth();
  const admin = useCatalogAdmin();
  if (admin.isPending)
    return (
      <main className="p-6" role="status">
        Verificando acesso…
      </main>
    );
  if (!admin.data)
    return (
      <main className="p-6">
        <h1 className="text-3xl">Acesso administrativo necessário</h1>
        <p className="text-lg">Sua conta não pode gerenciar o catálogo oficial.</p>
        <Link to="/exercises" className="block min-h-11 text-neon">
          Voltar à biblioteca
        </Link>
      </main>
    );
  return <AdminCatalog userId={user!.id} />;
}
function AdminCatalog({ userId }: { userId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const query = useDebouncedSearch(search);
  const review = useExerciseCatalog({ review: true, query, page });
  return (
    <main className="exercise-admin-page mx-auto max-w-4xl space-y-5 px-4 pb-6 pt-6 sm:px-6">
      <header>
        <p className="flex items-center gap-2 text-neon">
          <ShieldCheck size={18} />
          Administração
        </p>
        <h1 className="text-4xl">Biblioteca oficial</h1>
        <Link to="/exercises" className="block min-h-11 content-center text-lg text-neon">
          Abrir biblioteca
        </Link>
      </header>
      <ExerciseSyncPanel />
      <MuscleMappingPanel />
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-2xl">Pendentes de revisão</h2>
        <p className="text-lg text-muted-foreground">
          Dados musculares sem correspondência ou classificação ainda não conferida.
        </p>
        <Input
          aria-label="Buscar exercícios pendentes"
          className="my-3 h-11"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por nome"
        />
        {review.isPending ? (
          <p role="status">Carregando…</p>
        ) : review.isError ? (
          <p role="alert">
            Não foi possível consultar as revisões.{" "}
            <Button onClick={() => void review.refetch()}>Tentar novamente</Button>
          </p>
        ) : (
          <>
            <p role="status" className="text-lg text-muted-foreground">
              {review.data.total} exercícios para conferir
            </p>
            <ul className="mt-3 space-y-3">
              {review.data.items.map((ex) => (
                <li key={ex.id} className="rounded-xl border border-border p-3">
                  <h3 className="text-xl">{ex.nome}</h3>
                  <p className="text-lg text-muted-foreground">
                    {ex.unmapped_muscles.length
                      ? `Sem correspondência: ${ex.unmapped_muscles.join(", ")}`
                      : ex.review_status === "pending"
                        ? "Selecione os músculos antes de aprovar."
                        : "Categoria e controle a conferir."}
                  </p>
                  <Button variant="outline" className="mt-2 h-11" onClick={() => setEditing(ex)}>
                    Revisar exercício
                  </Button>
                </li>
              ))}
            </ul>
            <CatalogPagination page={page} total={review.data.total} onChange={setPage} />
          </>
        )}
      </section>
      <p className="text-base text-muted-foreground">
        A API gratuita exige uso não comercial e atribuição à AscendAPI. Registros desconhecidos não
        são publicados automaticamente. Não há download de mídia para o Storage.
      </p>
      <ExerciseFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        editing={editing}
        userId={userId}
        isAdmin
      />
    </main>
  );
}
