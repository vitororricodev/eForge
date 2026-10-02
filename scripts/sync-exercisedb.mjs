// Administrative CLI: uses the same protected Edge Function as the UI, never a service-role key.
const url = process.env.SUPABASE_URL;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const token = process.env.EFORGE_ADMIN_ACCESS_TOKEN;
if (!url || !publishable || !token)
  throw new Error(
    "Defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e EFORGE_ADMIN_ACCESS_TOKEN (sessão de administrador).",
  );
const endpoint = new URL("/functions/v1/sync-exercisedb", url);
if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname))
  throw new Error("Use HTTPS ou o Supabase local.");
const pageLimit = Number(process.env.EFORGE_SYNC_MAX_PAGES ?? 1000);
if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 1000)
  throw new Error("EFORGE_SYNC_MAX_PAGES deve estar entre 1 e 1000.");
async function invoke(action, runId) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, runId }),
    signal: AbortSignal.timeout(110_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(typeof data.error === "string" ? data.error : `Falha HTTP ${response.status}`);
  return data;
}
let run = await invoke("start");
for (let page = 0; page < pageLimit && run.status === "running"; page++) {
  run = await invoke("step", run.id);
  console.log(
    JSON.stringify({
      id: run.id,
      status: run.status,
      recebidos: run.received,
      novos: run.new_count,
      atualizados: run.updated_count,
      ignorados: run.ignored_count,
      erros: run.error_count,
    }),
  );
  if (run.status === "running") await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log(
  run.status === "completed"
    ? "Sincronização concluída."
    : "Sincronização pausada. Execute novamente para retomar.",
);
