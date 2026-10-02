import fs from "node:fs";
import ts from "typescript";
const compile = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ).toString("base64");
const coreURL = compile(fs.readFileSync("supabase/functions/_shared/exercisedb.ts", "utf8"));
export const core = await import(coreURL);
export const handler = await import(
  compile(
    fs
      .readFileSync("supabase/functions/_shared/sync-handler.ts", "utf8")
      .replace(/(['"])\.\/exercisedb\.ts\1/, JSON.stringify(coreURL)),
  )
);
export const exercise = {
  exerciseId: "EIeI8Vf",
  name: "barbell bench press",
  gifUrl: "https://static.exercisedb.dev/media/EIeI8Vf.gif",
  bodyParts: ["chest"],
  equipments: ["barbell"],
  targetMuscles: ["pectorals"],
  secondaryMuscles: ["deltoids", "triceps"],
  instructions: ["Position on the bench.", "Press with control."],
};
