// Rotas reais, PostgreSQL local (PGlite) e HTTP interceptado. Nenhum banco remoto é usado.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  database,
  rpc,
  asUser,
  asOwner,
  USER_A,
  USER_B,
  WORKOUT,
} from "./helpers/owned-database.mjs";
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"))
  : await import("playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = process.env.TEST_SCREENSHOTS ?? "validation/fechamento";
fs.mkdirSync(output, { recursive: true });
const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const supabaseURL =
  process.env.VITE_SUPABASE_URL ?? env.match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
assert(supabaseURL);
const key = `sb-${new URL(supabaseURL).hostname.split(".")[0]}-auth-token`;
function session(id) {
  return {
    access_token: "local-" + id,
    refresh_token: "local",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "local@example.invalid",
      app_metadata: { provider: "email" },
      user_metadata: { display_name: "Atleta" },
      created_at: new Date().toISOString(),
    },
  };
}
const db = await database();
const exIds = [
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
  "99999999-9999-4999-8999-999999999999",
];
await db.query(
  `INSERT INTO exercises(id,user_id,nome,tipo_controle,musculo_principal,musculos_primarios,musculos_secundarios,categoria,visibility,source,gif_url,instrucoes_pt_br) VALUES
 ($1,NULL,'Supino com barra','peso_kg','chest',ARRAY['chest'],ARRAY['triceps','shoulders'],'musculacao','public','eforge','https://media.fixture.invalid/supino.gif',ARRAY['Posicione a barra sobre o peito.','Estenda os braços com controle.']),
 ($2,$4,'Rosca personalizada','peso_kg','biceps',ARRAY['biceps'],ARRAY['forearms'],'musculacao','private','user',NULL,'{}'),
 ($3,$5,'Rosca com halteres','peso_kg','biceps',ARRAY['biceps'],ARRAY['forearms'],'musculacao','private','user',NULL,'{}')`,
  [...exIds, USER_A, USER_B],
);
const plan = exIds.slice(0, 2).map((exercise_id, i) => ({
  id: `aaaaaaaa-${i ? "2222-4222-8222-222222222222" : "1111-4111-8111-111111111111"}`,
  exercise_id,
  series: 3 + i,
  repeticoes: 10 + i,
  carga_kg: i ? null : 25.5,
  descanso_seg: i ? 0 : 90,
}));
await asUser(db, USER_A);
await rpc(db, "save_workout_plan", [
  WORKOUT,
  "Peito e braços",
  "Força e controle em cada repetição.",
  plan,
]);
const extra = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];
for (let i = 0; i < extra.length; i++)
  await rpc(db, "save_workout_plan", [
    extra[i],
    ["Costas e ombros", "Pernas e core"][i],
    "",
    [
      {
        ...plan[0],
        id: `dddddddd-${i ? "2222-4222-8222-222222222222" : "1111-4111-8111-111111111111"}`,
      },
    ],
  ]);
await rpc(db, "save_body_profile", [80, 180, 30, "masculino", "hipertrofia"]);
await db.query(
  "INSERT INTO body_measurements(user_id,measured_at,weight_kg) VALUES($1,'2025-01-01',95)",
  [USER_A],
);
let launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.TEST_CHROMIUM_MODULE) {
  const { default: binary } = await import(process.env.TEST_CHROMIUM_MODULE);
  launch = {
    ...launch,
    executablePath: await binary.executablePath(),
    args: binary.args.filter((arg) => arg !== "--single-process"),
  };
}
const browser = await chromium.launch(launch);
const contexts = [];
const errors = [];
let token = "";
let queue = Promise.resolve();
let failProfile = false;
let failImport = false;
const requests = [];
let gifRequests = 0;
const singleResponse = (req, rows) =>
  req.headers().accept?.includes("application/vnd.pgrst.object+json") ||
  req.url().includes("select=*&id=")
    ? (rows[0] ?? null)
    : rows;
