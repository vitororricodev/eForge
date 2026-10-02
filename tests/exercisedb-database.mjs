import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
import { core, exercise } from "./helpers/exercisedb.mjs";
const db = new PGlite();
await db.exec(
  `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text,public boolean);CREATE TABLE storage.objects(id uuid,bucket_id text,name text);CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;`,
);
for (const name of fs.readdirSync("supabase/migrations").sort())
  await db.exec(fs.readFileSync("supabase/migrations/" + name, "utf8"));
// Even overly broad table grants must not bypass the row policies or RPC permissions.
await db.exec("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated");
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  w = "33333333-3333-4333-8333-333333333333",
  custom = "44444444-4444-4444-8444-444444444444";
await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)", [
  a,
  "a@test.invalid",
  b,
  "b@test.invalid",
  admin,
  "admin@test.invalid",
]);
await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [admin]);
await db.query("INSERT INTO workouts(id,user_id,nome) VALUES($1,$2,'Treino A')", [w, a]);
await db.query(
  "INSERT INTO exercises(id,user_id,nome,tipo_controle,musculo_principal,categoria) VALUES($1,$2,'Supino personalizado','peso_kg','Peito','musculacao')",
  [custom, a],
);
const asUser = async (id) =>
  db.exec(`RESET ROLE;SET ROLE authenticated;SET request.jwt.claim.sub='${id}'`);
const asService = async () =>
  db.exec("RESET ROLE;SET ROLE service_role;SET request.jwt.claim.sub=''");
const rpc = async (name, args = []) =>
  (await db.query(`SELECT ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) AS data`, args))
    .rows[0].data;
await asUser(b);
assert.equal((await db.query("SELECT * FROM exercises WHERE id=$1", [custom])).rows.length, 0);
await asUser(admin);
assert.equal(
  (await db.query("SELECT * FROM exercises WHERE id=$1", [custom])).rows.length,
  0,
  "admin cannot browse another user private exercise",
);
await asUser(a);
await assert.rejects(rpc("begin_exercise_sync", [a]), /permission denied/);
await assert.rejects(
  db.query(
    "INSERT INTO exercises(source,external_id,user_id,nome,tipo_controle,musculo_principal,categoria,visibility) VALUES('exercisedb','forged',NULL,'Fake','repeticoes','chest','funcional','public')",
  ),
);
await assert.rejects(
  db.query(
    "UPDATE exercises SET source='exercisedb',external_id='forged',user_id=NULL,visibility='public' WHERE id=$1",
    [custom],
  ),
);
await asService();
await assert.rejects(rpc("begin_exercise_sync", [a]), /Admin required/);
let run = await rpc("begin_exercise_sync", [admin]);
assert.equal((await rpc("begin_exercise_sync", [admin])).id, run.id);
let claim = await rpc("claim_exercise_sync_page", [run.id]);
await assert.rejects(rpc("claim_exercise_sync_page", [run.id]), /already in progress/);
const normalized = core.normalizeExercise(exercise);
const pending = core.normalizeExercise({
  ...exercise,
  exerciseId: "unknown",
  name: "Unknown region",
  secondaryMuscles: ["hip flexors"],
});
const batch = async (claim, records, next = null, hasNext = false, errors = []) =>
  rpc("apply_exercise_sync_page", [
    claim.id,
    claim.lease_token,
    claim.cursor,
    next,
    hasNext,
    30,
    records.length + errors.length,
    JSON.stringify(records),
    JSON.stringify(errors),
  ]);
