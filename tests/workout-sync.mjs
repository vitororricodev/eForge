import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const moduleURL = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const storageURL = moduleURL(compile("src/lib/workout-storage.ts"));
const { readDraft, saveDraft } = await import(storageURL);
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
};
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
const account = { data: { session: { user: { id: "a" } } } };
const payloads = [];
let getSession = async () => account;
let rpc = async (_name, input) => {
  payloads.push(input.payload);
  return { error: null };
};
globalThis.workoutTestSupabase = {
  auth: { getSession: () => getSession() },
  rpc: (...args) => rpc(...args),
};
let source = compile("src/lib/workout-sync.ts")
  .replace(/import \{ supabase \} from [^;]+;/, "const supabase = globalThis.workoutTestSupabase;")
  .replace(/from ["']\.\/workout-storage["']/, `from "${storageURL}"`);
const { syncDraft } = await import(moduleURL(source));
const exercises = Array.from({ length: 5 }, (_, index) => ({
  plan_item_id: `slot-${index}`,
  exercise_id: `exercise-${index}`,
  nome: `Exercício ${index + 1}`,
  musculo_principal: "chest",
  musculos_secundarios: ["triceps"],
  descanso_seg: 90,
  sets: [{ id: `set-${index}`, reps: "10", carga: "12,5", done: index === 0, kind: "normal" }],
}));
const draft = saveDraft({
  id: "session-a",
  userId: "a",
  workoutId: "workout-a",
  name: "Treino A",
  started: 1000,
  restUntil: 0,
  exercises,
  plannedExercises: structuredClone(exercises),
});
let releaseAuth;
getSession = () =>
  new Promise((resolve) => {
    releaseAuth = resolve;
  });
const syncing = syncDraft({ ...draft, exercises: draft.exercises.slice(0, 2) });
assert.equal(await syncDraft(draft), false, "Only one snapshot may be in flight");
const updated = structuredClone(draft);
updated.exercises[1].sets[0].reps = "12";
saveDraft(updated);
releaseAuth(account);
assert.equal(await syncing, true);
assert.equal(
  payloads[0].sets.length,
  5,
  "Sync all pending exercises, not only completed/current ones",
);
assert.equal(payloads[0].sets[1].repeticoes, 12, "Use the latest draft after awaiting auth");
assert.equal(payloads[0].sets[0].carga_kg, 12.5);
assert.equal(payloads[0].sets[2].concluida, false);
assert.equal(payloads[0].sets[0].id, "set-0");
getSession = async () => account;
const finalDraft = saveDraft({ ...readDraft("a"), finished: 100000 });
let releaseRPC;
rpc = (_name, input) => {
  payloads.push(input.payload);
  return new Promise((resolve) => {
    releaseRPC = resolve;
  });
};
const finalSync = syncDraft(finalDraft);
await new Promise((resolve) => setTimeout(resolve, 0));
const newer = structuredClone(readDraft("a"));
newer.exercises[0].sets[0].carga = "30";
saveDraft(newer);
releaseRPC({ error: null });
assert.equal(await finalSync, true);
assert.equal(
  readDraft("a").synced,
  undefined,
  "An old acknowledgement must not mark newer edits synced",
);
assert.equal(
  readDraft("a").exercises[0].sets[0].carga,
  "30",
  "Acknowledgement must not overwrite local progress",
);
rpc = async (_name, input) => {
  payloads.push(input.payload);
  return { error: null };
};
assert.equal(await syncDraft(readDraft("a")), true);
assert.equal(readDraft("a").synced, true);
assert.equal(payloads.at(-1).sets[0].carga_kg, 30);
const syncedCount = payloads.length;
assert.equal(await syncDraft(readDraft("a")), true);
assert.equal(payloads.length, syncedCount, "Do not resend an already-synced finished snapshot");

saveDraft({ ...draft, id: "next-session" });
assert.equal(
  await syncDraft(draft),
  false,
  "Never send a replaced session from a delayed callback",
);
getSession = async () => ({ data: { session: { user: { id: "b" } } } });
assert.equal(await syncDraft(readDraft("a")), false, "Do not sync across account changes");
getSession = async () => account;
navigator.onLine = false;
assert.equal(await syncDraft(readDraft("a")), false);
navigator.onLine = true;
rpc = async () => ({ error: new Error("network error") });
await assert.rejects(syncDraft(readDraft("a")), /network error/);
rpc = async () => ({ error: null });
assert.equal(
  await syncDraft(readDraft("a")),
  true,
  "A failed request must release the sync lock for retry",
);
const { plannedExercises, ...legacy } = readDraft("a");
legacy.id = "legacy-incomplete";
saveDraft(legacy);
assert.equal(
  await syncDraft(legacy),
  false,
  "Check legacy plans before a snapshot can erase pending logs",
);
console.log(
  "PASS: current complete snapshots, auth/request races, stable set IDs, decimal payloads, revision-aware acknowledgements, offline/account/session isolation and retry after errors.",
);
