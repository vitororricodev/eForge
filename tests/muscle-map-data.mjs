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
const { summarizeMuscleSets, mergeLocalMuscleSets, relatedMuscles } = await import(
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
