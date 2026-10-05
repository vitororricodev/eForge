import fs from "node:fs";
import assert from "node:assert/strict";
import { database, asOwner, USER_A, WORKOUT } from "./helpers/owned-database.mjs";
const version = "20261003150000",
  sql = fs.readFileSync(
    "maintenance/" + version + "_workout_sharing_order_profile_manual.sql",
    "utf8",
  );
assert.equal(
  sql.split("$eforge_body_" + version + "$")[1].trim(),
  fs
    .readFileSync("supabase/migrations/" + version + "_workout_sharing_order_profile.sql", "utf8")
    .trim(),
);
const db = await database([version]);
const oldTime = "2026-09-01T10:00:00Z";
await db.exec("ALTER TABLE profiles DISABLE TRIGGER profiles_touch");
await db.query("UPDATE profiles SET sex='male',updated_at=$2 WHERE id=$1", [USER_A, oldTime]);
await db.exec("ALTER TABLE profiles ENABLE TRIGGER profiles_touch");
await db.query("INSERT INTO workouts(user_id,nome,created_at) VALUES($1,$2,$3)", [
  USER_A,
  "Treino antigo",
  "2025-01-01",
]);
await db.exec(sql);
await db.exec(sql);
const rows = (
  await db.query("SELECT id,ordem FROM workouts WHERE user_id=$1 ORDER BY ordem", [USER_A])
).rows;
assert.equal(rows[0].id, WORKOUT);
assert.deepEqual(
  rows.map((r) => r.ordem),
  [0, 1],
  "existing date order preserved",
);
const profile = (await db.query("SELECT sex,updated_at FROM profiles WHERE id=$1", [USER_A]))
  .rows[0];
assert.equal(profile.sex, "masculino");
assert.equal(
  new Date(profile.updated_at).toISOString(),
  new Date(oldTime).toISOString(),
  "sex migration preserves weight timestamp",
);
assert.equal(
  (
    await db.query(
      "SELECT count(*) c FROM supabase_migrations.schema_migrations WHERE version=$1",
      [version],
    )
  ).rows[0].c,
  1,
);
await db.query("DELETE FROM supabase_migrations.schema_migrations WHERE version=$1", [version]);
await db.exec(sql);
assert.equal(
  (
    await db.query(
      "SELECT count(*) c FROM supabase_migrations.schema_migrations WHERE version=$1",
      [version],
    )
  ).rows[0].c,
  1,
);
await db.exec("DROP FUNCTION get_shared_workout(text)");
await assert.rejects(db.exec(sql), /estrutura incompleta/);
await db.exec("ROLLBACK");
await db.close();
const partial = await database([version]);
await asOwner(partial);
await partial.exec("ALTER TABLE workouts ADD COLUMN ordem integer");
await assert.rejects(partial.exec(sql), /Estrutura parcial/);
await partial.exec("ROLLBACK");
await partial.close();
console.log(
  "PASS: new manual SQL matches migration, preserves date order/sex history, records once, replays and rejects partial structures.",
);
