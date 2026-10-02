import assert from "node:assert/strict";
import fs from "node:fs";
import { loadOwnedModule } from "../scripts/lib/owned-modules.mjs";
import {
  database,
  asUser,
  asOwner,
  rpc,
  USER_A,
  USER_B,
  ADMIN,
  WORKOUT,
} from "./helpers/owned-database.mjs";
const core = await loadOwnedModule("owned-gif-manifest"),
  entries = core.parseGifManifest(
    fs.readFileSync("catalog/manifest_gifs_categorizados.csv", "utf8"),
  ).entries;
const db = await database();
const custom = "44444444-4444-4444-8444-444444444444",
  oldUsed = "55555555-5555-4555-8555-555555555555",
  oldUnused = "66666666-6666-4666-8666-666666666666";
await db.query(
  "INSERT INTO exercises(id,user_id,nome,tipo_controle,musculo_principal,categoria) VALUES($1,$2,'Personalizado','peso_kg','chest','musculacao')",
  [custom, USER_A],
);
for (const id of [oldUsed, oldUnused])
  await db.query(
    "INSERT INTO exercises(id,user_id,source,external_id,visibility,nome,tipo_controle,categoria,musculo_principal,musculos_primarios,musculos_secundarios) VALUES($1::uuid,NULL,'exercisedb',$1::text,'public','Antigo','peso_kg','musculacao','chest',ARRAY['chest'],ARRAY['triceps'])",
    [id],
  );
await asUser(db, USER_A);
await rpc(db, "add_exercise_to_workout", [WORKOUT, oldUsed]);
const now = new Date().toISOString(),
  snapshot = {
    id: "77777777-7777-4777-8777-777777777777",
    workout_id: WORKOUT,
    nome_treino: "Treino A",
    iniciado_em: now,
    finalizado_em: now,
    volume_total: 100,
    sets: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        exercise_id: oldUsed,
        nome_exercicio: "Supino antigo",
        musculo_principal: "chest",
        musculos_primarios: ["chest"],
        musculos_secundarios: ["triceps"],
        musculos_terciarios: ["shoulders"],
        serie_numero: 1,
        repeticoes: 10,
        carga_kg: 10,
        concluida: true,
        kind: "normal",
      },
    ],
  };
await rpc(db, "save_workout_snapshot", [snapshot]);
await assert.rejects(rpc(db, "import_owned_gif", [entries[0], "https://test.invalid"]), /Admin/);
await assert.rejects(rpc(db, "inspect_owned_gif_assets", [[]]), /Admin/);
await assert.rejects(rpc(db, "activate_owned_gif_library", [[entries[0].sha256]]), /Admin/);
await assert.rejects(rpc(db, "admin_owned_catalog_page"), /Admin/);
await assert.rejects(rpc(db, "delete_catalog_exercises", [[], true]), /Admin/);
const path = core.gifStoragePath(entries[0]);
await assert.rejects(
  db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('exercise-media',$1,$2)", [
    path,
    { size: entries[0].bytes, mimetype: "image/gif" },
  ]),
  /row-level/,
);
await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('exercise-media',$1)", [
  USER_A + "/personal.gif",
]);
await asUser(db, USER_B);
assert.equal((await db.query("SELECT id FROM exercises WHERE id=$1", [custom])).rows.length, 0);
await asUser(db, ADMIN);
for (const invalid of [
  { ...entries[0], category: null },
  { ...entries[0], name: "   " },
])
  await assert.rejects(
    rpc(db, "import_owned_gif", [invalid, "https://test.invalid"]),
    /Invalid owned/,
  );
