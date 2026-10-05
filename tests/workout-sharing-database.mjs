import assert from "node:assert/strict";
import {
  database,
  rpc,
  asUser,
  asOwner,
  USER_A,
  USER_B,
  WORKOUT,
} from "./helpers/owned-database.mjs";

const db = await database();
const pub = "77777777-7777-4777-8777-777777777777",
  priv = "88888888-8888-4888-8888-888888888888",
  own = "99999999-9999-4999-8999-999999999999";
await db.query(
  `INSERT INTO exercises(id,user_id,nome,tipo_controle,musculo_principal,musculos_primarios,musculos_secundarios,categoria,visibility,source,gif_url) VALUES
 ($1,NULL,'Supino','peso_kg','chest',ARRAY['chest'],ARRAY['triceps'],'musculacao','public','eforge','https://example.invalid/supino.gif'),
 ($2,$4,'Variação pessoal','peso_kg','biceps',ARRAY['biceps'],ARRAY['forearms'],'musculacao','private','user',NULL),
 ($3,$5,'Rosca da biblioteca','peso_kg','biceps',ARRAY['biceps'],'{}','musculacao','private','user',NULL)`,
  [pub, priv, own, USER_A, USER_B],
);
const ids = ["aaaaaaaa-1111-4111-8111-111111111111", "aaaaaaaa-2222-4222-8222-222222222222"];
const plan = [pub, priv].map((exercise_id, i) => ({
  id: ids[i],
  exercise_id,
  series: i + 3,
  repeticoes: 10 + i,
  carga_kg: i ? null : 25.5,
  descanso_seg: i ? 0 : 90,
}));
await asUser(db, USER_A);
assert.equal(
  await rpc(db, "save_workout_plan", [WORKOUT, "Peito e braços", "Plano de treino", plan]),
  WORKOUT,
);
let share = await rpc(db, "create_workout_share", [WORKOUT]);
assert.match(share.token, /^[a-f0-9]{64}$/);
await assert.rejects(
  db.query(`UPDATE workout_shares SET snapshot='{}' WHERE id=$1`, [share.id]),
  /permission denied/,
);
await assert.rejects(db.query(`SELECT snapshot FROM workout_shares`), /permission denied/);
await assert.rejects(
  db.query(`INSERT INTO workout_shares(user_id,workout_id,token,snapshot) VALUES($1,$2,$3,'{}')`, [
    USER_A,
    WORKOUT,
    "a".repeat(64),
  ]),
  /permission denied/,
);
await db.exec("RESET ROLE;SET ROLE anon;SET request.jwt.claim.sub=''");
const publicView = await rpc(db, "get_shared_workout", [share.token]);
assert.equal(publicView.nome, "Peito e braços");
assert.equal(publicView.items.length, 2);
assert.equal(
  publicView.items[1].nome,
  "Variação pessoal",
  "private exercise explicitly shared by owner appears in snapshot",
);
assert.equal(publicView.items[0].gif_url, "https://example.invalid/supino.gif");
assert(!publicView.items.some((x) => x.available));
assert(!JSON.stringify(publicView).includes(USER_A));
assert(!JSON.stringify(publicView).includes("test.invalid"));
await assert.rejects(db.query("SELECT * FROM workout_shares"), /permission denied/);
await assert.rejects(rpc(db, "create_workout_share", [WORKOUT]), /permission denied/);
await assert.rejects(
  rpc(db, "import_shared_workout", [
    share.token,
    "Cópia",
    {},
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ]),
  /permission denied/,
);
assert.equal(await rpc(db, "get_shared_workout", ["not-a-token"]), null);
assert.equal(await rpc(db, "get_shared_workout", ["a".repeat(64)]), null);

await asUser(db, USER_B);
assert.equal((await db.query("SELECT * FROM workouts WHERE id=$1", [WORKOUT])).rows.length, 0);
assert.equal((await db.query("SELECT * FROM exercises WHERE id=$1", [priv])).rows.length, 0);
assert.equal((await db.query("SELECT id FROM workout_shares")).rows.length, 0);
await assert.rejects(rpc(db, "create_workout_share", [WORKOUT]), /Treino não encontrado/);
await assert.rejects(rpc(db, "revoke_workout_share", [share.id]), /não encontrado/);
const recipientView = await rpc(db, "get_shared_workout", [share.token]);
assert(recipientView.items[0].available);
assert(!recipientView.items[1].available);
const request = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const count = async () => Number((await db.query("SELECT count(*) c FROM workouts")).rows[0].c);
const before = await count();
await assert.rejects(
  rpc(db, "import_shared_workout", [share.token, "Cópia", {}, request]),
  /substituto/,
);
await assert.rejects(
  rpc(db, "import_shared_workout", [share.token, "Cópia", { [ids[1]]: priv }, request]),
  /substituto/,
);
await assert.rejects(
  rpc(db, "import_shared_workout", [
    share.token,
    "Cópia",
    { [ids[0]]: own, [ids[1]]: own },
    request,
  ]),
  /apenas/,
);
await assert.rejects(
  rpc(db, "import_shared_workout", [share.token, "Cópia", { [ids[1]]: pub }, request]),
  /duas vezes/,
);
await assert.rejects(
  rpc(db, "import_shared_workout", [share.token, "Cópia", { "unknown-item": own }, request]),
  /desconhecida/,
);
assert.equal(await count(), before, "rejected imports leave no partial workouts");
const copied = await rpc(db, "import_shared_workout", [
  share.token,
  "Meu treino",
  { [ids[1]]: own },
  request,
]);
assert.notEqual(copied, WORKOUT);
assert.equal(
  await rpc(db, "import_shared_workout", [share.token, "Meu treino", { [ids[1]]: own }, request]),
  copied,
  "retry is idempotent",
);
const copiedRows = (
  await db.query("SELECT * FROM workout_exercises WHERE workout_id=$1 ORDER BY ordem", [copied])
).rows;
assert.deepEqual(
  copiedRows.map((x) => x.exercise_id),
  [pub, own],
);
assert.deepEqual(
  copiedRows.map((x) => [x.series, x.repeticoes, x.descanso_seg, Number(x.carga_kg ?? 0)]),
  [
    [3, 10, 90, 25.5],
    [4, 11, 0, 0],
  ],
);
assert(copiedRows.every((x) => x.user_id === USER_B && !ids.includes(x.id)));
const edit = copiedRows
  .map((x) => ({ ...x, carga_kg: x.carga_kg === null ? null : Number(x.carga_kg) }))
  .reverse();
