import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import { loadOwnedModule } from "../scripts/lib/owned-modules.mjs";
const core = await loadOwnedModule("owned-gif-manifest"),
  { importGifLibrary } = await loadOwnedModule("owned-gif-import");
const csv = fs.readFileSync("catalog/manifest_gifs_categorizados.csv", "utf8"),
  manifest = core.parseGifManifest(csv);
assert.equal(manifest.entries.length, 611);
assert.equal(manifest.aliases, 14);
assert.deepEqual(manifest.errors, []);
assert.deepEqual(
  Object.fromEntries(
    Object.keys(core.LIBRARY_CATEGORIES).map((c) => [
      c,
      manifest.entries.filter((e) => e.category === c).length,
    ]),
  ),
  {
    abdomen: 66,
    biceps: 73,
    costas: 76,
    deltoides: 43,
    inferiores: 187,
    panturrilha: 20,
    peitoral: 100,
    triceps: 46,
  },
);
assert.equal(manifest.entries.filter((e) => e.confidence === "media").length, 33);
assert.equal(manifest.entries.filter((e) => !e.primary).length, 9);
assert.deepEqual(
  core.parseGifManifest(fs.readFileSync("catalog/manifest.json", "utf8")).entries,
  manifest.entries,
);
assert.equal(core.csvRows('a,b\r\n"nome, um","um""dois"\r\n')[1][1], 'um"dois');
assert.throws(() => core.csvRows('a,b\n"bad'), /aspas/);
assert.throws(() => core.parseGifManifest("name,path\nA,a.gif"), /manifesto categorizado/);
const first = manifest.entries[0];
for (const change of [
  { path: "../bad.gif" },
  { primary: "adutores" },
  { secondary: ["made_up"] },
  { category: "fake" },
  { sha256: "bad" },
  { bytes: 9_000_000 },
  { name: "arquivo.gif" },
])
  assert.throws(() => core.validateGifEntry({ ...first, ...change }));
const invalid = core.parseGifManifest(
  JSON.stringify({ version: 1, entries: [first, { ...first, sha256: "bad" }] }),
);
assert.equal(invalid.entries.length, 1);
assert.equal(invalid.errors.length, 1);
const collision = manifest.entries.filter((e) => e.slug === "paralelas");
assert.equal(collision.length, 2);
assert.notEqual(core.gifCatalogSlug(collision[0]), core.gifCatalogSlug(collision[1]));

// Real importer with fake network boundary. Content hashing and state transitions are real.
const bytes = new Uint8Array(Buffer.from("GIF89aFAKE-TEST-CONTENT"));
const entry = {
  ...first,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
const entry2 = {
  ...entry,
  name: "Outro exercício",
  slug: "outro-exercicio",
  path: "abdomen/abdomen/outro-exercicio.gif",
  sha256: "1".repeat(64),
};
let uploaded = 0,
  saved = 0,
  inspect = 0,
  exists = false,
  deleted = false;
const adapter = {
  inspect: async (items) => {
    inspect++;
    return items.map((e) => ({
      ...e,
      id: exists ? "id" : null,
      deleted,
      asset_exists: exists,
      bytes: exists ? bytes.length : null,
      mime: exists ? "image/gif" : null,
    }));
  },
  upload: async () => {
    uploaded++;
  },
  save: async () => {
    saved++;
    exists = true;
    return { id: "id", status: "created", deleted: false };
  },
  publicUrl: (p) => "https://test.invalid/" + p,
};
const source = async function* (entries) {
  for (const e of entries) yield { path: e.path, bytes };
};
let result = await importGifLibrary(
  [entry, entry2],
  source,
  adapter,
  new AbortController().signal,
  () => {},
);
assert.equal(result.created, 1);
assert.equal(result.errors.length, 1);
assert.equal(result.processed, 2);
assert.equal(uploaded, 1);
assert.equal(saved, 1);
result = await importGifLibrary([entry], source, adapter, new AbortController().signal, () => {});
assert.equal(result.existing, 1);
assert.equal(uploaded, 1);
assert.equal(saved, 1);
deleted = true;
result = await importGifLibrary([entry], source, adapter, new AbortController().signal, () => {});
assert.equal(result.deleted, 1);
assert.equal(saved, 1, "reimport does not restore deleted records");
exists = false;
const abort = new AbortController();
result = await importGifLibrary([entry, entry2], source, adapter, abort.signal, (r) => {
  if (r.processed === 1) abort.abort();
});
assert.equal(result.paused, true);
assert.equal(result.processed, 1);
exists = false;
result = await importGifLibrary(
  [entry],
  async function* () {},
  adapter,
  new AbortController().signal,
  () => {},
);
assert.equal(result.errors[0].path, entry.path);
assert.equal(result.processed, 1);
const raced = {
  ...adapter,
  inspect: async (items) =>
    items.map((i) => ({
      ...i,
      id: null,
      deleted: false,
      asset_exists: ++inspect > 1,
      bytes: bytes.length,
      mime: "image/gif",
    })),
  upload: async () => {
    throw new Error("Response lost");
  },
};
inspect = 0;
result = await importGifLibrary([entry], source, raced, new AbortController().signal, () => {});
assert.equal(result.errors.length, 0);
assert.equal(result.created, 1);
await assert.rejects(core.verifyGifBytes({ ...entry, bytes: 22 }, bytes));

// Exercise the same bounded ZIP reader used by the mobile importer.
const { indexGifZip, zipGifSource } = await loadOwnedModule("owned-gif-zip");
for (const level of [0, 6]) {
  const archive = new Blob([
    zipSync({ [entry.path]: bytes, "unrelated/ignored.gif": bytes }, { level }),
  ]);
  assert.equal((await indexGifZip(archive)).length, 2);
  const extracted = [],
    errors = [];
  for await (const file of zipGifSource(archive)(
    [entry],
    new AbortController().signal,
    (path, message) => errors.push({ path, message }),
  )) {
    extracted.push(file);
    await core.verifyGifBytes(entry, file.bytes);
  }
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].path, entry.path);
  assert.deepEqual(errors, []);
}
const zipErrors = [];
const ambiguous = new Blob([zipSync({ [entry.path]: bytes, ["wrapper/" + entry.path]: bytes })]);
for await (const file of zipGifSource(ambiguous)(
  [entry],
  new AbortController().signal,
  (path, message) => zipErrors.push({ path, message }),
))
  assert.fail("Ambiguous ZIP must not yield a GIF: " + file.path);
assert.match(zipErrors[0].message, /duplicado/);
await assert.rejects(indexGifZip(new Blob([bytes])), /ZIP/);

// There is no operational external catalog code or command in the delivered runtime.
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
for (const file of [...files("src"), ...files("scripts")]) {
  const data = fs.readFileSync(file, "utf8");
  assert(
    !/oss\.exercisedb\.dev|functions\.invoke\(["'](?:sync-exercisedb|translate-exercises)|EXERCISEDB_USAGE_MODE|EFORGE_SYNC_MAX_PAGES|GOOGLE_TRANSLATE_API_KEY/.test(
      data,
    ),
    file,
  );
}
assert(!fs.existsSync("supabase/functions/sync-exercisedb/index.ts"));
assert(!JSON.parse(fs.readFileSync("package.json")).scripts["exercisedb:sync"]);
console.log(
  "PASS: 611 classified entries, aliases, confidence, categories, path validation, hash/slug identity, partial failures, pause, resume, no resurrection and no external catalog calls.",
);
