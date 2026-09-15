import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, User as UserIcon, Activity, ChevronRight } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "eForge — Perfil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  async function handleLogout() {
    await signOut();
    toast.success("Até a próxima!");
    nav({ to: "/welcome" });
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-12">
      <h1 className="text-3xl font-black">Perfil</h1>
      <div className="eforge-profile-card mt-6 hairline rounded-3xl surface p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-neon/15 ring-1 ring-neon/30">
            <span className="text-2xl font-bold text-neon">{(user?.user_metadata?.display_name ?? user?.email ?? "E").slice(0,2).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{user?.user_metadata?.display_name ?? user?.email?.split("@")[0]}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
      </div>

      <Link to="/body-profile"
        className="mt-6 flex w-full items-center justify-between rounded-3xl border border-border surface p-5 hover:border-neon/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-neon/15 ring-1 ring-neon/30">
            <Activity className="size-5 text-neon" />
          </div>
          <div>
            <p className="font-bold">Perfil Corporal</p>
            <p className="text-xs text-muted-foreground">Medidas, IMC e evolução</p>
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <button onClick={handleLogout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border surface py-3.5 font-semibold text-destructive hover:border-destructive/40">
        <LogOut className="size-4" /> Sair
      </button>

    </main>
  );
}