run = await batch(claim, [normalized, pending], "cursor-1", true);
assert.equal(run.new_count, 2);
assert.equal(run.received, 2);
const repeated = await batch(claim, [normalized, pending], "cursor-1", true);
assert.equal(repeated.received, 2, "replayed page does not increment statistics");
let official = (
  await db.query("SELECT * FROM exercises WHERE source='exercisedb' AND external_id=$1", [
    exercise.exerciseId,
  ])
).rows[0];
assert.equal(official.user_id, null);
assert.equal(official.musculo_principal, "chest");
assert.deepEqual(official.musculos_secundarios, ["shoulders", "triceps"]);
assert.deepEqual(official.musculos_terciarios, []);
assert.equal(official.dificuldade, null);
assert.equal(official.name_pt_br, null);
claim = await rpc("claim_exercise_sync_page", [run.id]);
await assert.rejects(batch(claim, [], "cursor-1", true), /Repeated cursor/);
run = await batch(claim, [], null, false, [{ message: "Invalid item" }]);
assert.equal(run.status, "completed");
assert.equal(run.error_count, 1);
assert.equal(
  (await db.query("SELECT nome FROM exercises WHERE id=$1", [custom])).rows[0].nome,
  "Supino personalizado",
);
await asUser(b);
assert.equal((await db.query("SELECT * FROM exercises WHERE id=$1", [official.id])).rows.length, 1);
assert.equal(
  (await db.query("SELECT * FROM exercises WHERE external_id='unknown'")).rows.length,
  0,
);
assert.equal(
  (await db.query("UPDATE exercises SET nome=$1 WHERE id=$2 RETURNING id", ["Hacked", official.id]))
    .rows.length,
  0,
);
assert.equal(
  (await db.query("DELETE FROM exercises WHERE id=$1 RETURNING id", [official.id])).rows.length,
  0,
);
assert.equal((await db.query("SELECT * FROM exercise_sync_runs")).rows.length, 0);
assert.equal((await db.query("SELECT * FROM exercise_muscle_mappings")).rows.length, 0);
await assert.rejects(
  rpc("search_exercises", ["", "{}", null, null, null, null, null, 0, 20, true]),
  /Admin required/,
);
let catalog = await rpc("search_exercises", [
  "barbell ben",
  "{triceps}",
  null,
  null,
  null,
  null,
  "exercisedb",
  0,
  20,
  false,
]);
assert.equal(catalog.total, 1);
await asUser(a);
await db.query("UPDATE exercises SET visibility='public' WHERE id=$1", [custom]);
await asUser(b);
assert.equal((await db.query("SELECT * FROM exercises WHERE id=$1", [custom])).rows.length, 1);
await assert.rejects(rpc("add_exercise_to_workout", [w, official.id]), /Workout unavailable/);
await asUser(a);
const item = await rpc("add_exercise_to_workout", [w, official.id]);
assert.equal(await rpc("add_exercise_to_workout", [w, official.id]), item);
assert.equal((await db.query("SELECT * FROM workout_exercises")).rows.length, 1);
const payload = {
  id: "55555555-5555-4555-8555-555555555555",
  workout_id: w,
  nome_treino: "A",
  iniciado_em: new Date().toISOString(),
  finalizado_em: new Date().toISOString(),
  volume_total: 100,
  sets: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      exercise_id: official.id,
      nome_exercicio: official.nome,
      musculo_principal: "chest",
      musculos_primarios: ["chest", "triceps"],
      musculos_secundarios: ["shoulders"],
      musculos_terciarios: [],
      serie_numero: 1,
      repeticoes: 10,
      carga_kg: 10,
      concluida: true,
      kind: "normal",
    },
  ],
};
await rpc("save_workout_snapshot", [payload]);
await rpc("save_workout_snapshot", [payload]);
assert.equal((await db.query("SELECT * FROM set_logs")).rows.length, 1);
assert.deepEqual(
  (await db.query("SELECT musculos_primarios FROM set_logs")).rows[0].musculos_primarios,
  ["chest", "triceps"],
);
await asUser(admin);
await db.query(
  "UPDATE exercises SET nome='Supino oficial revisado',name_pt_br='Supino oficial revisado',descricao='Nota interna',instrucoes_pt_br='{Instrução revisada}',musculos_terciarios='{forearms}',active=false WHERE id=$1",
  [official.id],
);
await asService();
run = await rpc("begin_exercise_sync", [admin]);
claim = await rpc("claim_exercise_sync_page", [run.id]);
run = await batch(claim, [
  core.normalizeExercise({
    ...exercise,
    name: "bench press updated",
    instructions: ["New external instruction"],
  }),
]);
assert.equal(run.new_count, 0);
assert.equal(run.updated_count, 1);
official = (await db.query("SELECT * FROM exercises WHERE id=$1", [official.id])).rows[0];
assert.equal(official.nome, "Supino oficial revisado");
assert.equal(official.name_original, "bench press updated");
assert.equal(official.descricao, "Nota interna");
assert.equal(official.active, false);
assert.deepEqual(official.instrucoes, ["New external instruction"]);
assert.deepEqual(official.instrucoes_pt_br, ["Instrução revisada"]);
assert.deepEqual(official.musculos_terciarios, ["forearms"]);
run = await rpc("begin_exercise_sync", [admin]);
claim = await rpc("claim_exercise_sync_page", [run.id]);
run = await batch(claim, [
  core.normalizeExercise({
    ...exercise,
    name: "bench press updated",
    instructions: ["New external instruction"],
  }),
]);
assert.equal(run.ignored_count, 1);
assert.equal(run.new_count, 0);
assert.equal(
  (
    await db.query("SELECT * FROM exercises WHERE source='exercisedb' AND external_id=$1", [
      exercise.exerciseId,
    ])
  ).rows.length,
  1,
);
await asUser(a);
await rpc("save_workout_snapshot", [payload]);
assert.equal(
  (await db.query("SELECT * FROM set_logs")).rows.length,
  1,
  "archiving does not break training snapshots",
);
await asService();
run = await rpc("begin_exercise_sync", [admin]);
claim = await rpc("claim_exercise_sync_page", [run.id]);
await batch(claim, [
  core.normalizeExercise({
    ...exercise,
    name: "New anatomy pending",
    secondaryMuscles: ["hip flexors"],
  }),
]);
const held = (await db.query("SELECT * FROM exercises WHERE id=$1", [official.id])).rows[0];
assert.equal(held.review_status, "approved");
assert.equal(held.nome, "Supino oficial revisado");
assert.deepEqual(held.musculos_secundarios, ["shoulders", "triceps"]);
assert.deepEqual(held.unmapped_muscles, ["hip flexors"]);
await asUser(a);
await rpc("save_workout_snapshot", [payload]);
assert.equal(
  (await db.query("SELECT * FROM set_logs")).rows.length,
  1,
  "new unknown metadata does not break an existing workout",
);