async function contextFor(id = null, desktop = false) {
  const ctx = await browser.newContext({
    viewport: desktop ? { width: 1440, height: 1050 } : { width: 390, height: 844 },
    isMobile: !desktop,
    hasTouch: !desktop,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  contexts.push(ctx);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  if (id)
    await ctx.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      { key, session: session(id) },
    );
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url()),
      req = route.request();
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === "fonts.googleapis.com" && process.env.TEST_TEKO_FONT)
      return route.fulfill({
        contentType: "text/css",
        body: "@font-face{font-family:'Teko';font-style:normal;font-weight:400 700;font-display:swap;src:url(https://fonts.gstatic.com/eforge-test.ttf) format('truetype')}",
      });
    if (url.hostname === "fonts.gstatic.com" && process.env.TEST_TEKO_FONT)
      return route.fulfill({
        contentType: "font/ttf",
        body: fs.readFileSync(process.env.TEST_TEKO_FONT),
      });
    if (url.hostname === "media.fixture.invalid") {
      gifRequests++;
      return route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAK+vrwAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"),
      });
    }
    if (url.origin !== new URL(supabaseURL).origin) return route.abort();
    const perform = async () => {
      let status = 200,
        body = [];
      const auth = req.headers().authorization ?? "";
      const actor = auth.includes("local-") ? auth.split("local-")[1] : null;
      try {
        if (actor) await asUser(db, actor);
        else await db.exec("RESET ROLE;SET ROLE anon;SET request.jwt.claim.sub=''");
        if (url.pathname.endsWith("/auth/v1/token")) body = session(USER_B);
        else if (url.pathname.endsWith("/auth/v1/user")) body = session(actor ?? USER_B).user;
        else if (url.pathname.includes("/rpc/")) {
          const name = url.pathname.split("/").pop(),
            input = JSON.parse(req.postData() || "{}");
          requests.push({ name, input, actor });
          if (name === "save_body_profile" && failProfile) {
            status = 500;
            body = { message: "Falha simulada ao salvar perfil", code: "TEST" };
          } else if (name === "import_shared_workout" && failImport) {
            failImport = false;
            status = 503;
            body = { message: "Falha simulada de conexão", code: "TEST" };
          } else {
            assert(/^[a-z_][a-z0-9_]*$/.test(name));
            const args = Object.entries(input);
            args.forEach(([k]) => assert(/^[a-z_]+$/.test(k)));
            const sql = `SELECT public.${name}(${args.map(([k], i) => `${k} := $${i + 1}`).join(",")}) data`;
            body = (
              await db.query(
                sql,
                args.map(([, value]) => value),
              )
            ).rows[0].data;
          }
        } else if (url.pathname.endsWith("/workouts"))
          body = (
            await db.query(
              "SELECT id,nome,descricao,created_at,ordem FROM workouts ORDER BY ordem,created_at DESC,id",
            )
          ).rows;
        else if (url.pathname.endsWith("/workout_exercises")) {
          const wid = url.searchParams.get("workout_id")?.replace(/^eq\./, "");
          if (wid)
            body = (
              await db.query(
                `SELECT we.*, jsonb_build_object('id',e.id,'nome',e.nome,'musculo_principal',e.musculo_principal) exercises FROM workout_exercises we LEFT JOIN exercises e ON e.id=we.exercise_id WHERE we.workout_id=$1 ORDER BY ordem`,
                [wid],
              )
            ).rows;
          else body = (await db.query("SELECT id,workout_id FROM workout_exercises")).rows;
        } else if (url.pathname.endsWith("/workout_shares")) {
          body = singleResponse(
            req,
            (
              await db.query(
                "SELECT id,token,created_at FROM workout_shares WHERE workout_id=$1 AND revoked_at IS NULL",
                [url.searchParams.get("workout_id")?.replace(/^eq\./, "")],
              )
            ).rows,
          );
          if (Array.isArray(body)) body = body[0] ?? null;
        } else if (url.pathname.endsWith("/profiles"))
          // JSON do PostgreSQL reproduz números/datas do PostgREST; o driver local
          // devolve NUMERIC como string e DATE como Date em consultas cruas.
          body = (await db.query("SELECT to_jsonb(p) data FROM profiles p")).rows[0]?.data ?? null;
        else if (url.pathname.endsWith("/body_measurements"))
          body = (
            await db.query(
              "SELECT to_jsonb(m) data FROM body_measurements m ORDER BY measured_at DESC,created_at DESC",
            )
          ).rows.map((row) => row.data);
        else if (url.pathname.endsWith("/user_roles")) body = null;
        else if (
          url.pathname.endsWith("/set_logs") ||
          url.pathname.endsWith("/workout_sessions") ||
          url.pathname.endsWith("/goals") ||
          url.pathname.endsWith("/achievements") ||
          url.pathname.endsWith("/cardio_logs")
        )
          body = [];
        else {
          status = 500;
          body = { message: "Unexpected endpoint " + url.pathname };
        }
      } catch (e) {
        console.error("Local fixture failure", url.pathname, e.message);
        status = 400;
        body = { message: e.message, code: e.code ?? "TEST" };
      }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    };
    const job = queue.then(perform);
    queue = job.catch(() => {});
    await job;
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(output, name + ".png"),
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
}
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}
async function drag(page, handle, targetRow, { touch = false } = {}) {
  await handle.scrollIntoViewIfNeeded();
  const start = await handle.boundingBox(),
    target = await targetRow.boundingBox();
  assert(start && target);
  const x = start.x + start.width / 2,
    y = start.y + start.height / 2,
    end = Math.min(target.y + target.height * 0.7, 800);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + ((end - y) * i) / 12 }],
      });
      await page.waitForTimeout(25);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, end, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForTimeout(100);
}
try {
  const { page: owner } = await contextFor(USER_A);
  await owner.goto(base + "/workouts");
  await owner
    .getByRole("heading", { name: "Peito e braços", exact: true })
    .waitFor({ timeout: 45000 });
  await noOverflow(owner);
  await screenshot(owner, "treinos-mobile");
  await owner.getByRole("button", { name: "Organizar treinos", exact: true }).click();
  await drag(
    owner,
    owner.getByRole("button", { name: "Arrastar Peito e braços", exact: true }),
    owner.locator(".sort-row").nth(1),
    { touch: true },
  );
  assert.deepEqual(await owner.locator(".plan-order-card strong").allTextContents(), [
    "Costas e ombros",
    "Peito e braços",
    "Pernas e core",
  ]);
  await screenshot(owner, "organizar-treinos-mobile");
  await owner.getByRole("button", { name: "Salvar ordem", exact: true }).click();
  await owner.getByText("Ordem dos treinos salva.", { exact: true }).waitFor();
  await owner.reload();
  await owner.getByRole("heading", { name: "Costas e ombros", exact: true }).waitFor();
  assert.deepEqual(await owner.locator(".workout-plans article h2").allTextContents(), [
    "Costas e ombros",
    "Peito e braços",
    "Pernas e core",
  ]);
  await owner.getByRole("button", { name: "Organizar treinos", exact: true }).click();
  await owner.getByRole("button", { name: "Arrastar Costas e ombros", exact: true }).focus();
  await owner.keyboard.press("End");
  assert.deepEqual(await owner.locator(".plan-order-card strong").allTextContents(), [
    "Peito e braços",
    "Pernas e core",
    "Costas e ombros",
  ]);
  await owner.getByRole("button", { name: "Cancelar organização", exact: true }).click();
  assert.equal(
    await owner.locator(".workout-plans article h2").first().innerText(),
    "Costas e ombros",
  );

  await owner.getByRole("button", { name: "Editar Peito e braços", exact: true }).click();
  let editor = owner.getByRole("dialog", { name: "Editar treino", exact: true });
  await editor.waitFor();
  await editor.getByRole("button", { name: "Descer Supino com barra", exact: true }).click();
  assert.equal(
    await editor.locator(".plan-exercise h3").first().innerText(),
    "Rosca personalizada",
  );
  await editor.getByRole("button", { name: "Arrastar Rosca personalizada", exact: true }).focus();
  await owner.keyboard.press("ArrowDown");
  assert.equal(await editor.locator(".plan-exercise h3").first().innerText(), "Supino com barra");
  await editor
    .getByRole("textbox", { name: "Carga de Supino com barra", exact: true })
    .fill("27,5");
  await editor
    .getByRole("textbox", { name: "Descanso (s) de Supino com barra", exact: true })
    .fill("0");
  await screenshot(owner, "editar-exercicios-mobile");
  await editor.getByRole("button", { name: "Salvar treino", exact: true }).click();
  await owner.getByText("Treino atualizado!", { exact: true }).waitFor();
  await owner.getByRole("button", { name: "Editar Peito e braços", exact: true }).click();
  editor = owner.getByRole("dialog", { name: "Editar treino", exact: true });
  await editor.waitFor();
  assert.equal(
    await editor
      .getByRole("textbox", { name: "Carga de Supino com barra", exact: true })
      .inputValue(),
    "27.5",
  );
  assert.equal(
    await editor
      .getByRole("textbox", { name: "Descanso (s) de Supino com barra", exact: true })
      .inputValue(),
    "0",
  );
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  await owner.getByRole("button", { name: "Compartilhar Peito e braços", exact: true }).click();
  let shareDialog = owner.getByRole("dialog", { name: "Compartilhar treino", exact: true });
  await shareDialog.getByRole("button", { name: "Gerar link", exact: true }).click();
  await shareDialog.getByLabel("Link do treino").waitFor();
  token = (await shareDialog.getByLabel("Link do treino").inputValue()).split("/").pop();
  assert.match(token, /^[a-f0-9]{64}$/);
  await shareDialog.getByRole("button", { name: "Copiar link", exact: true }).click();
  await owner.getByText("Link copiado.", { exact: true }).waitFor();
  await screenshot(owner, "compartilhar-mobile");
  await owner.keyboard.press("Escape");

  const { page: guest } = await contextFor();
  await guest.goto(base + "/share/" + token);
  assert.equal(
    await guest.evaluate((key) => localStorage.getItem(key), key),
    null,
    "anonymous context must have no session",
  );
  await guest
    .getByRole("heading", { name: "Peito e braços", exact: true })
    .waitFor({ timeout: 45000 });
  assert.equal(await guest.locator(".shared-exercise").count(), 2);
  assert(gifRequests > 0);
  await noOverflow(guest);
  await screenshot(guest, "link-publico-mobile");
  await guest.getByRole("link", { name: "Entrar para copiar este treino", exact: true }).click();
  assert(new URL(guest.url()).searchParams.get("redirect") === "/share/" + token);
  await guest.getByRole("link", { name: "Cadastre-se", exact: true }).click();
  assert(new URL(guest.url()).searchParams.get("redirect") === "/share/" + token);
  await guest.getByRole("link", { name: "Entrar", exact: true }).click();
  await guest.getByRole("textbox", { name: "E-mail", exact: true }).fill("b@test.invalid");
  await guest.getByLabel("Senha", { exact: true }).fill("test-only");
  await guest.getByRole("button", { name: "Entrar", exact: true }).click();
  await guest.getByRole("heading", { name: "Peito e braços", exact: true }).waitFor();
  assert(new URL(guest.url()).pathname === "/share/" + token);
  await guest.getByRole("button", { name: "Copiar para meus treinos", exact: true }).click();
  let copy = guest.getByRole("dialog", { name: "Copiar treino", exact: true });
  await copy.waitFor();
  assert(
    await copy.getByRole("button", { name: "Salvar cópia do treino", exact: true }).isDisabled(),
  );
  await copy.getByLabel("Nome do seu treino").fill("Meu treino compartilhado");
  await copy
    .getByRole("button", { name: "Escolher substituto de Rosca personalizada", exact: true })
    .click();
  const picker = guest.getByRole("dialog", { name: "Selecionar exercício", exact: true });
  await picker.getByRole("button", { name: /Rosca com halteres/ }).click();
  assert.equal(await copy.getByRole("button", { name: /substituto de Supino/ }).count(), 0);
  await screenshot(guest, "copiar-substituicao-mobile");
  failImport = true;
  await copy.getByRole("button", { name: "Salvar cópia do treino", exact: true }).click();
  await copy.getByText("Falha simulada de conexão", { exact: true }).waitFor();
  await copy.getByRole("button", { name: "Salvar cópia do treino", exact: true }).click();
  await guest.getByText("Treino copiado para Meus treinos.", { exact: true }).waitFor();
  // A intro continua sendo a experiência existente de login; aguarde sua conclusão.
  await guest
    .getByRole("heading", { name: "Meu treino compartilhado", exact: true })
    .waitFor({ timeout: 30000 });
  const imports = requests.filter((x) => x.name === "import_shared_workout");
  assert.equal(imports.length, 2);
  assert.equal(imports[0].input.p_request_id, imports[1].input.p_request_id);
  assert.deepEqual(Object.keys(imports[1].input.p_replacements), [plan[1].id]);
  await guest.getByRole("button", { name: "Editar Meu treino compartilhado", exact: true }).click();
  copy = guest.getByRole("dialog", { name: "Editar treino", exact: true });
  await copy.waitFor();
  assert.deepEqual(await copy.locator(".plan-exercise h3").allTextContents(), [
    "Supino com barra",
    "Rosca com halteres",
  ]);
  assert.equal(
    await copy
      .getByRole("textbox", { name: "Séries de Rosca com halteres", exact: true })
      .inputValue(),
    "4",
  );
  await guest.keyboard.press("Escape");

  await owner.goto(base + "/body-profile");
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).waitFor();
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).click();
  const profile = owner.getByRole("dialog", { name: "Perfil físico", exact: true });
  assert.equal(
    await profile.getByRole("textbox", { name: "Peso (kg)", exact: true }).inputValue(),
    "80",
    "older measurement does not hide current profile weight",
  );
  await profile.getByRole("textbox", { name: "Peso (kg)", exact: true }).fill("55");
  await profile.getByRole("textbox", { name: "Idade", exact: true }).fill("26");
  const heightInput = profile.getByRole("textbox", { name: "Altura (m ou cm)", exact: true });
  const calculated = profile.getByRole("status", { name: "IMC calculado", exact: true });
  for (const height of ["1,85", "1.85", "185"]) {
    await heightInput.fill(height);
    assert((await calculated.innerText()).includes("16,1"));
    assert((await calculated.innerText()).includes("Abaixo do peso"));
    assert(!(await calculated.innerText()).includes("160.701"));
  }
  assert((await calculated.innerText()).includes("De 18,5 até menos de 25,0"));
  assert((await calculated.innerText()).includes("63,3 a 85,6 kg"));
  await profile.getByRole("combobox", { name: "Objetivo fitness", exact: true }).click();
  await owner.getByRole("option", { name: "Perder peso", exact: true }).click();
  assert((await calculated.innerText()).includes("Revise o objetivo de perder peso"));
  await heightInput.fill("1,85");
  await profile.evaluate((el) => {
    el.scrollTop = 0;
  });
  await screenshot(owner, "imc-formulario-mobile");
  await calculated.scrollIntoViewIfNeeded();
  await screenshot(owner, "imc-resultado-mobile");
  await noOverflow(owner);
  await profile.getByRole("button", { name: "Salvar", exact: true }).click();
  await owner.getByText("Perfil atualizado", { exact: true }).waitFor();
  await owner.reload();
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).waitFor();
  const savedBMI = owner.getByRole("status", { name: "Índice de Massa Corporal", exact: true });
  await savedBMI.waitFor();
  assert((await savedBMI.innerText()).includes("16,1"));
  assert((await savedBMI.innerText()).includes("63,3 a 85,6 kg"));
  await asOwner(db);
  const savedBody = (
    await db.query(
      "SELECT weight_kg::float8 weight_kg,height_cm::float8 height_cm,age FROM profiles WHERE id=$1",
      [USER_A],
    )
  ).rows[0];
  assert.equal(savedBody.weight_kg, 55);
  assert.equal(savedBody.height_cm, 185, "metros são persistidos em centímetros");
  assert.equal(savedBody.age, 26);
  await screenshot(owner, "imc-resumo-mobile");
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).click();
  assert.equal(await heightInput.inputValue(), "185");
  await profile.getByRole("textbox", { name: "Peso (kg)", exact: true }).fill("80");
  assert((await calculated.innerText()).includes("Na faixa de referência"));
  await profile.getByRole("textbox", { name: "Peso (kg)", exact: true }).fill("100");
  assert((await calculated.innerText()).includes("Acima do peso"));
  assert((await calculated.innerText()).includes("Sobrepeso"));
  await profile.getByRole("textbox", { name: "Idade", exact: true }).fill("65");
  assert((await calculated.innerText()).includes("Acima de 22,0 e abaixo de 27,0"));
  await profile.getByRole("textbox", { name: "Idade", exact: true }).fill("19");
  assert((await calculated.innerText()).includes("curvas de crescimento"));
  assert(!(await calculated.innerText()).includes("IMC desejável"));
  await profile.getByRole("textbox", { name: "Idade", exact: true }).fill("26");
  await profile.getByRole("textbox", { name: "Peso (kg)", exact: true }).fill("81,0");
  await heightInput.fill("1.80");
  assert(
    (
      await profile.getByRole("status", { name: "IMC calculado", exact: true }).innerText()
    ).includes("25,0"),
  );
  await heightInput.fill("");
  assert(
    (
      await profile.getByRole("status", { name: "IMC calculado", exact: true }).innerText()
    ).includes("—"),
  );
  await heightInput.fill("1.80");
  await screenshot(owner, "perfil-imc-mobile");
  failProfile = true;
  await profile.getByRole("button", { name: "Salvar", exact: true }).click();
  await profile.getByText("Falha simulada ao salvar perfil", { exact: true }).waitFor();
  assert(await profile.isVisible());
  failProfile = false;
  await profile.getByRole("button", { name: "Salvar", exact: true }).click();
  await owner.getByText("Perfil atualizado", { exact: true }).waitFor();
  await owner.reload();
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).waitFor();
  await owner.getByRole("button", { name: "Editar perfil", exact: true }).click();
  assert.equal(
    await owner
      .getByRole("dialog")
      .getByRole("textbox", { name: "Peso (kg)", exact: true })
      .inputValue(),
    "81",
  );
  await owner.keyboard.press("Escape");
  await noOverflow(owner);
  await owner.goto(base + "/reports");
  await owner.getByRole("heading", { name: "Relatórios", exact: true }).waitFor();
  assert(!/[\u{1f300}-\u{1faff}\u2600-\u27bf]/u.test(await owner.locator("main").innerText()));
  await screenshot(owner, "evolucao-mobile");

  const { page: desktop } = await contextFor(USER_A, true);
  await desktop.goto(base + "/workouts");
  await desktop
    .getByRole("heading", { name: "Peito e braços", exact: true })
    .waitFor({ timeout: 45000 });
  await desktop.getByRole("button", { name: "Organizar treinos", exact: true }).click();
  await drag(
    desktop,
    desktop.getByRole("button", { name: "Arrastar Costas e ombros", exact: true }),
    desktop.locator(".sort-row").nth(1),
  );
  assert.equal(
    await desktop.locator(".plan-order-card strong").first().innerText(),
    "Peito e braços",
  );
  await screenshot(desktop, "organizar-treinos-desktop");
  await desktop.getByRole("button", { name: "Cancelar organização", exact: true }).click();
  await desktop.getByRole("button", { name: "Editar Peito e braços", exact: true }).click();
  const de = desktop.getByRole("dialog", { name: "Editar treino", exact: true });
  await de.waitFor();
  await drag(
    desktop,
    de.getByRole("button", { name: "Arrastar Supino com barra", exact: true }),
    de.locator(".sort-row").nth(1),
  );
  assert.equal(await de.locator(".plan-exercise h3").first().innerText(), "Rosca personalizada");
  await screenshot(desktop, "editar-exercicios-desktop");
  await de.getByRole("button", { name: "Salvar treino", exact: true }).click();
  await desktop.getByText("Treino atualizado!", { exact: true }).waitFor();
  await desktop.reload();
  await desktop.getByRole("button", { name: "Editar Peito e braços", exact: true }).click();
  await desktop.getByRole("dialog", { name: "Editar treino", exact: true }).waitFor();
  assert.equal(
    await desktop.locator(".plan-exercise h3").first().innerText(),
    "Rosca personalizada",
    "saved dragged exercise order survives reload and can be edited again",
  );
  await desktop.keyboard.press("Escape");
  await desktop.goto(base + "/share/" + token);
  await desktop.getByRole("heading", { name: "Peito e braços", exact: true }).waitFor();
  await noOverflow(desktop);
  await screenshot(desktop, "link-publico-desktop");
  await owner.goto(base + "/workouts");
  await owner.getByRole("button", { name: "Compartilhar Peito e braços", exact: true }).click();
  shareDialog = owner.getByRole("dialog", { name: "Compartilhar treino", exact: true });
  await shareDialog.getByLabel("Link do treino").waitFor();
  assert((await shareDialog.getByLabel("Link do treino").inputValue()).endsWith(token));
  await shareDialog.getByRole("button", { name: "Revogar link", exact: true }).click();
  await owner.getByText("Link revogado.", { exact: true }).waitFor();
  await desktop.reload();
  await desktop.getByRole("heading", { name: "Link indisponível", exact: true }).waitFor();
  await screenshot(desktop, "link-revogado-desktop");
  await guest.goto(base + "/workouts");
  await guest.getByRole("heading", { name: "Meu treino compartilhado", exact: true }).waitFor();
  await guest.setViewportSize({ width: 320, height: 740 });
  await noOverflow(guest);
  await guest.getByRole("button", { name: "Editar Meu treino compartilhado", exact: true }).click();
  await guest.getByRole("dialog", { name: "Editar treino", exact: true }).waitFor();
  assert(
    await guest.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "320px editor must not overflow horizontally",
  );
  await screenshot(guest, "editar-exercicios-320");
  await guest.keyboard.press("Escape");
  await guest.goto(base + "/body-profile");
  await guest.getByRole("button", { name: "Editar perfil", exact: true }).click();
  const smallProfile = guest.getByRole("dialog", { name: "Perfil físico", exact: true });
  await smallProfile.getByRole("textbox", { name: "Peso (kg)", exact: true }).fill("55");
  await smallProfile.getByRole("textbox", { name: "Altura (m ou cm)", exact: true }).fill("1,85");
  await smallProfile.getByRole("textbox", { name: "Idade", exact: true }).fill("26");
  await smallProfile.getByRole("status").scrollIntoViewIfNeeded();
  assert(
    await guest.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "320px profile must not overflow horizontally",
  );
  await screenshot(guest, "imc-mobile-320");
  await guest.keyboard.press("Escape");
  await desktop.goto(base + "/body-profile");
  await desktop.getByRole("status", { name: "Índice de Massa Corporal", exact: true }).waitFor();
  await noOverflow(desktop);
  await screenshot(desktop, "imc-desktop");
  // Long lists exercise edge scrolling in both the page and the nested editor.
  const seedLong = queue.then(async () => {
    await asOwner(db);
    const longRows = [];
    for (let i = 0; i < 6; i++) {
      const exercise = `44444444-5555-4555-8555-${String(i + 1).padStart(12, "0")}`;
      await db.query(
        "INSERT INTO exercises(id,nome,tipo_controle,musculo_principal,categoria,visibility,source) VALUES($1,$2,'peso_kg','chest','musculacao','public','eforge')",
        [exercise, `Exercício de teste ${i + 1}`],
      );
      longRows.push({
        id: `44444444-6666-4666-8666-${String(i + 1).padStart(12, "0")}`,
        exercise_id: exercise,
        series: 3,
        repeticoes: 10,
        carga_kg: null,
        descanso_seg: 60,
      });
    }
    await asUser(db, USER_A);
    await rpc(db, "save_workout_plan", [
      "44444444-7777-4777-8777-777777777777",
      "Treino completo",
      "",
      longRows,
    ]);
  });
  queue = seedLong;
  await seedLong;
  async function holdAtEdge(page, handle, edge) {
    await handle.scrollIntoViewIfNeeded();
    const b = await handle.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + ((edge - y) * i) / 6 }],
      });
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(600);
    return async () => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await cdp.detach();
      await page.waitForTimeout(100);
    };
  }
  await owner.goto(base + "/workouts");
  await owner.getByRole("button", { name: "Organizar treinos", exact: true }).click();
  const beforeOrder = await owner.locator(".plan-order-card strong").allTextContents();
  const cancelPageDrag = await holdAtEdge(owner, owner.locator(".sort-handle").first(), 735);
  assert(
    await owner.evaluate(() => scrollY > 15),
    "drag near the page edge must scroll the viewport",
  );
  await cancelPageDrag();
  assert.deepEqual(
    await owner.locator(".plan-order-card strong").allTextContents(),
    beforeOrder,
    "pointer cancellation restores order",
  );
  await owner.getByRole("button", { name: "Cancelar organização", exact: true }).click();
  await owner.getByRole("button", { name: "Editar Treino completo", exact: true }).click();
  const longEditor = owner.getByRole("dialog", { name: "Editar treino", exact: true });
  await longEditor.waitFor();
  const box = await longEditor.boundingBox();
  const cancelEditorDrag = await holdAtEdge(
    owner,
    longEditor.getByRole("button", { name: "Arrastar Exercício de teste 1", exact: true }),
    box.y + box.height - 18,
  );
  assert(
    await longEditor.evaluate((el) => el.scrollTop > 60),
    "drag near the editor edge must scroll the dialog",
  );
  assert.notEqual(
    await longEditor.locator(".plan-exercise h3").first().innerText(),
    "Exercício de teste 1",
    "scrolled drag must reorder items",
  );
  await cancelEditorDrag();
  assert.equal(
    await longEditor.locator(".plan-exercise h3").first().innerText(),
    "Exercício de teste 1",
  );
  await owner.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "resultado.json"),
    JSON.stringify(
      {
        passed: true,
        viewports: ["390×844", "320×740", "1440×1050"],
        requests: requests.map(({ name, actor }) => ({ name, actor })),
        gifRequests,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real local UI + local PostgreSQL, touch/mouse/keyboard sorting, persistence/cancel, share link, public preview, login return, selective replacement, retry, revocation, profile save/live BMI and desktop/mobile layout.",
  );
} catch (e) {
  for (let i = 0; i < contexts.length; i++) {
    const pages = contexts[i].pages();
    if (pages[0])
      await pages[0]
        .screenshot({ path: path.join(output, `falha-${i}.png`), fullPage: true })
        .catch(() => {});
  }
  console.error("Browser errors:", errors);
  throw e;
} finally {
  await browser.close();
  await asOwner(db);
  await db.close();
}
