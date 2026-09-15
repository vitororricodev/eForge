import { Brand } from "@/components/Brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Zap, Activity, Target } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "eForge — Bem-vindo" },
      { name: "description", content: "Entre no eForge e leve seu treino ao próximo nível." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--neon) 1px, transparent 1px), linear-gradient(90deg, var(--neon) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black, transparent 70%)",
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[600px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, oklch(0.76 0.19 300 / 0.25), transparent)" }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-16 pb-10">
        <Brand />

        <div className="flex-1 flex flex-col justify-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neon">eForge</p>
          <h1 className="mt-4 text-5xl font-black leading-[0.95]">
            Forjando a sua<br/>
            <span className="text-neon text-glow">melhor versão.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base text-muted-foreground">
            Acompanhe cargas, evolução corporal e mapeie cada músculo treinado em tempo real.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <Feature icon={<Activity className="size-4" />} label="Mapa muscular" />
            <Feature icon={<Target className="size-4" />} label="Metas inteligentes" />
            <Feature icon={<Zap className="size-4" />} label="Análise real-time" />
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/signup"
            className="flex items-center justify-center gap-2 rounded-full bg-neon py-4 text-base font-bold text-primary-foreground glow-neon transition-transform active:scale-[0.98]"
          >
            Começar agora <ArrowRight className="size-5" strokeWidth={2.5} />
          </Link>
          <Link
            to="/login"
            className="block rounded-full border border-border surface py-4 text-center text-base font-semibold transition-colors hover:border-neon/40"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="hairline rounded-2xl surface px-3 py-3 text-center">
      <div className="mx-auto grid size-8 place-items-center rounded-lg bg-neon/10 text-neon">{icon}</div>
      <div className="mt-2 text-[11px] font-semibold leading-tight">{label}</div>
    </div>
  );
}
