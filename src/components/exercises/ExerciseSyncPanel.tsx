import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { SyncResult } from "@/lib/exercise-types";
const runSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["running", "completed", "failed"]),
  received: z.number(),
  new_count: z.number(),
  updated_count: z.number(),
  ignored_count: z.number(),
  error_count: z.number(),
  total: z.number().nullable(),
  cursor: z.string().nullable(),
  has_next: z.boolean(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  last_error: z.string().nullable(),
  errors: z.array(z.object({ external_id: z.string().optional(), message: z.string() })),
});
async function invoke(action: "start" | "step" | "cancel", runId?: string) {
  const { data, error } = await supabase.functions.invoke("sync-exercisedb", {
    body: { action, runId },
  });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const value: unknown = await error.context.json().catch(() => null);
      if (value && typeof value === "object" && "error" in value && typeof value.error === "string")
        throw new Error(value.error);
    }
    throw new Error(
      "Não foi possível acessar a sincronização. Confira a configuração e tente novamente.",
    );
  }
  return action === "cancel" ? null : runSchema.parse(data);
}
export function ExerciseSyncPanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");
  const active = useRef(true);
  const proceed = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      proceed.current = false;
    };
  }, []);
  const history = useQuery({
    queryKey: ["exercises", "sync-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_sync_runs")
        .select(
          "id,status,received,new_count,updated_count,ignored_count,error_count,total,cursor,has_next,started_at,finished_at,last_error,errors",
        )
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return z.array(runSchema).parse(data);
    },
  });
  const latest = current ?? history.data?.[0];
  async function synchronize() {
    proceed.current = true;
    setRunning(true);
    setError("");
    try {
      let run = await invoke("start");
      if (!run) return;
      if (active.current) setCurrent(run);
      while (proceed.current && active.current && run.status === "running") {
        run = await invoke("step", run.id);
        if (!run) break;
        if (active.current) setCurrent(run);
        if (run.status === "running") await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await qc.invalidateQueries({ queryKey: ["exercises"] });
    } catch (error) {
      if (active.current)
        setError(error instanceof Error ? error.message : "Falha na sincronização");
    } finally {
      if (active.current) setRunning(false);
      proceed.current = false;
    }
  }
  async function cancel() {
    if (!latest) return;
    setError("");
    try {
      await invoke("cancel", latest.id);
      setCurrent(null);
      await history.refetch();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível cancelar");
    }
  }
  return (
    <section
      className="rounded-2xl border border-border bg-surface p-4"
      aria-labelledby="sync-title"
    >
      <h2 id="sync-title" className="text-2xl">
        Importação ExerciseDB
      </h2>
      <p className="mt-1 text-lg text-muted-foreground">
        O catálogo fica salvo no eForge. Você pode pausar e retomar de onde parou.
      </p>
      <div className="my-4 flex flex-wrap gap-2">
        <Button className="h-12" disabled={running} onClick={() => void synchronize()}>
          {running
            ? "Sincronizando…"
            : latest?.status === "running"
              ? "Retomar sincronização"
              : "Sincronizar catálogo"}
        </Button>
        {running && (
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              proceed.current = false;
            }}
          >
            Pausar após esta página
          </Button>
        )}
        {!running && latest?.status === "running" && (
          <Button variant="ghost" className="h-12" onClick={() => void cancel()}>
            Encerrar importação
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-lg text-destructive">
          {error}
        </p>
      )}
      {history.isError && (
        <p role="alert">
          Histórico indisponível.{" "}
          <Button variant="ghost" onClick={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {latest && (
        <div aria-live="polite">
          <p className="text-lg">
            {latest.status === "completed"
              ? "Sincronização concluída"
              : latest.status === "failed"
                ? "Importação encerrada"
                : running
                  ? "Importação em andamento"
                  : "Importação pausada"}{" "}
            · {new Date(latest.started_at).toLocaleString("pt-BR")}
          </p>
          <div className="my-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ["Recebidos", latest.received],
              ["Novos", latest.new_count],
              ["Atualizados", latest.updated_count],
              ["Ignorados", latest.ignored_count],
              ["Erros", latest.error_count],
            ].map(([label, value]) => (
              <div className="rounded-xl bg-background p-3" key={label}>
                <strong className="block text-2xl text-neon">{value}</strong>
                <span className="text-base text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          {latest.total !== null && (
            <p className="text-muted-foreground">
              {latest.received} de {latest.total} registros recebidos.
            </p>
          )}
          {latest.last_error && <p role="status">{latest.last_error}</p>}
          {!!latest.errors.length && (
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer">
                Registros com erro ({latest.error_count})
              </summary>
              <ul className="space-y-2 text-muted-foreground">
                {latest.errors.map((item, i) => (
                  <li key={i}>
                    {item.external_id ? `${item.external_id}: ` : ""}
                    {item.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {!!history.data?.length && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer">Últimas sincronizações</summary>
          <ul className="space-y-2">
            {history.data.map((run) => (
              <li key={run.id} className="text-muted-foreground">
                {new Date(run.started_at).toLocaleString("pt-BR")} · {run.received} recebidos ·{" "}
                {run.status === "completed"
                  ? "Concluída"
                  : run.status === "failed"
                    ? "Encerrada"
                    : "Pausada/em andamento"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
