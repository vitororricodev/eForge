// LOCAL integration/visual test. All Supabase and external requests are intercepted.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { loadOwnedModule } from "../scripts/lib/owned-modules.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"))
  : await import("playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = process.env.TEST_SCREENSHOTS ?? "validation/owned-library";
fs.mkdirSync(output, { recursive: true });
const env = fs.readFileSync(".env", "utf8");
const supabaseURL = env.match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
assert(supabaseURL);
const uid = "00000000-0000-4000-8000-000000000001",
  wid = "00000000-0000-4000-8000-000000000002";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "local-test@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const session = {
  access_token: "local-test-only",
  refresh_token: "local-test-only",
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user,
};
const storageKey = `sb-${new URL(supabaseURL).hostname.split(".")[0]}-auth-token`;
const items = Array.from({ length: 25 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`,
  user_id: i === 1 ? uid : null,
  nome:
    i === 0
      ? "Supino com barra"
      : i === 1
        ? "Supino personalizado"
        : i === 2
          ? "Rosca com halteres"
          : `Exercício do catálogo ${String(i).padStart(2, "0")}`,
  gif_url: i === 0 ? null : null,
  tipo_controle: "repeticoes",
  categoria: "funcional",
  musculo_principal: i === 2 ? "biceps" : "chest",
  musculos_primarios: [i === 2 ? "biceps" : "chest"],
  musculos_secundarios: i === 2 ? ["forearms"] : ["shoulders", "triceps"],
  musculos_terciarios: [],
  source: i === 1 ? "user" : "eforge",
  external_id: null,
  visibility: i === 1 ? "private" : "public",
  name_original: i === 0 ? "Supino com barra" : null,
  name_pt_br: null,
  slug: "exercise-" + i,
  descricao: null,
  equipamentos: i === 2 ? ["dumbbell"] : ["barbell"],
  partes_corpo: i === 2 ? ["biceps"] : ["peitoral"],
  instrucoes: ["Position on the bench.", "Press with control."],
  instrucoes_pt_br: [],
  dificuldade: null,
  active: true,
  review_status: "approved",
  classification_reviewed: i === 1,
  unmapped_muscles: [],
  observacoes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_synced_at: null,
}));
const core = await loadOwnedModule("owned-gif-manifest");
const manifest = core.parseGifManifest(
  fs.readFileSync("catalog/manifest_gifs_categorizados.csv", "utf8"),
);
assert(process.env.TEST_ASSET_ROOT, "Set TEST_ASSET_ROOT to the extracted categorized GIF folder");
const fixtureEntries = [
  manifest.entries.find((e) => e.category === "peitoral" && /supino/i.test(e.name)),
  manifest.entries.find((e) => e.category === "peitoral" && /crucifixo/i.test(e.name)),
  manifest.entries.find((e) => e.category === "biceps" && /rosca/i.test(e.name)),
];
assert(fixtureEntries.every(Boolean));
const fixtureJson = path.join(output, "import-fixture.json"),
  fixtureZip = path.join(output, "import-fixture.zip");
fs.writeFileSync(fixtureJson, JSON.stringify({ version: 1, entries: fixtureEntries }));
fs.writeFileSync(
  fixtureZip,
  zipSync(
    Object.fromEntries(
      fixtureEntries.map((e) => [
        e.path,
        fs.readFileSync(path.join(process.env.TEST_ASSET_ROOT, e.path)),
      ]),
    ),
  ),
);
const objects = new Map();
items.forEach((e, i) => {
  if (e.source !== "user") {
    e.gif_sha256 = String(i + 1000).padStart(64, "0");
    e.gif_path = `official/peitoral/peitoral/teste-${i}--${e.gif_sha256}.gif`;
    e.classification_confidence = "alta";
    e.musculo_principal_anatomico = e.musculo_principal === "biceps" ? "Bíceps" : "Peitoral";
    if (i === 0) {
      e.gif_url = supabaseURL + "/storage/v1/object/public/exercise-media/" + e.gif_path;
      objects.set(e.gif_path, { bytes: 100, mime: "image/gif" });
    }
  }
});
let libraryState = {
  legacy_disabled: false,
  activated_at: null,
  removed_count: 0,
  archived_count: 0,
};
function libraryReport(hashes = []) {
  const owned = items.filter((e) => e.source === "eforge"),
    valid = owned.filter((e) => !e.catalog_deleted_at && e.active && objects.has(e.gif_path));
  return {
    state: libraryState,
    imported: owned.length,
    storage_files: owned.filter((e) => objects.has(e.gif_path)).length,
    available: valid.length,
    legacy_remaining: libraryState.legacy_disabled ? 0 : 2,
    expected: hashes.length,
    missing: hashes.filter((h) => !valid.some((e) => e.gif_sha256 === h)),
    categories: {
      peitoral: owned.filter((e) => e.partes_corpo.includes("peitoral")).length,
      biceps: owned.filter((e) => e.partes_corpo.includes("biceps")).length,
    },
    primaries: { chest: 23, biceps: 1 },
    confidence: { alta: owned.length },
    reviews: [],
  };
}
let admin = false,
  errorMode = false,
  missingMedia = false;
let snapshot = null,
  added = null;
let calls = [];
let launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.TEST_CHROMIUM_MODULE) {
  const { default: c } = await import(process.env.TEST_CHROMIUM_MODULE);
  launch = { ...launch, executablePath: await c.executablePath(), args: c.args };
}
const browser = await chromium.launch(launch);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
await context.addInitScript(
  ({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)),
  { storageKey, session },
);
await context.route("**/*", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
  assert(
    !/exercisedb|ascendapi|translation/.test(url.hostname),
    "no external catalog or translation request",
  );
  if (
    url.pathname.includes("/storage/v1/object/public/exercise-media/") &&
    process.env.TEST_EXERCISE_GIF &&
    !missingMedia
  )
    return route.fulfill({
      contentType: "image/gif",
      body: fs.readFileSync(process.env.TEST_EXERCISE_GIF),
    });
  if (process.env.TEST_TEKO_FONT && url.hostname === "fonts.googleapis.com")
    return route.fulfill({
      contentType: "text/css",
      body: "@font-face{font-family:'Teko';font-style:normal;font-weight:700;font-display:swap;src:url(https://fonts.gstatic.com/eforge-test.ttf) format('truetype')}",
    });
  if (process.env.TEST_TEKO_FONT && url.hostname === "fonts.gstatic.com")
    return route.fulfill({
      contentType: "font/ttf",
      body: fs.readFileSync(process.env.TEST_TEKO_FONT),
    });
  if (url.origin !== new URL(supabaseURL).origin) return route.abort();
  if (url.pathname.includes("/storage/v1/object/exercise-media/") && req.method() === "POST") {
    const assetPath = decodeURIComponent(url.pathname.split("/exercise-media/")[1]);
    const entry = fixtureEntries.find((e) => core.gifStoragePath(e) === assetPath);
    assert(entry, "unexpected upload");
    objects.set(assetPath, { bytes: entry.bytes, mime: "image/gif" });
    calls.push({ path: url.pathname, body: { assetPath } });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        Key: "exercise-media/" + assetPath,
        Id: "00000000-0000-4000-8000-000000000777",
      }),
    });
  }
  assert(!url.pathname.includes("/functions/v1/"), "catalog must use no Edge Function");
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  calls.push({ path: url.pathname, body });
  let value = [];
  if (url.pathname.includes("/auth/v1/user")) value = user;
  else if (url.pathname.endsWith("/rpc/search_exercises_v2")) {
    if (errorMode)
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Local test failure" }),
      });
    let filtered = items.filter(
      (ex) =>
        !ex.catalog_deleted_at &&
        (!body.p_query || ex.nome.toLowerCase().includes(body.p_query.toLowerCase())) &&
        (!body.p_muscles?.length ||
          [ex.musculo_principal, ...ex.musculos_secundarios].some((m) =>
            body.p_muscles.includes(m),
          )) &&
        (!body.p_equipment || ex.equipamentos.includes(body.p_equipment)) &&
        (!body.p_source || ex.source === body.p_source) &&
        (!body.p_body_part || ex.partes_corpo.includes(body.p_body_part)) &&
        (!body.p_primary || ex.musculos_primarios.includes(body.p_primary)) &&
        (!body.p_secondary || ex.musculos_secundarios.includes(body.p_secondary)) &&
        (!body.p_visibility || ex.visibility === body.p_visibility),
    );
    if (body.p_review) filtered = filtered.filter((ex) => !ex.classification_reviewed);
    const size = body.p_page_size ?? 20;
    value = {
      items: filtered.slice((body.p_page ?? 0) * size, ((body.p_page ?? 0) + 1) * size),
      total: filtered.length,
    };
  } else if (url.pathname.endsWith("/rpc/admin_owned_catalog_page")) {
    let filtered = items.filter(
      (ex) =>
        ex.source !== "user" &&
        (body.p_status === "deleted" ? !!ex.catalog_deleted_at : !ex.catalog_deleted_at),
    );
    if (body.p_query)
      filtered = filtered.filter((ex) =>
        ex.nome.toLowerCase().includes(body.p_query.toLowerCase()),
      );
    if (body.p_body_part)
      filtered = filtered.filter((ex) => ex.partes_corpo.includes(body.p_body_part));
    if (body.p_source) filtered = filtered.filter((e) => e.source === body.p_source);
    if (body.p_primary)
      filtered = filtered.filter((e) => e.musculos_primarios.includes(body.p_primary));
    if (body.p_secondary)
      filtered = filtered.filter((e) => e.musculos_secundarios.includes(body.p_secondary));
    if (body.p_equipment)
      filtered = filtered.filter((e) => e.equipamentos.includes(body.p_equipment));
    if (body.p_visibility) filtered = filtered.filter((e) => e.visibility === body.p_visibility);
    if (body.p_status === "pending")
      filtered = filtered.filter((ex) => !ex.classification_reviewed);
    value = {
      items: body.p_ids_only
        ? []
        : filtered.slice((body.p_page ?? 0) * 20, ((body.p_page ?? 0) + 1) * 20),
      matching_ids: body.p_ids_only
        ? filtered.filter((e) => !e.catalog_deleted_at).map((e) => e.id)
        : [],
      total: filtered.length,
      catalog_total: items.filter((ex) => ex.source !== "user" && !ex.catalog_deleted_at).length,
    };
  } else if (url.pathname.endsWith("/rpc/delete_catalog_exercises")) {
    value = 0;
    for (const ex of items)
      if (
        ex.source !== "user" &&
        !ex.catalog_deleted_at &&
        (body.p_all || body.p_ids.includes(ex.id))
      ) {
        ex.catalog_deleted_at = new Date().toISOString();
        ex.active = false;
        value++;
      }
  } else if (url.pathname.endsWith("/rpc/restore_catalog_exercise")) {
    const ex = items.find((ex) => ex.id === body.p_id);
    ex.catalog_deleted_at = null;
    ex.active = true;
    value = null;
  } else if (url.pathname.endsWith("/rpc/exercise_catalog_facets"))
    value = { equipments: ["barbell", "dumbbell"], bodyParts: ["peitoral", "biceps"] };
  else if (url.pathname.endsWith("/rpc/add_exercise_to_workout")) {
    added = body;
    value = "00000000-0000-4000-8000-000000000009";
  } else if (url.pathname.endsWith("/rpc/save_workout_snapshot")) {
    snapshot = body.payload;
    value = null;
  } else if (url.pathname.endsWith("/rpc/inspect_owned_gif_assets")) {
    value = body.p_entries.map((e) => {
      const existing = items.find((i) => i.gif_sha256 === e.sha256),
        assetPath = existing?.gif_path || e.path,
        o = objects.get(assetPath);
      return {
        sha256: e.sha256,
        id: existing?.id ?? null,
        path: assetPath,
        deleted: !!existing?.catalog_deleted_at,
        asset_exists: !!o,
        bytes: o?.bytes ?? null,
        mime: o?.mime ?? null,
      };
    });
  } else if (url.pathname.endsWith("/rpc/import_owned_gif")) {
    const e = body.p_entry;
    const existing = items.find((i) => i.gif_sha256 === e.sha256);
    if (existing)
      value = { id: existing.id, status: "existing", deleted: !!existing.catalog_deleted_at };
    else {
      const record = {
        ...items[0],
        id: `00000000-0000-4000-8000-${String(500 + items.length).padStart(12, "0")}`,
        nome: e.name,
        name_original: e.name,
        name_pt_br: e.name,
        gif_path: core.gifStoragePath(e),
        gif_sha256: e.sha256,
        gif_url: body.p_gif_url,
        partes_corpo: [e.category],
        partes_corpo_pt_br: [core.LIBRARY_CATEGORIES[e.category]],
        musculo_principal: e.primary,
        musculos_primarios: e.primary ? [e.primary] : [],
        musculos_secundarios: e.secondary,
        musculos_terciarios: [],
        unmapped_muscles: e.unmapped,
        musculo_principal_anatomico: e.primaryAnatomy,
        classification_confidence: e.confidence,
        classification_reviewed: false,
        observacoes: e.notes,
        catalog_deleted_at: null,
        active: true,
      };
      items.push(record);
      value = { id: record.id, status: "created", deleted: false };
    }
  } else if (url.pathname.endsWith("/rpc/owned_catalog_report"))
    value = libraryReport(body.p_hashes);
  else if (url.pathname.endsWith("/rpc/activate_owned_gif_library")) {
    assert.equal(libraryReport(body.p_hashes).missing.length, 0);
    libraryState = {
      legacy_disabled: true,
      activated_at: new Date().toISOString(),
      removed_count: 1,
      archived_count: 1,
    };
    value = libraryReport(body.p_hashes);
  } else if (url.pathname.endsWith("/rpc/set_owned_exercise_active")) {
    items.find((e) => e.id === body.p_id).active = body.p_active;
    value = null;
  } else if (url.pathname.endsWith("/owned_catalog_state"))
    value = { legacy_disabled: libraryState.legacy_disabled };
  else if (url.pathname.endsWith("/user_roles")) value = admin ? { role: "admin" } : null;
  else if (url.pathname.endsWith("/profiles")) value = { sex: "masculino" };
  else if (url.pathname.endsWith("/exercises")) {
    if (req.method() === "GET" && url.searchParams.get("select") === "external_data")
      value = {
        external_data: {
          name: "Supino com barra",
          targetMuscles: ["pectorals"],
          secondaryMuscles: ["deltoids", "triceps"],
          instructions: ["Position on the bench.", "Press with control."],
        },
      };
    else if (req.method() === "POST") {
      items.push({ ...items[1], ...body, id: "00000000-0000-4000-8000-000000000199" });
      value = null;
    } else if (req.method() === "PATCH") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      Object.assign(
        items.find((e) => e.id === id),
        body,
      );
      value = null;
    } else value = items;
  } else if (url.pathname.endsWith("/workouts"))
    value =
      url.searchParams.get("select") === "nome"
        ? { nome: "Treino de peito" }
        : [
            {
              id: wid,
              nome: "Treino de peito",
              descricao: null,
              created_at: new Date().toISOString(),
            },
          ];
  else if (url.pathname.endsWith("/workout_exercises"))
    value = url.searchParams.get("select")?.includes("exercises(")
      ? [
          {
            id: "we",
            exercise_id: items[0].id,
            series: 1,
            repeticoes: 10,
            carga_kg: 10,
            descanso_seg: 60,
            ordem: 0,
            user_id: uid,
            exercises: items[0],
          },
        ]
      : [{ id: "we", workout_id: wid }];
  else if (url.pathname.endsWith("/set_logs"))
    value =
      snapshot?.sets?.map((set) => ({
        ...set,
        session_id: snapshot.id,
        workout_sessions: { status: "concluida", iniciado_em: snapshot.iniciado_em },
      })) ?? [];
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(value),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Content-Range": "0-0/1",
    },
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const overflow = async () =>
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "horizontal overflow",
  );
try {
  await page.goto(base + "/exercises");
  await page.getByText("25 exercícios encontrados", { exact: true }).waitFor();
  await overflow();
  assert.equal(
    await page.getByRole("button", { name: "Editar Supino com barra", exact: true }).count(),
    0,
    "official records cannot be edited by regular users",
  );
  await page.screenshot({ path: path.join(output, "biblioteca-mobile.png"), fullPage: false });
  await page.getByRole("button", { name: "Próxima página", exact: true }).click();
  await page.getByText("Página 2 de 2").waitFor();
  assert(calls.some((c) => c.path.endsWith("search_exercises_v2") && c.body.p_page === 1));
  await page.getByRole("button", { name: "Página anterior", exact: true }).click();
  await page.getByLabel("Buscar por nome", { exact: true }).fill("Supino com barra");
  await page.getByText("1 exercício encontrado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Detalhes", exact: true }).click();
  await page.getByRole("heading", { name: "Supino com barra", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Como executar" }).waitFor();
  await overflow();
  await page.screenshot({ path: path.join(output, "detalhes-mobile.png"), fullPage: false });
  await page.getByRole("button", { name: "Adicionar ao treino", exact: true }).click();
  await page.getByRole("button", { name: "Treino de peito", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(added.p_exercise_id, items[0].id);
  await page.getByLabel("Buscar por nome", { exact: true }).fill("");
  await page.getByText("25 exercícios encontrados", { exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "Filtrar exercícios" }).click();
  await page.getByLabel("Equipamento", { exact: true }).selectOption("dumbbell");
  await page.getByText("1 exercício encontrado", { exact: true }).waitFor();
  assert(calls.some((c) => c.body.p_equipment === "dumbbell"));
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await page.getByText("25 exercícios encontrados", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByLabel("Nome do exercício").fill("Exercício teste local");
  await page.getByLabel("Descrição", { exact: true }).fill("Descrição personalizada");
  await page.getByLabel("Equipamento (separe por vírgulas)").fill("elástico");
  await page.getByLabel("Instruções (uma etapa por linha)").fill("Etapa um\nEtapa dois");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(
    calls.some(
      (c) =>
        c.path.endsWith("/exercises") &&
        c.body.source === "user" &&
        c.body.instrucoes?.length === 2,
    ),
  );
  await page.goto(base + "/workouts");
  await page.getByRole("button", { name: "Novo treino", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar exercício", exact: true }).click();
  await page.getByLabel("Buscar exercício para o treino").fill("Supino com barra");
  await page.getByRole("button", { name: /Supino com barra/ }).click();
  await page.getByRole("dialog").getByText("Supino com barra", { exact: true }).waitFor();
  await overflow();
  await page.screenshot({ path: path.join(output, "montar-treino-mobile.png"), fullPage: false });
  await page.goto(base + "/run/" + wid);
  await page.getByRole("button", { name: "Concluir série", exact: true }).waitFor();
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await page.waitForTimeout(1000);
  assert.deepEqual(snapshot?.sets[0].musculos_primarios, ["chest"]);
  assert.deepEqual(snapshot?.sets[0].musculos_secundarios, ["shoulders", "triceps"]);
  await page.getByRole("button", { name: "Substituir exercício", exact: true }).click();
  await page.getByLabel("Buscar exercício para o treino").fill("Rosca com halteres");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Rosca com halteres/ }).click();
  await page.getByRole("heading", { name: "Rosca com halteres", exact: true }).waitFor();
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Finalizar/ }).click();
  await page.getByRole("heading", { name: "Treino concluído" }).waitFor();
  await page.waitForTimeout(1000);
  assert(snapshot?.finalizado_em);
  assert.equal(snapshot.sets[0].musculo_principal, "biceps");
  await page.getByRole("link", { name: "Ver músculos trabalhados", exact: true }).click();
  await page.locator('[data-muscle="biceps"]').click({ position: { x: 10, y: 10 } });
  await page.getByText("séries com participação").waitFor();
  await overflow();
  assert(
    calls.some(
      (c) =>
        c.path.endsWith("search_exercises_v2") &&
        c.body.p_page_size === 3 &&
        c.body.p_muscles?.includes("biceps"),
    ),
  );
  await page.goto(base + "/admin/exercises");
  await page.getByRole("heading", { name: "Acesso administrativo necessário" }).waitFor();
  admin = true;
  await page.reload();
  await page.getByRole("heading", { name: "Biblioteca oficial", exact: true }).waitFor();
  const manager = page.locator('section[aria-labelledby="manager-title"]');
  await manager.getByRole("button", { name: "Selecionar página", exact: true }).waitFor();
  await manager.getByRole("checkbox").first().check();
  await manager.getByRole("button", { name: "Próxima página", exact: true }).click();
  await manager.getByText("Página 2 de 2").waitFor();
  await manager.getByRole("checkbox").first().check();
  await manager.getByRole("button", { name: "Excluir selecionados (2)", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar exclusão", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(
    calls.some((c) => c.path.endsWith("delete_catalog_exercises") && c.body.p_ids.length === 2),
  );
  await manager.getByLabel("Mostrar", { exact: true }).selectOption("deleted");
  for (let i = 0; i < 2; i++) {
    await manager.getByRole("button", { name: "Restaurar", exact: true }).first().click();
    await page.waitForTimeout(300);
  }
  await manager.getByLabel("Mostrar", { exact: true }).selectOption("all");
  await manager.getByRole("button", { name: "Selecionar todos do filtro", exact: true }).click();
  await manager.getByRole("button", { name: "Excluir selecionados (24)", exact: true }).waitFor();
  assert(calls.some((c) => c.body.p_ids_only));
  await manager.getByRole("button", { name: "Limpar seleção", exact: true }).click();
  await manager.getByRole("button", { name: "Inativar Supino com barra", exact: true }).click();
  await manager.getByRole("button", { name: "Ativar Supino com barra", exact: true }).waitFor();
  await manager.getByRole("button", { name: "Ativar Supino com barra", exact: true }).click();
  await manager.getByRole("button", { name: "Inativar Supino com barra", exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "gerenciar-mobile.png"), fullPage: false });
  await manager.getByRole("button", { name: "Excluir todos", exact: true }).click();
  const removeAll = page.getByRole("button", { name: "Confirmar exclusão", exact: true });
  assert(await removeAll.isDisabled());
  await page.getByText("Digite EXCLUIR TODOS").locator("input").fill("EXCLUIR TODOS");
  await page.screenshot({ path: path.join(output, "excluir-todos-mobile.png"), fullPage: false });
  await removeAll.click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(items.filter((e) => e.source === "user").every((e) => !e.catalog_deleted_at));
  items.forEach((e) => {
    e.catalog_deleted_at = null;
    e.active = true;
  });
  await page.reload();
  await page.getByRole("link", { name: "Importar GIFs", exact: true }).click();
  const importer = page.locator("#gif-import");
  await page.getByLabel("Manifesto de GIFs", { exact: true }).setInputFiles(fixtureJson);
  await page.getByLabel("ZIP de GIFs", { exact: true }).setInputFiles(fixtureZip);
  await page.getByLabel("Categoria de importação", { exact: true }).selectOption("peitoral");
  await importer.getByText(/2 exercícios encontrados/).waitFor();
  await page.screenshot({ path: path.join(output, "importar-mobile.png"), fullPage: false });
  await page.getByRole("button", { name: "Importar exercícios", exact: true }).click();
  await importer.getByText(/2 novos · 0 já cadastrados · 2 uploads · 0 erros/).waitFor();
  assert.equal(
    calls.filter((c) => c.path.includes("/storage/v1/object/exercise-media/")).length,
    2,
  );
  assert(
    await page
      .getByRole("button", { name: "Substituir biblioteca antiga", exact: true })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "Importar exercícios", exact: true }).click();
  await importer.getByText(/0 novos · 2 já cadastrados · 0 uploads · 0 erros/).waitFor();
  assert.equal(
    calls.filter((c) => c.path.includes("/storage/v1/object/exercise-media/")).length,
    2,
  );
  await page.getByLabel("Categoria de importação", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Importar exercícios", exact: true }).click();
  await importer.getByText(/1 novos · 2 já cadastrados · 1 uploads · 0 erros/).waitFor();
  const cutover = page.getByRole("button", { name: "Substituir biblioteca antiga", exact: true });
  await cutover.waitFor();
  await page.waitForTimeout(300);
  assert(await cutover.isEnabled());
  await cutover.click();
  assert(
    await page.getByRole("button", { name: "Confirmar substituição", exact: true }).isDisabled(),
  );
  await page
    .getByText("Digite SUBSTITUIR BIBLIOTECA")
    .locator("input")
    .fill("SUBSTITUIR BIBLIOTECA");
  await page.getByRole("button", { name: "Confirmar substituição", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await importer.getByText(/Biblioteca própria ativa/).waitFor();
  await overflow();
  await page.screenshot({
    path: path.join(output, "biblioteca-ativada-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Baixar relatório do banco", exact: true }).click();
  assert(calls.some((c) => c.path.endsWith("owned_catalog_report") && c.body.p_include_reviews));
  await page.getByRole("link", { name: "Gerenciar", exact: true }).click();
  await manager.getByRole("button", { name: "Editar / revisar", exact: true }).first().click();
  await page.getByLabel("Músculo primário anatômico", { exact: true }).fill("Peitoral revisado");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(calls.some((c) => c.body.musculo_principal_anatomico === "Peitoral revisado"));
  await page.goto(base + "/exercises");
  await page.getByRole("button", { name: "Excluir Supino com barra", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  assert(items[0].catalog_deleted_at);
  items[0].catalog_deleted_at = null;
  items[0].active = true;
  for (const width of [360, 375, 390, 412, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/admin/exercises");
    await manager
      .getByRole("heading", { name: "Gerenciar exercícios oficiais", exact: true })
      .waitFor();
    await overflow();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: path.join(output, width === 390 ? "gerenciar-mobile.png" : "gerenciar-desktop.png"),
        fullPage: false,
      });
    if (width === 390) {
      await manager
        .getByRole("button", { name: "Editar / revisar", exact: true })
        .first()
        .scrollIntoViewIfNeeded();
      await overflow();
      await page.screenshot({
        path: path.join(output, "gerenciar-acoes-mobile.png"),
        fullPage: false,
      });
    }
    await page.getByRole("link", { name: "Importar GIFs", exact: true }).click();
    await overflow();
  }
  for (const width of [360, 375, 390, 412, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/exercises");
    await page.getByRole("heading", { name: "Exercícios", exact: true }).waitFor();
    await overflow();
    if (width === 1440) {
      const dimensions = await page.locator("main").evaluate((main) => ({
        width: main.getBoundingClientRect().width,
        smallestTitle: Math.min(
          ...[...main.querySelectorAll("h2")].map((title) => title.getBoundingClientRect().width),
        ),
      }));
      assert(dimensions.width >= 900, "desktop library is too narrow");
      assert(dimensions.smallestTitle >= 150, "desktop cards compress exercise names");
    }
    if (width === 1440)
      await page.screenshot({ path: path.join(output, "biblioteca-desktop.png"), fullPage: false });
  }
  errorMode = true;
  await page.reload();
  await page.getByText("Não foi possível carregar a biblioteca.", { exact: true }).waitFor();
  errorMode = false;
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await page.getByText(/exercícios encontrados/).waitFor();
  missingMedia = true;
  await page.reload();
  await page.getByLabel("Demonstração indisponível").first().waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: local mobile/desktop library, pagination/search/filters, protected official edit, details/media fallback, manual creation, add to workout, paged workout picker/replacement, completed imported exercise, live/weekly map query, admin denial/owned ZIP import/category/idempotence/cutover/selection/deletion/review, error recovery; no real database or ExerciseDB browser calls.",
  );
} catch (error) {
  console.error("Browser location:", page.url());
  console.error((await page.locator("body").innerText()).slice(0, 2500));
  await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