assert.equal(
  (await db.query("SELECT id FROM exercises WHERE id=$1", [custom])).rows.length,
  0,
  "admin cannot browse another user private exercise",
);
await assert.rejects(
  rpc(db, "activate_owned_gif_library", [[entries[0].sha256]]),
  /ainda tem GIFs/,
);
assert.equal(
  (await db.query("SELECT count(*) c FROM exercises WHERE source='exercisedb'")).rows[0].c,
  2,
  "failed cutover leaves old catalog intact",
);
await assert.rejects(
  rpc(db, "import_owned_gif", [
    entries[0],
    "https://project.supabase.co/storage/v1/object/public/exercise-media/" + path,
  ]),
  /não encontrado/,
);
let created = 0;
// All 611 metadata records through the real RPC; Storage objects have realistic metadata.
for (const entry of entries) {
  const path = core.gifStoragePath(entry);
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('exercise-media',$1,$2)",
    [path, { size: entry.bytes, mimetype: "image/gif" }],
  );
  const res = await rpc(db, "import_owned_gif", [
    entry,
    "https://project.supabase.co/storage/v1/object/public/exercise-media/" + path,
  ]);
  assert.equal(res.status, "created");
  created++;
}
assert.equal(created, 611);
let report = await rpc(db, "owned_catalog_report", [entries.map((e) => e.sha256), true]);
assert.equal(report.imported, 611);
assert.equal(report.storage_files, 611);
assert.equal(report.available, 611);
assert.deepEqual(report.missing, []);
assert.equal(report.confidence.media, 33);
assert.equal(report.reviews.length, 611);
assert.deepEqual(report.categories, {
  abdomen: 66,
  biceps: 73,
  costas: 76,
  deltoides: 43,
  inferiores: 187,
  panturrilha: 20,
  peitoral: 100,
  triceps: 46,
});
let first = (await db.query("SELECT * FROM exercises WHERE gif_sha256=$1", [entries[0].sha256]))
  .rows[0];
