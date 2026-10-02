import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadOwnedModule } from "./lib/owned-modules.mjs";
const args = process.argv.slice(2),
  option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
if (args.includes("--help") || !option("--manifest") || !option("--folder")) {
  console.log(
    "npm run catalog:import -- --manifest catalog/manifest_gifs_categorizados.csv --folder CAMINHO_DOS_GIFS [--category peitoral] [--dry-run] [--activate] [--report resultado.json]",
  );
  process.exit(args.includes("--help") ? 0 : 1);
}
let result;
const report = option("--report") || "catalog-import-report.json";
try {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    /* Explicit public environment variables also work. */
  }
  const core = await loadOwnedModule("owned-gif-manifest"),
    { importGifLibrary } = await loadOwnedModule("owned-gif-import"),
    { ownedGifAdapter } = await loadOwnedModule("owned-gif-supabase");
  const manifest = core.parseGifManifest(await fs.readFile(option("--manifest"), "utf8")),
    category = option("--category"),
    folder = path.resolve(option("--folder"));
  if (category && !Object.hasOwn(core.LIBRARY_CATEGORIES, category))
    throw new Error("Categoria inválida");
  const entries = manifest.entries.filter((e) => !category || e.category === category);
  const fileSource = async function* (requested, signal, failure) {
    for (const entry of requested) {
      if (signal.aborted) return;
      try {
        yield {
          path: entry.path,
          bytes: new Uint8Array(await fs.readFile(path.join(folder, entry.path))),
        };
      } catch (e) {
        failure(entry.path, e.message);
      }
    }
  };
  if (args.includes("--dry-run")) {
    const errors = manifest.errors.map((message) => ({ path: "manifesto", message }));
    let verified = 0;
    for await (const file of fileSource(entries, new AbortController().signal, (path, message) =>
      errors.push({ path, message }),
    )) {
      try {
        await core.verifyGifBytes(
          entries.find((e) => e.path === file.path),
          file.bytes,
        );
        verified++;
      } catch (e) {
        errors.push({ path: file.path, message: e.message });
      }
    }
    result = { dryRun: true, total: entries.length, verified, errors };
  } else {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
      token = process.env.EFORGE_ADMIN_ACCESS_TOKEN;
    if (!url || !key || !token)
      throw new Error(
        "Defina a URL/chave pública do Supabase e EFORGE_ADMIN_ACCESS_TOKEN com uma sessão administrativa válida. Você também pode importar pelo painel, sem copiar tokens.",
      );
    let role;
    try {
      role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role;
    } catch {}
    if (key.startsWith("sb_secret_") || role === "service_role")
      throw new Error("Use somente a chave pública; service role não é aceita por este importador");
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error: authError } = await client.auth.getUser(token);
    if (authError || !user.user) throw new Error("Sessão inválida ou expirada");
    const { data: admin, error: roleError } = await client.rpc("is_catalog_admin");
    if (roleError || !admin) throw new Error("A conta precisa ter papel admin");
    const controller = new AbortController();
    process.once("SIGINT", () => controller.abort());
    let previous = -1;
    result = await importGifLibrary(
      entries,
      fileSource,
      ownedGifAdapter(client),
      controller.signal,
      (r) => {
        if (r.processed !== previous) {
          console.log(
            `${r.processed}/${r.total}: ${r.created} novos, ${r.existing} existentes, ${r.errors.length} erros`,
          );
          previous = r.processed;
        }
      },
    );
    if (args.includes("--activate")) {
      if (manifest.errors.length || result.errors.length || result.paused)
        throw new Error("Corrija os erros e termine a importação antes de ativar");
      const { error } = await client.rpc("activate_owned_gif_library", {
        p_hashes: manifest.entries.map((e) => e.sha256),
      });
      if (error) throw new Error(error.message);
    }
    const { data, error } = await client.rpc("owned_catalog_report", {
      p_hashes: manifest.entries.map((e) => e.sha256),
      p_include_reviews: true,
    });
    if (error) throw new Error(error.message);
    result = { ...result, database: data, manifestErrors: manifest.errors };
  }
  await fs.writeFile(report, JSON.stringify(result, null, 2) + "\n");
  console.log(`Relatório salvo em ${report}.`);
  if (result.errors?.length || manifest.errors.length) process.exitCode = 1;
} catch (e) {
  const message = e instanceof Error ? e.message : "Importação falhou";
  console.error(message);
  if (result) {
    await fs.writeFile(report, JSON.stringify({ ...result, fatalError: message }, null, 2) + "\n");
    console.log(
      `O progresso anterior à falha foi salvo em ${report}. Repita a importação para retomar.`,
    );
  }
  process.exitCode = 1;
}
