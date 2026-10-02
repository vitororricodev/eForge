import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCatalogAdmin } from "@/hooks/use-exercise-catalog";
import { OwnedGifImportPanel } from "@/components/exercises/OwnedGifImportPanel";
import { CatalogManager } from "@/components/exercises/CatalogManager";
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
      <nav aria-label="Administração da biblioteca" className="flex gap-3">
        <a
          href="#manager-title"
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface p-3 text-center text-xl text-neon"
        >
          Gerenciar
        </a>
        <a
          href="#gif-import"
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface p-3 text-center text-xl text-neon"
        >
          Importar GIFs
        </a>
      </nav>
      <CatalogManager userId={user!.id} />
      <OwnedGifImportPanel userId={user!.id} />
    </main>
  );
}
