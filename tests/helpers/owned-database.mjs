import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
export const USER_A = "11111111-1111-4111-8111-111111111111",
  USER_B = "22222222-2222-4222-8222-222222222222",
  ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  WORKOUT = "33333333-3333-4333-8333-333333333333";
export async function database(exclude = []) {
  const db = new PGlite();
  await db.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text,public boolean);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;`,
  );
  // Supabase grants table access by default; let each migration revoke it as in production.
  await db.exec(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated",
  );
  for (const name of fs.readdirSync("supabase/migrations").sort())
    if (!exclude.some((p) => name.startsWith(p)))
      await db.exec(fs.readFileSync("supabase/migrations/" + name, "utf8"));
  await db.exec(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA storage TO authenticated;GRANT USAGE ON SCHEMA storage TO authenticated;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY",
  );
  await db.query(
    "INSERT INTO auth.users(id,email) VALUES($1,'a@test.invalid'),($2,'b@test.invalid'),($3,'admin@test.invalid')",
    [USER_A, USER_B, ADMIN],
  );
  await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [ADMIN]);
  await db.query("INSERT INTO workouts(id,user_id,nome) VALUES($1,$2,'Treino A')", [
    WORKOUT,
    USER_A,
  ]);
  return db;
}
export const asUser = (db, id) =>
  db.exec(`RESET ROLE;SET ROLE authenticated;SET request.jwt.claim.sub='${id}'`);
export const asOwner = (db) => db.exec("RESET ROLE;SET request.jwt.claim.sub=''");
export const rpc = async (db, name, args = []) =>
  (await db.query(`SELECT ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) data`, args))
    .rows[0].data;