await rpc(db, "save_workout_plan", [copied, "Meu treino editado", "", edit]);
assert.deepEqual(
  (
    await db.query("SELECT id FROM workout_exercises WHERE workout_id=$1 ORDER BY ordem", [copied])
  ).rows.map((x) => x.id),
  edit.map((x) => x.id),
  "reordering preserves item UUIDs",
);
const beforeFailedEdit = await db.query(
  "SELECT exercise_id,ordem FROM workout_exercises WHERE workout_id=$1 ORDER BY ordem",
  [copied],
);
await assert.rejects(
  rpc(db, "save_workout_plan", [copied, "Falha", "", [{ ...edit[0], series: 0 }]]),
  /Verifique/,
);
assert.deepEqual(
  (
    await db.query(
      "SELECT exercise_id,ordem FROM workout_exercises WHERE workout_id=$1 ORDER BY ordem",
      [copied],
    )
  ).rows,
  beforeFailedEdit.rows,
  "invalid edit does not delete items",
);
const second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
await rpc(db, "save_workout_plan", [
  second,
  "Outro treino",
  "",
  [{ ...plan[0], id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
]);
await rpc(db, "reorder_workouts", [[second, copied]]);
assert.deepEqual(
  (await db.query("SELECT id FROM workouts ORDER BY ordem")).rows.map((x) => x.id),
  [second, copied],
);
await assert.rejects(rpc(db, "reorder_workouts", [[copied]]), /lista de treinos mudou/);
await assert.rejects(rpc(db, "reorder_workouts", [[WORKOUT, copied]]), /lista de treinos mudou/);
await assert.rejects(rpc(db, "reorder_workouts", [[copied, copied]]), /lista de treinos mudou/);
await assert.rejects(
  rpc(db, "save_workout_plan", [WORKOUT, "Treino alheio", "", plan]),
  /row-level security|duplicate key/,
);
const profile = await rpc(db, "save_body_profile", [80.5, 180, 30, "masculino", "hipertrofia"]);
assert.equal(profile.id, USER_B);
assert.equal(Number(profile.weight_kg), 80.5);
assert.equal(profile.sex, "masculino");
await assert.rejects(
  rpc(db, "save_body_profile", [0, 180, 30, "masculino", "hipertrofia"]),
  /Verifique/,
);
await assert.rejects(
  rpc(db, "save_body_profile", [80, 180, 30, "male", "hipertrofia"]),
  /Verifique/,
);
await db.query("DELETE FROM profiles WHERE id=$1", [USER_B]); // Own DELETE isn't granted by RLS, leaves row intact.
await asOwner(db);
await db.query("DELETE FROM profiles WHERE id=$1", [USER_B]);
await asUser(db, USER_B);
assert.equal(
  (await rpc(db, "save_body_profile", [72.4, 170, 28, "feminino", "saude_geral"])).id,
  USER_B,
  "missing profile is recreated, no zero-row success",
);
await asUser(db, USER_A);
await rpc(db, "save_workout_plan", [
  WORKOUT,
  "Título novo",
  "Plano alterado",
  plan.slice().reverse(),
]);
assert.equal(
  (await rpc(db, "get_shared_workout", [share.token])).nome,
  "Peito e braços",
  "share is immutable snapshot",
);
await rpc(db, "revoke_workout_share", [share.id]);
assert.equal(await rpc(db, "get_shared_workout", [share.token]), null);
await asUser(db, USER_B);
assert.equal(await count(), before + 2, "revocation does not remove copied workouts");
await assert.rejects(
  rpc(db, "import_shared_workout", [
    share.token,
    "Outra cópia",
    { [ids[1]]: own },
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  ]),
  /não está mais disponível/,
);
await asUser(db, USER_A);
share = await rpc(db, "create_workout_share", [WORKOUT]);
const rotated = await rpc(db, "create_workout_share", [WORKOUT]);
assert.equal(await rpc(db, "get_shared_workout", [share.token]), null);
assert.equal((await rpc(db, "get_shared_workout", [rotated.token])).nome, "Título novo");
await db.query("DELETE FROM workouts WHERE id=$1", [WORKOUT]);
assert.equal(
  await rpc(db, "get_shared_workout", [rotated.token]),
  null,
  "deleted source invalidates link",
);
await asUser(db, USER_B);
assert.equal(await count(), before + 2);
await db.close();
console.log(
  "PASS: public snapshot, private RLS, copy/replacement, idempotency, atomic edit, durable order, profile upsert/sex and revocation.",
);
