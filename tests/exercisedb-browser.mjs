// LOCAL integration/visual test. All Supabase and external requests are intercepted.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"))
  : await import("playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = process.env.TEST_SCREENSHOTS ?? "validation/exercisedb";
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
      ? "barbell bench press"
      : i === 1
        ? "Supino personalizado"
        : i === 2
          ? "dumbbell curl"
          : `Exercício do catálogo ${String(i).padStart(2, "0")}`,
  gif_url: i === 0 ? "https://static.exercisedb.dev/media/EIeI8Vf.gif" : null,
  tipo_controle: "repeticoes",
  categoria: "funcional",
  musculo_principal: i === 2 ? "biceps" : "chest",
  musculos_primarios: [i === 2 ? "biceps" : "chest"],
  musculos_secundarios: i === 2 ? ["forearms"] : ["shoulders", "triceps"],
  musculos_terciarios: [],
  source: i === 1 ? "user" : "exercisedb",
  external_id: i === 1 ? null : "external" + i,
  visibility: i === 1 ? "private" : "public",
  name_original: i === 0 ? "barbell bench press" : null,
  name_pt_br: null,
  slug: "exercise-" + i,
  descricao: null,
  equipamentos: i === 2 ? ["dumbbell"] : ["barbell"],
  partes_corpo: i === 2 ? ["upper arms"] : ["chest"],
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
let admin = false,
  errorMode = false,
  missingMedia = false;
let snapshot = null,
  added = null;
let calls = [];
let currentRun = null;
let mappings = [
  { source_name: "pectorals", muscle_keys: ["chest"], status: "mapped", notes: null },
  { source_name: "hip flexors", muscle_keys: [], status: "pending", notes: null },
];
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
  assert(!url.hostname.includes("oss.exercisedb"), "frontend must never call ExerciseDB");
  if (url.hostname === "static.exercisedb.dev" && process.env.TEST_EXERCISE_GIF && !missingMedia)
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
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  calls.push({ path: url.pathname, body });
  let value = [];
  if (url.pathname.includes("/auth/v1/user")) value = user;
  else if (url.pathname.endsWith("/rpc/search_exercises")) {
    if (errorMode)
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Local test failure" }),
      });
    let filtered = items.filter(
      (ex) =>
        (!body.p_query || ex.nome.toLowerCase().includes(body.p_query.toLowerCase())) &&
        (!body.p_muscles?.length ||
          [ex.musculo_principal, ...ex.musculos_secundarios].some((m) =>
            body.p_muscles.includes(m),
          )) &&
        (!body.p_equipment || ex.equipamentos.includes(body.p_equipment)) &&
        (!body.p_source || ex.source === body.p_source),
    );
    if (body.p_review) filtered = filtered.filter((ex) => !ex.classification_reviewed);
    const size = body.p_page_size ?? 20;
    value = {
      items: filtered.slice((body.p_page ?? 0) * size, ((body.p_page ?? 0) + 1) * size),
      total: filtered.length,
    };
  } else if (url.pathname.endsWith("/rpc/exercise_catalog_facets"))
    value = { equipments: ["barbell", "dumbbell"], bodyParts: ["chest", "upper arms"] };
  else if (url.pathname.endsWith("/rpc/add_exercise_to_workout")) {
    added = body;
    value = "00000000-0000-4000-8000-000000000009";
  } else if (url.pathname.endsWith("/rpc/save_workout_snapshot")) {
    snapshot = body.payload;
    value = null;
  } else if (url.pathname.includes("/functions/v1/sync-exercisedb")) {
    if (!admin)
      return route.fulfill({
        status: 403,
        body: JSON.stringify({ error: "Permissão administrativa necessária" }),
      });
    if (body.action === "start")
      currentRun = {
        id: "00000000-0000-4000-8000-000000000050",
        status: "running",
        received: 0,
        new_count: 0,
        updated_count: 0,
        ignored_count: 0,
        error_count: 0,
        total: null,
        cursor: null,
        has_next: true,
        started_at: new Date().toISOString(),
        finished_at: null,
        last_error: null,
        errors: [],
      };
    else if (body.action === "step")
      currentRun = {
        ...currentRun,
        status: "completed",
        received: 25,
        new_count: 23,
        updated_count: 1,
        ignored_count: 1,
        total: 25,
        has_next: false,
        finished_at: new Date().toISOString(),
      };
    value = currentRun;
  } else if (url.pathname.endsWith("/user_roles")) value = admin ? { role: "admin" } : null;
  else if (url.pathname.endsWith("/exercise_sync_runs")) value = currentRun ? [currentRun] : [];
  else if (url.pathname.endsWith("/exercise_muscle_mappings")) {
    if (req.method() === "PATCH")
      mappings = mappings.map((m) =>
        url.searchParams.get("source_name") === `eq.${m.source_name}` ? { ...m, ...body } : m,
      );
    value = mappings;
  } else if (url.pathname.endsWith("/profiles")) value = { sex: "masculino" };
  else if (url.pathname.endsWith("/exercises")) {
    if (req.method() === "GET" && url.searchParams.get("select") === "external_data")
      value = {
        external_data: {
          name: "barbell bench press",
          targetMuscles: ["pectorals"],
          secondaryMuscles: ["deltoids", "triceps"],
          instructions: ["Position on the bench.", "Press with control."],
        },
      };
    else if (req.method() === "POST") {
      items.push({ ...items[1], ...body, id: "00000000-0000-4000-8000-000000000199" });
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
    await page.getByRole("button", { name: /Editar barbell/ }).count(),
    0,
    "official records cannot be edited by regular users",
  );
  await page.screenshot({ path: path.join(output, "biblioteca-mobile.png"), fullPage: false });
  await page.getByRole("button", { name: "Próxima página", exact: true }).click();
  await page.getByText("Página 2 de 2").waitFor();
  assert(calls.some((c) => c.path.endsWith("search_exercises") && c.body.p_page === 1));
  await page.getByRole("button", { name: "Página anterior", exact: true }).click();
  await page.getByLabel("Buscar por nome", { exact: true }).fill("barbell");
  await page.getByText("1 exercício encontrado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Detalhes", exact: true }).click();
  await page.getByRole("heading", { name: "barbell bench press", exact: true }).waitFor();
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
  await page.getByLabel("Buscar exercício para o treino").fill("barbell");
  await page.getByRole("button", { name: /barbell bench press/ }).click();
  await page.getByRole("dialog").getByText("barbell bench press", { exact: true }).waitFor();
  await overflow();
  await page.screenshot({ path: path.join(output, "montar-treino-mobile.png"), fullPage: false });
  await page.goto(base + "/run/" + wid);
  await page.getByRole("button", { name: "Concluir série", exact: true }).waitFor();
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await page.waitForTimeout(1000);
  assert.deepEqual(snapshot?.sets[0].musculos_primarios, ["chest"]);
  assert.deepEqual(snapshot?.sets[0].musculos_secundarios, ["shoulders", "triceps"]);
  await page.getByRole("button", { name: "Substituir exercício", exact: true }).click();
  await page.getByLabel("Buscar exercício para o treino").fill("dumbbell");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /dumbbell curl/ }).click();
  await page.getByRole("heading", { name: "dumbbell curl", exact: true }).waitFor();
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
        c.path.endsWith("search_exercises") &&
        c.body.p_page_size === 3 &&
        c.body.p_muscles?.includes("biceps"),
    ),
  );
  await page.goto(base + "/admin/exercises");
  await page.getByRole("heading", { name: "Acesso administrativo necessário" }).waitFor();
  admin = true;
  await page.reload();
  await page.getByRole("heading", { name: "Biblioteca oficial", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sincronizar catálogo", exact: true }).click();
  await page.getByText(/Sincronização concluída ·/).waitFor();
  await overflow();
  await page.screenshot({ path: path.join(output, "admin-mobile.png"), fullPage: false });
  await page.locator("summary").filter({ hasText: "Mapeamento muscular" }).click();
  await page.getByRole("button", { name: "hip flexors Revisar", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("unsupported");
  await page
    .getByLabel("Justificativa da revisão")
    .fill("Sem grupo correspondente no avatar atual");
  await page.getByRole("button", { name: "Salvar mapeamento", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(mappings.find((m) => m.source_name === "hip flexors").status, "unsupported");
  await page.getByRole("button", { name: "Revisar exercício", exact: true }).first().click();
  await page.getByLabel("Nome em português (opcional)").fill("Supino com barra");
  await page.getByText("Dados atuais da fonte", { exact: true }).click();
  await page.getByText("Alvos: pectorals", { exact: true }).waitFor();
  await overflow();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  for (const width of [320, 430, 768, 1440]) {
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
    "PASS: local mobile/desktop library, pagination/search/filters, protected official edit, details/media fallback, manual creation, add to workout, paged workout picker/replacement, completed imported exercise, live/weekly map query, admin denial/import/mapping/review, error recovery; no real database or ExerciseDB browser calls.",
  );
} catch (error) {
  console.error("Browser location:", page.url());
  console.error((await page.locator("body").innerText()).slice(0, 2500));
  await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
