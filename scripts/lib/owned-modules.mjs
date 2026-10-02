import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const urls = new Map();
// Reuse the same TS implementation on Node without a second parser or runtime SDK.
export function ownedModuleURL(name) {
  if (urls.has(name)) return urls.get(name);
  let code = ts.transpileModule(fs.readFileSync(path.join(root, "src/lib", name + ".ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replace(/(["'])\.\/(owned-gif-[\w-]+)\1/g, (_, quote, dependency) =>
    JSON.stringify(ownedModuleURL(dependency)),
  );
  code = code.replace(
    /import\(["']fflate["']\)/g,
    `import(${JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve("fflate")).href)})`,
  );
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  urls.set(name, url);
  return url;
}
export const loadOwnedModule = (name) => import(ownedModuleURL(name));