assert.equal(first.source, "eforge");
assert.equal(first.musculo_principal, "abs");
assert.deepEqual(first.musculos_secundarios, ["obliques"]);
assert.deepEqual(first.musculos_terciarios, []);
const unmapped = (
  await db.query(
    "SELECT * FROM exercises WHERE gif_sha256 IS NOT NULL AND musculo_principal='' LIMIT 1",
  )
).rows[0];
assert.deepEqual(unmapped.musculos_primarios, []);
assert(unmapped.unmapped_muscles.length > 0);
assert.equal((await rpc(db, "import_owned_gif", [entries[0], "ignored"])).status, "existing");
assert.equal((await rpc(db, "owned_catalog_report")).imported, 611);
await db.query(
  "UPDATE exercises SET nome='Nome revisado',musculos_terciarios=ARRAY['triceps'],classification_reviewed=true WHERE id=$1",
  [first.id],
);
await rpc(db, "import_owned_gif", [entries[0], "ignored"]);
assert.equal(
  (await db.query("SELECT nome FROM exercises WHERE id=$1", [first.id])).rows[0].nome,
  "Nome revisado",
);
assert.equal((await rpc(db, "admin_owned_catalog_page", ["", "peitoral"])).total, 100);
assert.equal(
  (
    await rpc(db, "admin_owned_catalog_page", [
      "",
      null,
      null,
      null,
      null,
      "eforge",
      null,
      "all",
      0,
      20,
      true,
    ])
  ).matching_ids.length,
  611,
);
await assert.rejects(
  db.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1", [path]).then((r) => {
    if (!r.affectedRows) throw new Error("protected");
  }),
  /protected|row-level/,
);
assert.equal(
  (await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING *", [path])).rows.length,
  0,
  "referenced GIF cannot be deleted even by admin",
);
await assert.rejects(
  db.query("UPDATE exercises SET gif_path='official/fake.gif' WHERE id=$1", [first.id]),
  /imutável/,
);
await assert.rejects(rpc(db, "delete_catalog_exercises", [[custom], false]), /Official/);
assert.equal(await rpc(db, "delete_catalog_exercises", [[first.id], false]), 1);
await rpc(db, "import_owned_gif", [entries[0], "ignored"]);
assert.equal(
  (await db.query("SELECT active FROM exercises WHERE id=$1", [first.id])).rows[0].active,
  false,
);
await assert.rejects(
  rpc(db, "activate_owned_gif_library", [entries.map((e) => e.sha256)]),
  /ainda tem GIFs/,
);
await rpc(db, "restore_catalog_exercise", [first.id]);
await rpc(db, "set_owned_exercise_active", [first.id, false]);
await assert.rejects(
  rpc(db, "activate_owned_gif_library", [entries.map((e) => e.sha256)]),
  /ainda tem GIFs/,
);
await rpc(db, "set_owned_exercise_active", [first.id, true]);
// Critical transition: unreferenced removed, referenced archived, original IDs/logs intact.
report = await rpc(db, "activate_owned_gif_library", [entries.map((e) => e.sha256)]);
assert.equal(report.state.legacy_disabled, true);
assert.equal(report.state.removed_count, 1);
assert.equal(report.state.archived_count, 1);
assert.equal((await db.query("SELECT id FROM exercises WHERE id=$1", [oldUnused])).rows.length, 0);
assert.equal(
  (await db.query("SELECT active FROM exercises WHERE id=$1", [oldUsed])).rows[0].active,
  false,
);
assert.equal(
  (await rpc(db, "activate_owned_gif_library", [entries.map((e) => e.sha256)])).state.removed_count,
  1,
  "activation replay does not erase counters",
);
await assert.rejects(rpc(db, "restore_catalog_exercise", [oldUsed]), /descontinuada/);
await asOwner(db);
assert.equal((await db.query("SELECT id FROM exercises WHERE id=$1", [custom])).rows.length, 1);
assert.equal(
  (await db.query("SELECT * FROM workout_exercises WHERE exercise_id=$1", [oldUsed])).rows.length,
  1,
);
await db.exec("SET ROLE service_role;SET request.jwt.claim.sub=''");
await assert.rejects(rpc(db, "begin_exercise_sync", [ADMIN]), /permission denied/);
await assert.rejects(rpc(db, "begin_catalog_translation", [ADMIN, [], true]), /permission denied/);
await assert.rejects(
  db.query(
    "INSERT INTO exercises(source,user_id,external_id,visibility,nome,tipo_controle,categoria,musculo_principal) VALUES('exercisedb',NULL,'recreated','public','Bad','repeticoes','funcional','chest')",
  ),
  /descontinuada/,
);
await asUser(db, USER_A);
assert.equal((await rpc(db, "search_exercises")).total, 612);
assert.equal((await rpc(db, "search_exercises_v2", ["", [], null, "peitoral"])).total, 100);
assert(
  (
    await rpc(db, "search_exercises_v2", [
      "",
      [],
      null,
      null,
      null,
      null,
      "eforge",
      0,
      20,
      false,
      "chest",
      "triceps",
    ])
  ).total > 0,
);
const page = await rpc(db, "search_exercises_v2", [
  "",
  [],
  null,
  null,
  null,
  null,
  "eforge",
  1,
  20,
]);
assert.equal(page.items.length, 20);
await rpc(db, "save_workout_snapshot", [snapshot]);
let logs = (await db.query("SELECT * FROM set_logs WHERE exercise_id=$1", [oldUsed])).rows;
assert.equal(logs.length, 1);
assert.deepEqual(logs[0].musculos_terciarios, ["shoulders"]);
assert.deepEqual(logs[0].musculos_secundarios, ["triceps"]);
const supino = (
  await db.query(
    "SELECT * FROM exercises WHERE source='eforge' AND musculo_principal='chest' AND musculos_secundarios @> ARRAY['triceps','shoulders'] LIMIT 1",
  )
).rows[0];
const id = await rpc(db, "add_exercise_to_workout", [WORKOUT, supino.id]);
assert.equal(await rpc(db, "add_exercise_to_workout", [WORKOUT, supino.id]), id);
const newSnapshot = {
  ...snapshot,
  id: "99999999-9999-4999-8999-999999999999",
  sets: [
    {
      ...snapshot.sets[0],
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      exercise_id: supino.id,
      nome_exercicio: supino.nome,
      musculo_principal: supino.musculo_principal,
      musculos_primarios: supino.musculos_primarios,
      musculos_secundarios: supino.musculos_secundarios,
      musculos_terciarios: [],
    },
  ],
};
await rpc(db, "save_workout_snapshot", [newSnapshot]);
await rpc(db, "save_workout_snapshot", [newSnapshot]);
assert.equal(
  (await db.query("SELECT * FROM set_logs WHERE exercise_id=$1", [supino.id])).rows.length,
  1,
);
await asUser(db, ADMIN);
assert.equal(await rpc(db, "delete_catalog_exercises", [[], true]), 611);
await asUser(db, USER_A);
assert.equal((await rpc(db, "search_exercises")).total, 1);
await rpc(db, "save_workout_snapshot", [newSnapshot]);
assert.equal(
  (await db.query("SELECT * FROM workout_exercises WHERE exercise_id=$1", [supino.id])).rows.length,
  1,
);
await assert.rejects(rpc(db, "add_exercise_to_workout", [WORKOUT, supino.id]), /unavailable/);
await asUser(db, USER_B);
assert.equal((await db.query("SELECT * FROM set_logs")).rows.length, 0);
await db.close();
console.log(
  "PASS: 611 imports, duplicate prevention, RLS/admin/private/public, Storage protection, filters/paging, soft deletion/restoration, critical legacy cutover, RPC revocation, historical and new workout snapshots.",
);
