import { Brand } from "@/components/Brand";
import { Link } from "@tanstack/react-router";
import { Zap, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  back = "/welcome",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: "/welcome" | "/login";
}) {
  return (
    <main className="relative min-h-dvh">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[500px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, oklch(0.76 0.19 300 / 0.18), transparent)" }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-8 pb-10">
        <div className="flex items-center justify-between">
          <Link to={back} className="grid size-10 place-items-center rounded-full hairline surface">
            <ChevronLeft className="size-5" />
          </Link>
          <Brand />
          <div className="size-10" />
        </div>

        <div className="mt-12 animate-fade-up">
          <h1 className="text-4xl font-black leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="mt-8 flex-1">{children}</div>
      </div>
    </main>
  );
}

export function NeonInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...rest}
        className="w-full rounded-2xl border border-border surface px-4 py-3.5 text-base font-medium outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-neon focus:ring-2 focus:ring-neon/30"
      />
    </label>
  );
}

export function NeonButton({ children, loading, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className="w-full rounded-full bg-neon py-4 text-base font-bold text-primary-foreground glow-neon transition-all active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? "Carregando..." : children}
    </button>
  );
}
