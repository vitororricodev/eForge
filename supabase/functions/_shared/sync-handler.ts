import {
  fetchExercisePage,
  normalizeExercise,
  parseExercise,
  type MuscleMapping,
  type SyncResult,
} from "./exercisedb.ts";

export type SyncLease = SyncResult & { lease_token: string | null };
export interface SyncRepository {
  begin(actor: string): Promise<SyncLease>;
  claim(runId: string): Promise<SyncLease>;
  mappings(): Promise<MuscleMapping[]>;
  apply(input: {
    run: SyncLease;
    records: ReturnType<typeof normalizeExercise>[];
    errors: SyncResult["errors"];
    total: number;
    received: number;
    nextCursor: string | null;
    hasNext: boolean;
  }): Promise<SyncLease>;
  release(runId: string, token: string, message: string): Promise<void>;
  cancel(runId: string): Promise<void>;
}
export function createSyncHandler(deps: {
  authenticate(token: string): Promise<{ id: string; isAdmin: boolean } | null>;
  repository: SyncRepository;
  usageAllowed: boolean;
  pageFetcher?: typeof fetchExercisePage;
}) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const response = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return response({ error: "Método não permitido" }, 405);
    const bearer = request.headers.get("Authorization");
    if (!bearer?.startsWith("Bearer ")) return response({ error: "Entre na sua conta" }, 401);
    let lease: SyncLease | null = null;
    try {
      const identity = await deps.authenticate(bearer.slice(7));
      if (!identity) return response({ error: "Sessão inválida" }, 401);
      if (!identity.isAdmin) return response({ error: "Permissão administrativa necessária" }, 403);
      const raw = await request.text();
      if (raw.length > 4096) return response({ error: "Requisição inválida" }, 400);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return response({ error: "JSON inválido" }, 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("action" in body) ||
        !["start", "step", "cancel"].includes(String(body.action))
      )
        return response({ error: "Ação inválida" }, 400);
      const action = String(body.action);
      const runId = "runId" in body && typeof body.runId === "string" ? body.runId : "";
      if (
        action !== "start" &&
        !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(runId)
      )
        return response({ error: "Sincronização inválida" }, 400);
      if (action === "cancel") {
        await deps.repository.cancel(runId);
        return response({ cancelled: true });
      }
      if (!deps.usageAllowed)
        return response(
          {
            error:
              "Configure EXERCISEDB_USAGE_MODE=non-commercial somente se o projeto atender aos termos da API gratuita.",
          },
          409,
        );
      if (action === "start") return response(publicRun(await deps.repository.begin(identity.id)));
      lease = await deps.repository.claim(runId);
      if (lease.status !== "running") return response(publicRun(lease));
      const mappings = await deps.repository.mappings();
      const page = await (deps.pageFetcher ?? fetchExercisePage)(lease.cursor);
      const records: ReturnType<typeof normalizeExercise>[] = [];
      const errors: SyncResult["errors"] = [];
      for (const value of page.values) {
        try {
          records.push(normalizeExercise(parseExercise(value), mappings));
        } catch (error) {
          errors.push({
            message: error instanceof Error ? error.message.slice(0, 200) : "Registro inválido",
          });
        }
      }
      const result = await deps.repository.apply({
        run: lease,
        records,
        errors,
        total: page.total,
        received: page.values.length,
        nextCursor: page.nextCursor,
        hasNext: page.hasNextPage,
      });
      return response(publicRun(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safe =
        message.startsWith("ExerciseDB") ||
        message.startsWith("Falha ao consultar") ||
        message.startsWith("Limite da ExerciseDB") ||
        message === "Página sem cursor de continuação" ||
        message === "Resposta inválida da ExerciseDB"
          ? message
          : "Não foi possível processar esta página. Aguarde e retome a sincronização.";
      if (lease?.lease_token)
        await deps.repository.release(lease.id, lease.lease_token, safe).catch(() => undefined);
      console.error("[exercisedb-sync]", { runId: lease?.id ?? null, message: safe });
      return response({ error: safe }, 502);
    }
  };
}
function publicRun(run: SyncResult): SyncResult {
  return {
    id: run.id,
    status: run.status,
    received: run.received,
    new_count: run.new_count,
    updated_count: run.updated_count,
    ignored_count: run.ignored_count,
    error_count: run.error_count,
    total: run.total,
    cursor: run.cursor,
    has_next: run.has_next,
    started_at: run.started_at,
    finished_at: run.finished_at,
    last_error: run.last_error,
    errors: run.errors,
  };
}
