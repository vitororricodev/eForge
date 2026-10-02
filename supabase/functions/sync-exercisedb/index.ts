import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database } from "../../../src/integrations/supabase/types.ts";
import type { MuscleMapping } from "../_shared/exercisedb.ts";
import { createSyncHandler, type SyncLease, type SyncRepository } from "../_shared/sync-handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient<Database>(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function result<T>(data: unknown, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Empty database response");
  return data as T; // RPC contract is enforced by the migration and database tests.
}
const repository: SyncRepository = {
  async begin(actor) {
    const { data, error } = await admin.rpc("begin_exercise_sync", { p_actor: actor });
    return result<SyncLease>(data, error);
  },
  async claim(runId) {
    const { data, error } = await admin.rpc("claim_exercise_sync_page", { p_run_id: runId });
    return result<SyncLease>(data, error);
  },
  async mappings() {
    const { data, error } = await admin
      .from("exercise_muscle_mappings")
      .select("source_name,muscle_keys,status");
    return result<MuscleMapping[]>(data, error);
  },
  async apply(input) {
    const { data, error } = await admin.rpc("apply_exercise_sync_page", {
      p_run_id: input.run.id,
      p_token: input.run.lease_token!,
      p_cursor: input.run.cursor,
      p_next_cursor: input.nextCursor,
      p_has_next: input.hasNext,
      p_total: input.total,
      p_received: input.received,
      p_records: input.records.map((record) => ({
        ...record,
        external_data: { ...record.external_data },
      })),
      p_errors: input.errors,
    });
    return result<SyncLease>(data, error);
  },
  async release(runId, token, message) {
    const { error } = await admin.rpc("release_exercise_sync_page", {
      p_run_id: runId,
      p_token: token,
      p_error: message,
    });
    if (error) throw error;
  },
  async cancel(runId) {
    const { error } = await admin.rpc("cancel_exercise_sync", { p_run_id: runId });
    if (error) throw error;
  },
};
Deno.serve(
  createSyncHandler({
    repository,
    usageAllowed: Deno.env.get("EXERCISEDB_USAGE_MODE") === "non-commercial",
    async authenticate(token) {
      const client = createClient<Database>(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      const role = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (role.error) throw new Error("Role lookup failed");
      return { id: data.user.id, isAdmin: !!role.data };
    },
  }),
);
