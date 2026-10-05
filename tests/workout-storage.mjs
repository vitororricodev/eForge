import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
const source = ts.transpileModule(fs.readFileSync("src/lib/workout-storage.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  readDraft,
  saveDraft,
  number,
  remaining,
  totals,
  attachWorkoutPlan,
  restoreDraftExercises,
  draftKey,
} = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
};
const plan = Array.from({ length: 5 }, (_, index) => ({
  plan_item_id: `slot-${index}`,
  exercise_id: `exercise-${index}`,
  nome: `Exercício ${index + 1}`,
  musculo_principal: "chest",
  musculos_secundarios: [],
  descanso_seg: 90,
  sets: [{ id: `planned-set-${index}`, done: false, reps: "10", carga: "20", kind: "normal" }],
}));
const legacy = {
  id: "session-a",
  userId: "a",
  workoutId: "workout-a",
  name: "Treino A",
  started: 1000,
  restUntil: 90000,
  exercises: structuredClone(plan.slice(0, 2)),
};
legacy.exercises.forEach((exercise) => delete exercise.plan_item_id);
legacy.exercises[0].sets[0] = {
  id: "completed-set",
  done: true,
  reps: "10",
  carga: "12,5",
  kind: "normal",
};
saveDraft(legacy);
assert.equal(readDraft("b"), null);
assert.deepEqual(totals(legacy), { sets: 1, volume: 125 });
assert.equal(number("-1"), 0);
assert.equal(remaining(100000, 90000), 10);
assert.equal(remaining(100000, 150000), 0);
data.set(draftKey("b"), JSON.stringify(legacy));
assert.equal(readDraft("b"), null);

const recovered = attachWorkoutPlan(legacy, plan);
assert.equal(
  recovered.exercises.length,
  5,
  "Recover all untouched exercises in the same active session",
);
assert.equal(recovered.id, legacy.id);
assert.equal(recovered.started, legacy.started);
assert.equal(recovered.restUntil, legacy.restUntil);
assert.deepEqual(
  recovered.exercises[0].sets,
  legacy.exercises[0].sets,
  "Never reset logged series or UUIDs",
);
assert.equal(legacy.exercises.length, 2, "Recovery must not mutate its input");
const saved = saveDraft(recovered);
assert.equal(saved.exercises.length, 5, "Adding slot IDs must not duplicate legacy exercises");
assert.deepEqual(
  saved.exercises.map((exercise) => exercise.exercise_id),
  plan.map((exercise) => exercise.exercise_id),
);
assert.equal(
  saved.plannedExercises[0].sets[0].done,
  false,
  "Starting plan remains independent of current progress",
);

// Stale writes must keep the latest untouched/started exercise data, not reset them from the plan.
const progressed = structuredClone(saved);
progressed.exercises[4].sets[0] = { ...progressed.exercises[4].sets[0], done: true, carga: "35" };
const latest = saveDraft(progressed);
const stale = structuredClone(saved);
stale.exercises = stale.exercises.slice(0, 2);
const protectedDraft = saveDraft(stale);
assert.equal(protectedDraft.exercises.length, 5);
assert.deepEqual(protectedDraft.exercises[4].sets, latest.exercises[4].sets);
assert.equal(protectedDraft.revision, latest.revision + 1);

const replacement = structuredClone(protectedDraft);
replacement.exercises[1].exercise_id = "replacement";
replacement.exercises[1].nome = "Substituto";
replacement.exercises[1].sets = [
  { id: "replacement-set", done: true, reps: "8", carga: "15", kind: "normal" },
];
const substituted = saveDraft(replacement);
const broken = {
  ...substituted,
  exercises: [substituted.exercises[0], substituted.exercises[1], substituted.exercises[4]],
};
data.set(draftKey("a"), JSON.stringify(broken));
const resumed = readDraft("a");
assert.equal(resumed.exercises.length, 5);
assert.equal(
  resumed.exercises[1].exercise_id,
  "replacement",
  "Recover slots without undoing substitutions",
);
assert.equal(
  resumed.exercises.some((exercise) => exercise.exercise_id === "exercise-1"),
  false,
);
assert.deepEqual(resumed.exercises[1].sets, substituted.exercises[1].sets);
assert.deepEqual(
  resumed.exercises.map((exercise) => exercise.plan_item_id),
  plan.map((exercise) => exercise.plan_item_id),
);
const removedSeries = structuredClone(resumed);
removedSeries.exercises[2].sets = [];
assert.equal(
  restoreDraftExercises(removedSeries).exercises[2].sets.length,
  0,
  "Intentional series removal stays removed",
);

const legacyReplacement = structuredClone(legacy);
legacyReplacement.exercises[1].exercise_id = "old-replacement";
const upgradedReplacement = attachWorkoutPlan(legacyReplacement, plan);
assert.equal(upgradedReplacement.exercises.length, 5);
assert.equal(upgradedReplacement.exercises[1].exercise_id, "old-replacement");
assert.equal(
  upgradedReplacement.exercises.some((exercise) => exercise.exercise_id === "exercise-1"),
  false,
);

const finished = saveDraft({ ...resumed, finished: 100000, synced: true });
assert.equal(
  saveDraft({ ...stale, restUntil: 500000 }).finished,
  finished.finished,
  "A stale tab must not reopen a completed session",
);
const newSession = saveDraft({
  ...recovered,
  id: "next-session",
  exercises: [plan[0]],
  plannedExercises: [plan[0]],
});
assert.equal(newSession.exercises.length, 1, "Recovery must never mix different session plans");
assert.equal(newSession.revision, 1);
data.set(draftKey("a"), "malformed-json");
assert.equal(readDraft("a"), null);
globalThis.localStorage.setItem = () => {
  throw new Error("QuotaExceededError");
};
assert.throws(
  () => saveDraft(recovered),
  /QuotaExceededError/,
  "Never claim success after a storage failure",
);
console.log(
  "PASS: complete/legacy draft recovery, progress and UUID preservation, substitutions, stale writes, session/user isolation, intentional series removal, storage errors, decimal volume and suspended rest.",
);
