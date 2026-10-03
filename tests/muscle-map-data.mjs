import ts from "typescript";
import fs from "node:fs";
import assert from "node:assert/strict";
const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const uri = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const activityURI = uri(transpile("src/lib/muscle-activity.ts"));
const { getTrainingWeekWindow } = await import(activityURI);
const { summarizeMuscleSets, mergeLocalMuscleSets, relatedMuscles, muscleStateFromSets } =
  await import(
    uri(
      transpile("src/lib/muscle-map-data.ts").replace(
        /(['"])\.\/muscle-activity\1/,
        JSON.stringify(activityURI),
      ),
    )
  );
const row = {
  id: "s1",
  session_id: "w1",
  kind: "normal",
  musculo_principal: "Peito",
  musculos_secundarios: ["peitoral", "Bíceps"],
  musculos_terciarios: ["Core"],
};
assert.deepEqual(relatedMuscles(row), ["chest", "biceps", "abs", "obliques"]);
const summary = summarizeMuscleSets([
  row,
  row,
  { ...row, id: "s2" },
  { ...row, id: "s3", session_id: "w2" },
  { ...row, id: "warm", kind: "warmup" },
]);
assert.deepEqual(summary.chest, { sets: 3, sessions: 2 });
assert.deepEqual(summary.obliques, { sets: 3, sessions: 2 });
const week = getTrainingWeekWindow(new Date(2026, 8, 16));
const draft = {
  id: "w1",
  userId: "u1",
  started: new Date(2026, 8, 16).getTime(),
  finished: new Date(2026, 8, 16, 12).getTime(),
  synced: false,
  exercises: [
    {
      ...row,
      sets: [
        { id: "s1", done: true, kind: "normal" },
        { id: "s4", done: true, kind: "normal" },
        { id: "s5", done: false, kind: "normal" },
      ],
    },
  ],
};
assert.equal(mergeLocalMuscleSets([row], draft, "u1", week).length, 2);
assert.equal(mergeLocalMuscleSets([row], draft, "u2", week).length, 1);
assert.equal(mergeLocalMuscleSets([row], { ...draft, finished: undefined }, "u1", week).length, 1);
assert.equal(mergeLocalMuscleSets([row], { ...draft, synced: true }, "u1", week).length, 1);
assert.equal(
  mergeLocalMuscleSets([row], { ...draft, started: week.end.getTime() }, "u1", week).length,
  1,
);
assert.equal(
  mergeLocalMuscleSets([row], { ...draft, started: week.start.getTime() - 1 }, "u1", week).length,
  1,
);
assert.deepEqual(
  summarizeMuscleSets([
    {
      ...row,
      musculo_principal: "desconhecido",
      musculos_secundarios: null,
      musculos_terciarios: null,
    },
  ]),
  {},
);
console.log(
  "PASS: muscle selection data, deduplication, warmups, tertiary roles, local account/week isolation.",
);

assert.deepEqual(
  new Set(
    relatedMuscles({
      musculo_principal: "chest",
      musculos_primarios: ["chest", "triceps"],
      musculos_secundarios: ["shoulders"],
    }),
  ),
  new Set(["chest", "triceps", "shoulders"]),
);
const roleState = muscleStateFromSets([
  row,
  row,
  { ...row, id: "s2" },
  { ...row, id: "warm", kind: "warmup" },
]);
assert.equal(roleState.chest.role, "primary");
assert.equal(
  roleState.chest.score,
  2,
  "Aliases in secondary muscles must not count a primary twice",
);
assert.equal(roleState.biceps.role, "secondary");
assert.equal(roleState.biceps.score, 1.1);
assert.equal(roleState.abs.role, "tertiary");
assert.equal(roleState.abs.score, 0.5);
const mixedRoles = muscleStateFromSets([
  ...Array.from({ length: 4 }, (_, i) => ({ ...row, id: "secondary-" + i })),
  {
    ...row,
    id: "primary-biceps",
    musculo_principal: "Bíceps",
    musculos_primarios: ["biceps", "forearms"],
    musculos_secundarios: [],
    musculos_terciarios: [],
  },
]);
assert.equal(
  mixedRoles.biceps.role,
  "primary",
  "An explicit primary role wins even with more secondary sets",
);
assert.equal(mixedRoles.forearms.role, "primary", "All supplied primary muscles are preserved");
assert.deepEqual(muscleStateFromSets([{ ...row, kind: "warmup" }]), {});
assert.deepEqual(
  muscleStateFromSets([
    {
      ...row,
      musculo_principal: "unmapped",
      musculos_secundarios: null,
      musculos_terciarios: null,
    },
  ]),
  {},
);
assert.equal(
  muscleStateFromSets(mergeLocalMuscleSets([], draft, "u1", week)).chest.role,
  "primary",
);
assert.deepEqual(muscleStateFromSets(mergeLocalMuscleSets([], draft, "u2", week)), {});
console.log(
  "PASS: weekly trained roles, primary precedence, multiple primaries, existing role weights, duplicate/alias deduplication and local snapshot isolation.",
);
