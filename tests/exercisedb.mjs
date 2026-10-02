import assert from "node:assert/strict";
import { core, handler, exercise } from "./helpers/exercisedb.mjs";
const parsed = core.parseExercise(exercise);
const normalized = core.normalizeExercise(parsed);
assert.equal(normalized.musculo_principal, "chest");
assert.deepEqual(normalized.musculos_primarios, ["chest"]);
assert.deepEqual(normalized.musculos_secundarios, ["shoulders", "triceps"]);
assert.equal(normalized.review_status, "approved");
assert.equal("musculos_terciarios" in normalized, false);
assert.equal("dificuldade" in normalized, false);
assert.equal("name_pt_br" in normalized, false);
const multi = core.normalizeExercise({
  ...parsed,
  targetMuscles: ["pectorals", "triceps", "pectorals"],
  secondaryMuscles: ["triceps", "biceps"],
});
assert.deepEqual(multi.musculos_primarios, ["chest", "triceps"]);
assert.deepEqual(multi.musculos_secundarios, ["biceps"]);
const unknown = core.normalizeExercise({ ...parsed, secondaryMuscles: ["hip flexors", "core"] });
assert.equal(unknown.review_status, "pending");
assert.deepEqual(unknown.unmapped_muscles, ["hip flexors", "core"]);
const reviewed = core.normalizeExercise({ ...parsed, secondaryMuscles: ["hip flexors"] }, [
  ...core.DEFAULT_MUSCLE_MAPPING,
  { source_name: "hip flexors", muscle_keys: [], status: "unsupported" },
]);
assert.equal(reviewed.review_status, "approved");
assert.deepEqual(reviewed.musculos_secundarios, []);
assert.throws(() => core.parseExercise({ ...exercise, targetMuscles: "pectorals" }));
assert.throws(() => core.parseExercise({ ...exercise, gifUrl: "javascript:alert(1)" }));
assert.throws(() => core.parsePage({ success: false, meta: {}, data: [] }));
assert.throws(() =>
  core.parsePage({ success: true, meta: { total: 10, hasNextPage: true }, data: [exercise] }),
);
let attempts = 0;
const waits = [];
const page = await core.fetchExercisePage("previous-id", {
  wait: async (ms) => waits.push(ms),
  fetcher: async (url) => {
    assert.equal(url.searchParams.get("after"), "previous-id");
    assert.equal(url.searchParams.get("limit"), "25");
    attempts++;
    return attempts === 1
      ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
      : Response.json({ success: true, meta: { total: 1, hasNextPage: false }, data: [exercise] });
  },
});
assert.equal(attempts, 2);
assert.equal(waits[0], 2000);
assert.equal(page.values.length, 1);
let permanentCalls = 0;
await assert.rejects(
  core.fetchExercisePage(null, {
    fetcher: async () => {
      permanentCalls++;
      return new Response("", { status: 401 });
    },
    wait: async () => {},
  }),
);
assert.equal(permanentCalls, 1);
await assert.rejects(
  core.fetchExercisePage(null, {
    attempts: 1,
    timeoutMs: 5,
    fetcher: async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("timeout"))),
      ),
  }),
);
let writes = 0;
let identity = null;
const run = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "running",
  received: 0,
  new_count: 0,
  updated_count: 0,
  ignored_count: 0,
  error_count: 0,
  total: null,
  cursor: null,
  has_next: true,
  started_at: new Date().toISOString(),
  finished_at: null,
  last_error: null,
  errors: [],
  lease_token: "token",
};
const repo = {
  begin: async () => {
    writes++;
    return run;
  },
  claim: async () => run,
  mappings: async () => core.DEFAULT_MUSCLE_MAPPING,
  apply: async (input) => {
    writes++;
    assert.equal(input.records[0].musculo_principal, "chest");
    return { ...run, status: "completed", received: 1, new_count: 1, has_next: false };
  },
  release: async () => {},
  cancel: async () => {
    writes++;
  },
};
const api = handler.createSyncHandler({
  authenticate: async () => identity,
  repository: repo,
  usageAllowed: true,
  pageFetcher: async () => page,
});
const req = (body) =>
  new Request("https://example.invalid/sync-exercisedb", {
    method: "POST",
    headers: { Authorization: "Bearer test-only" },
    body: JSON.stringify(body),
  });
assert.equal(
  (await api(new Request("https://example.invalid", { method: "POST", body: "{}" }))).status,
  401,
);
assert.equal((await api(req({ action: "start" }))).status, 401);
identity = { id: "user", isAdmin: false };
assert.equal((await api(req({ action: "start" }))).status, 403);
assert.equal(writes, 0);
identity = { id: "admin", isAdmin: true };
assert.equal((await api(req({ action: "start" }))).status, 200);
const processed = await api(req({ action: "step", runId: run.id }));
assert.equal(processed.status, 200);
assert.equal((await processed.json()).lease_token, undefined);
assert.equal(writes, 2);
const gated = handler.createSyncHandler({
  authenticate: async () => identity,
  repository: repo,
  usageAllowed: false,
});
assert.equal((await gated(req({ action: "start" }))).status, 409);
assert.equal(writes, 2);
assert.equal((await api(req({ action: "step", runId: "not-a-uuid" }))).status, 400);
console.log(
  "PASS: ExerciseDB validation, source roles, multiple primary targets, missing tertiary/difficulty/translation, unknown review, pagination, timeout, retry and administrator-only endpoint.",
);
