// Real LOCAL routes, with every Supabase/external request intercepted in this test process.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"))
  : await import("playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local server only");
const output = process.env.TEST_SCREENSHOTS ?? "validation/treino-mapa";
fs.mkdirSync(output, { recursive: true });
const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const supabaseURL =
  process.env.VITE_SUPABASE_URL ?? env.match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
assert(supabaseURL);
const uid = "00000000-0000-4000-8000-000000000001";
const wid = "00000000-0000-4000-8000-000000000002";
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
const draftKey = `eforge:v1:${uid}:draft`;
const exercises = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    nome: "Supino com barra",
    musculo_principal: "chest",
    musculos_secundarios: ["shoulders", "triceps"],
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    nome: "Remada com halteres",
    musculo_principal: "lats",
    musculos_secundarios: ["biceps"],
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    nome: "Rosca com halteres",
    musculo_principal: "biceps",
    musculos_secundarios: ["forearms"],
  },
].map((entry) => ({
  ...entry,
  user_id: uid,
  gif_url: null,
  tipo_controle: "peso_kg",
  categoria: "musculacao",
  visibility: "private",
  source: "user",
  external_id: null,
  name_original: null,
  name_pt_br: null,
  slug: null,
  descricao: null,
  equipamentos: [],
  partes_corpo: [],
  instrucoes: [],
  instrucoes_pt_br: [],
  dificuldade: null,
  active: true,
  review_status: "approved",
  classification_reviewed: true,
  unmapped_muscles: [],
  musculos_primarios: [entry.musculo_principal],
  musculos_terciarios: [],
  observacoes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_synced_at: null,
}));
let snapshot = null;
let offline = false;
const snapshots = [];
let launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.TEST_CHROMIUM_MODULE) {
  const { default: binary } = await import(process.env.TEST_CHROMIUM_MODULE);
  launch = { ...launch, executablePath: await binary.executablePath(), args: binary.args };
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
  const url = new URL(route.request().url());
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
  if (process.env.TEST_TEKO_FONT && url.hostname === "fonts.googleapis.com")
    return route.fulfill({
      contentType: "text/css",
      body: "@font-face{font-family:'Teko';font-style:normal;font-weight:400 700;font-display:swap;src:url(https://fonts.gstatic.com/eforge-test.ttf) format('truetype')}",
    });
  if (process.env.TEST_TEKO_FONT && url.hostname === "fonts.gstatic.com")
    return route.fulfill({
      contentType: "font/ttf",
      body: fs.readFileSync(process.env.TEST_TEKO_FONT),
    });
  if (url.origin !== new URL(supabaseURL).origin) return route.abort();
  if (offline) return route.abort();
  let body = [];
  if (url.pathname.endsWith("/auth/v1/user")) body = user;
  else if (url.pathname.endsWith("/workouts")) body = { nome: "Peito e costas" };
  else if (url.pathname.endsWith("/workout_exercises"))
    body = exercises.slice(0, 2).map((exercise, index) => ({
      exercise_id: exercise.id,
      exercises: exercise,
      series: index ? 2 : 3,
      repeticoes: 10,
      carga_kg: 30,
      descanso_seg: 90,
      ordem: index,
    }));
  else if (url.pathname.endsWith("/rpc/search_exercises_v2"))
    body = { items: exercises, total: exercises.length };
  else if (url.pathname.endsWith("/rpc/exercise_catalog_facets"))
    body = { equipments: [], bodyParts: [] };
  else if (url.pathname.endsWith("/rpc/save_workout_snapshot")) {
    const input = JSON.parse(route.request().postData());
    snapshot = input.payload;
    snapshots.push(snapshot);
    body = null;
  } else if (url.pathname.endsWith("/set_logs")) {
    body = url.searchParams.get("select")?.includes("workout_sessions")
      ? snapshot?.finalizado_em
        ? snapshot.sets
            .filter((set) => set.concluida && set.kind !== "warmup")
            .map((set) => ({ ...set, session_id: snapshot.id }))
        : []
      : [{ exercise_id: exercises[0].id, carga_kg: 40, repeticoes: 10 }];
  } else if (url.pathname.endsWith("/user_roles")) body = null;
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const readDraft = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), draftKey);
const waitFor = async (condition, message) => {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await condition()) return;
    await page.waitForTimeout(100);
  }
  assert.fail(message);
};
try {
  await page.goto(base + "/run/" + wid);
  await page
    .getByRole("heading", { name: "Peito e costas", exact: true })
    .waitFor({ timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByText("Músculos ativados", { exact: true }).count(), 0);
  assert.equal(
    await page
      .locator(
        ".workout-run .anatomical-figure, .workout-run .muscle-body, .workout-run svg[data-muscle]",
      )
      .count(),
    0,
  );
  const first = page.getByRole("region", { name: "Supino com barra", exact: true });
  await page.getByRole("button", { name: "Finalizar treino", exact: true }).click();
  await page.getByText("Conclua ao menos uma série.", { exact: true }).waitFor();
  assert(!(await readDraft()).finished);
  assert.equal(
    await first
      .getByRole("textbox", { name: "Supino com barra série 1 carga", exact: true })
      .inputValue(),
    "40",
  );
  await first
    .getByRole("textbox", { name: "Supino com barra série 1 repetições", exact: true })
    .fill("12");
  await first
    .getByRole("textbox", { name: "Supino com barra série 1 carga", exact: true })
    .fill("42,5");
  await first.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  assert.equal((await readDraft()).exercises[0].sets[0].done, true);
  assert.equal(
    await page.getByRole("progressbar", { name: "Séries concluídas" }).getAttribute("value"),
    "1",
  );
  await page.getByRole("timer").waitFor();
  assert.equal(
    await page
      .locator(".workout-run-stats")
      .innerText()
      .then((text) => text.includes("510")),
    true,
  );
  const restBefore = (await readDraft()).restUntil;
  await page.getByRole("button", { name: "Aumentar descanso em 15 segundos" }).click();
  assert.equal((await readDraft()).restUntil, restBefore + 15_000);
  await page.getByRole("button", { name: "Diminuir descanso em 15 segundos" }).click();
  assert.equal((await readDraft()).restUntil, restBefore);
  await first.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  assert.equal((await readDraft()).exercises[0].sets[0].done, false);
  await first.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  await first.getByRole("button", { name: "Adicionar série", exact: true }).click();
  assert.equal((await readDraft()).exercises[0].sets.length, 4);
  const addedId = (await readDraft()).exercises[0].sets[3].id;
  assert.notEqual(addedId, (await readDraft()).exercises[0].sets[0].id);
  await first.getByRole("button", { name: "Remover série", exact: true }).last().click();
  assert.equal((await readDraft()).exercises[0].sets.length, 3);
  await first
    .getByRole("combobox", { name: "Tipo da série", exact: true })
    .nth(1)
    .selectOption("warmup");
  assert.equal((await readDraft()).exercises[0].sets[1].kind, "warmup");
  await first.getByText("Séries anteriores", { exact: true }).click();
  await first.getByText("10 repetições × 40 kg", { exact: true }).waitFor();
  await first.getByText("Séries anteriores", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Som no descanso" }).check();
  assert(await page.getByRole("checkbox", { name: "Som no descanso" }).isChecked());
  await page.getByRole("checkbox", { name: "Som no descanso" }).uncheck();
  await page.getByRole("button", { name: "Pular descanso", exact: true }).click();
  assert.equal((await readDraft()).restUntil, 0);
  await first.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  await first.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .getByText("Conclua ao menos uma série.", { exact: true })
    .waitFor({ state: "hidden", timeout: 8000 });
  await page.screenshot({ path: output + "/treino-mobile.png" });
  await first
    .locator(".workout-run-set")
    .first()
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: output + "/treino-series-mobile.png" });
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      "Horizontal overflow: " + width,
    );
    const targets = await page
      .locator(
        ".workout-run-complete, .workout-run-set-options button, .workout-run-set-options select, .workout-run-rest-actions button, .workout-run-add, .workout-run-replace button",
      )
      .evaluateAll((items) =>
        items.map((item) => ({
          width: item.getBoundingClientRect().width,
          height: item.getBoundingClientRect().height,
        })),
      );
    assert(
      targets.every((target) => target.width >= 44 && target.height >= 44),
      "Touch target smaller than 44px: " + width,
    );
  }
  await page.screenshot({ path: output + "/treino-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const bottomControl = await page.locator(".workout-run-history summary").last().boundingBox();
  const footer = await page.locator(".workout-run-footer").boundingBox();
  assert(
    bottomControl.y + bottomControl.height <= footer.y,
    "Footer covers the last workout control",
  );
  await waitFor(() => snapshot?.sets[0]?.carga_kg === 42.5, "Edited decimal load not synced");
  assert.deepEqual(snapshot.sets[0].musculos_primarios, ["chest"]);
  assert.deepEqual(snapshot.sets[0].musculos_secundarios, ["shoulders", "triceps"]);
  const stableSetId = (await readDraft()).exercises[0].sets[0].id;
  offline = true;
  await first
    .getByRole("textbox", { name: "Supino com barra série 1 repetições", exact: true })
    .fill("11");
  await page.getByText("Salvo no aparelho • sincronização pendente", { exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("heading", { name: "Peito e costas", exact: true }).waitFor();
  assert.equal((await readDraft()).exercises[0].sets[0].id, stableSetId);
  assert.equal(
    await first
      .getByRole("textbox", { name: "Supino com barra série 1 repetições", exact: true })
      .inputValue(),
    "11",
  );
  offline = false;
  await first
    .getByRole("textbox", { name: "Supino com barra série 1 repetições", exact: true })
    .fill("12");
  await waitFor(() => snapshots.at(-1)?.sets[0]?.repeticoes === 12, "Offline change not resynced");
  // Replace the second exercise without touching the completed bench press.
  const second = page.getByRole("region", { name: "Remada com halteres", exact: true });
  await second.getByRole("button", { name: "Substituir exercício", exact: true }).click();
  await page.getByRole("button", { name: /Rosca com halteres/ }).click();
  assert.equal((await readDraft()).exercises[1].exercise_id, exercises[2].id);
  assert.deepEqual((await readDraft()).exercises[1].musculos_primarios, ["biceps"]);
  const curl = page.getByRole("region", { name: "Rosca com halteres", exact: true });
  await curl
    .getByRole("textbox", { name: "Rosca com halteres série 1 carga", exact: true })
    .fill("12");
  await curl.getByRole("button", { name: "Concluir série", exact: true }).first().click();
  await page.getByRole("button", { name: "Pular descanso", exact: true }).click();
  await waitFor(
    () => snapshot?.sets.some((set) => set.exercise_id === exercises[2].id && set.concluida),
    "Replacement snapshot not saved",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finalizar treino", exact: true }).click();
  await page.getByRole("heading", { name: "Treino concluído", exact: true }).waitFor();
  await waitFor(() => !!snapshot?.finalizado_em, "Finished snapshot not synced");
  await page.getByRole("link", { name: "Ver músculos trabalhados", exact: true }).click();
  await page.locator('[data-muscle="chest"][data-role="primary"]').waitFor();
  assert.equal(await page.locator('[data-muscle="biceps"]').getAttribute("data-role"), "primary");
  assert.equal(
    await page.locator('[data-muscle="shoulders"]').getAttribute("data-role"),
    "secondary",
  );
  assert.equal(
    await page.locator('[data-muscle="forearms"]').getAttribute("data-role"),
    "secondary",
  );
  assert.equal(snapshot.sets[0].id, stableSetId);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real local workout routes — no legacy avatar, input/decimal editing, complete/undo, rest +/-/skip, add/remove, series types/history, sound switch, offline/resume, stable snapshot IDs, replacement, finish-to-muscle-map, roles, 320–1440px, 44px targets and footer clearance.",
  );
} catch (error) {
  console.error("Browser location:", page.url());
  console.error((await page.locator("body").innerText()).slice(0, 1800));
  await page.screenshot({ path: output + "/treino-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
