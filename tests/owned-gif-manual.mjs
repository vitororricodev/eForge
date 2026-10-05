import fs from "node:fs";
import assert from "node:assert/strict";
import { database, rpc, asUser, ADMIN } from "./helpers/owned-database.mjs";
const db = await database(["20261002180000", "20261002200000", "20261002201000", "20261003150000"]);
await db.exec(
  "CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('20261002120000','exercisedb_catalog'),('20261002121000','catalog_training_snapshot');",
);
const sql = fs.readFileSync("maintenance/20261002200000_owned_gif_library_manual.sql", "utf8");
for (const name of [
  "20261002180000_catalog_management.sql",
  "20261002200000_owned_gif_library.sql",
  "20261002201000_retire_external_catalog.sql",
]) {
  const marker = "$eforge_body_" + name.split("_")[0] + "$";
  assert.equal(
    sql.split(marker)[1].trim(),
    fs.readFileSync("supabase/migrations/" + name, "utf8").trim(),
    "Manual SQL must contain the same migration body: " + name,
  );
}
await db.exec(sql);
await db.exec(sql);
assert.equal(
  (await db.query("SELECT count(*) c FROM supabase_migrations.schema_migrations")).rows[0].c,
  5,
);
await asUser(db, ADMIN);
assert.equal(
  (await rpc(db, "owned_catalog_report")).state.legacy_disabled,
  false,
  "applying schema does not retire old catalog before import",
);
await db.exec(
  "RESET ROLE;INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('manual-marker','untouched');DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('20261002180000','20261002200000','20261002201000');",
);
await db.exec(sql);
assert.equal(
  (
    await db.query(
      "SELECT count(*) c FROM supabase_migrations.schema_migrations WHERE version='manual-marker'",
    )
  ).rows[0].c,
  1,
);
await db.exec("DROP FUNCTION public.activate_owned_gif_library(text[])");
await assert.rejects(db.exec(sql), /estrutura incompleta/);
await db.exec("ROLLBACK");
await db.close();
const partial = await database([
  "20261002180000",
  "20261002200000",
  "20261002201000",
  "20261003150000",
]);
await partial.exec(
  "CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20261002120000'),('20261002121000');ALTER TABLE exercises ADD COLUMN catalog_deleted_at timestamptz;",
);
await assert.rejects(partial.exec(sql), /Estrutura parcial/);
await partial.exec("ROLLBACK");
await partial.close();
console.log(
  "PASS: manual SQL installs only pending structures, preserves history, records complete manual applications, replays safely and rejects partial schema.",
);
