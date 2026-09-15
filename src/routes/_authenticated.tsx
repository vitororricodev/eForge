import { Brand } from "@/components/Brand";
import { Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MobileApp } from "@/components/MobileApp";
import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, User, Library, Heart, BarChart3, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/welcome" });
  },
  component: AuthLayout,
});

const items = [
 { to: "/dashboard", label: "Início", icon: Home },
 { to: "/workouts", label: "Treinos", icon: Dumbbell },
 { to: "/exercises", label: "Exercícios", icon: Library },
 { to: "/reports", label: "Evolução", icon: BarChart3 },
 { to: "/profile", label: "Perfil", icon: User },
] as const;

function AuthLayout() {
  const loc = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Carregando…</p>;
  if (!user) return <Link to="/login">Entrar na sua conta</Link>;
  if (loc.pathname.startsWith("/run/")) return <div key={user.id}><Outlet /></div>;
  return (
    <div className="min-h-dvh pb-24">
      <header className="eforge-app-header"><Link to="/dashboard"><Brand /></Link><Link to="/achievements" aria-label="Conquistas"><Trophy size={20}/></Link></header><MobileApp /><div key={user.id}><Outlet /></div>
      <nav aria-label="Navegação principal" className="eforge-nav fixed inset-x-0 bottom-0 z-50" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="eforge-nav-inner">{items.map(it=>{const active=loc.pathname.startsWith(it.to)||(it.to==="/reports"&&["/goals","/achievements","/cardio","/body-profile","/muscle-map"].includes(loc.pathname));const Icon=it.icon;return <Link key={it.to} to={it.to} aria-current={active?"page":undefined}><Icon size={21} strokeWidth={active?2.2:1.6}/><span>{it.label}</span></Link>})}</div>
      </nav>
    </div>
  );
}