await asService();
run = await rpc("begin_exercise_sync", [admin]);
claim = await rpc("claim_exercise_sync_page", [run.id]);
const more = Array.from({ length: 25 }, (_, i) =>
  core.normalizeExercise({
    ...exercise,
    exerciseId: "paged" + i,
    name: "Paged exercise " + String(i).padStart(2, "0"),
  }),
);
await batch(claim, more);
await asUser(b);
const first = await rpc("search_exercises", [
  "Paged",
  "{}",
  null,
  null,
  null,
  null,
  null,
  0,
  20,
  false,
]);
const second = await rpc("search_exercises", [
  "Paged",
  "{}",
  null,
  null,
  null,
  null,
  null,
  1,
  20,
  false,
]);
assert.equal(first.total, 25);
assert.equal(first.items.length, 20);
assert.equal(second.items.length, 5);
assert(!first.items.some((a) => second.items.some((b) => a.id === b.id)));
assert.equal(first.items[0].external_data, undefined);
const facets = await rpc("exercise_catalog_facets");
assert(facets.equipments.includes("barbell"));
await db.close();
console.log(
  "PASS: real migrations, two-user privacy/public access, admin isolation, forged origin/RPC rejection, sync leases/checkpoints/retries, deduplication, idempotence, preserved internal overrides, pending review, indexed search, server pagination, official workout completion and primary snapshots.",
);
