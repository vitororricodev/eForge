import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
function load(file) {
  let source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  source = source.replace(
    /from ["']zod["']/g,
    `from ${JSON.stringify(pathToFileURL(require.resolve("zod")).href)}`,
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const { decimalNumber, calculateBMI, effectiveWeight } = await load("src/lib/body-profile.ts");
assert.equal(decimalNumber("80,5"), 80.5);
assert.equal(decimalNumber(" 180.5 "), 180.5);
assert(Number.isNaN(decimalNumber("")));
assert(Number.isNaN(decimalNumber("80abc")));
assert(Number.isNaN(decimalNumber("8,0,5")));
assert.equal(calculateBMI(81, 180), 25);
assert.equal(calculateBMI(81, 0), null);
assert.equal(calculateBMI(NaN, 180), null);
const profile = { weight_kg: 80.5, updated_at: "2026-10-03T13:00:00Z" };
const old = { weight_kg: 90, measured_at: "2026-09-02", created_at: "2026-09-02T14:00:00Z" };
assert.equal(effectiveWeight(profile, [old]), 80.5);
assert.equal(effectiveWeight(null, [old]), 90);
assert.equal(
  effectiveWeight(profile, [
    { ...old, measured_at: "2026-10-03", created_at: "2026-10-03T15:00:00Z" },
  ]),
  90,
);
assert.equal(
  effectiveWeight(profile, [
    { ...old, measured_at: "2026-10-04", created_at: "2026-10-04T01:00:00Z" },
    { weight_kg: null, measured_at: "2026-10-05", created_at: "2026-10-05T01:00:00Z" },
  ]),
  90,
);
const { shareReturnPath, shareOrigin, moveTo, rememberShareReturn, consumeShareReturn } =
  await load("src/lib/workout-sharing.ts");
const token = "a".repeat(64),
  returnPath = "/share/" + token;
assert.equal(shareReturnPath(returnPath), returnPath);
for (const unsafe of [
  "https://attacker.invalid",
  "//attacker.invalid",
  returnPath + "?x=1",
  "/dashboard",
  "/share/nope",
  null,
])
  assert.equal(shareReturnPath(unsafe), undefined);
assert.equal(
  shareOrigin(undefined, "https://app.example.invalid", false),
  "https://app.example.invalid",
);
assert.equal(shareOrigin(undefined, "http://localhost", true), undefined);
assert.equal(
  shareOrigin("https://app.example.invalid/", "capacitor://localhost", true),
  "https://app.example.invalid",
);
assert.equal(shareOrigin("javascript:alert(1)", "https://app.example.invalid", false), undefined);
assert.equal(
  shareOrigin("https://user:password@app.example.invalid", "https://app.example.invalid", false),
  undefined,
);
assert.deepEqual(moveTo(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
const mem = new Map();
globalThis.sessionStorage = {
  setItem: (k, v) => mem.set(k, v),
  getItem: (k) => mem.get(k) ?? null,
  removeItem: (k) => mem.delete(k),
};
rememberShareReturn(returnPath);
assert.equal(consumeShareReturn(), returnPath);
assert.equal(consumeShareReturn(), undefined);
rememberShareReturn("//attacker.invalid");
assert.equal(consumeShareReturn(), undefined);
for (const file of fs.readdirSync("src/routes/_authenticated").filter((x) => x.endsWith(".tsx"))) {
  assert(
    !/[\u{1f300}-\u{1faff}\u2600-\u27bf]/u.test(
      fs.readFileSync("src/routes/_authenticated/" + file, "utf8"),
    ),
    "UI-authored emoji remains in " + file,
  );
}
console.log(
  "PASS: decimal comma, live BMI, latest weight precedence and no authored emoji in authenticated routes.",
);
