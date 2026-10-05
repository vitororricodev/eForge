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
const {
  decimalNumber,
  calculateBMI,
  effectiveWeight,
  heightCentimeters,
  formatBodyNumber,
  classifyBMI,
  getBMIReference,
  bmiWeightRange,
} = await load("src/lib/body-profile.ts");
assert.equal(decimalNumber("80,5"), 80.5);
assert.equal(decimalNumber(" 180.5 "), 180.5);
assert(Number.isNaN(decimalNumber("")));
assert(Number.isNaN(decimalNumber("80abc")));
assert(Number.isNaN(decimalNumber("8,0,5")));
assert.equal(calculateBMI(81, 180), 25);
assert.equal(calculateBMI(81, 0), null);
assert.equal(calculateBMI(NaN, 180), null);
for (const height of ["1,85", "1.85", "185", 1.85, 185, " 1,850 "])
  assert.equal(heightCentimeters(height), 185, `altura deve ser normalizada: ${height}`);
for (const invalid of ["", "185cm", "1,8,5", "1.850,0", "0", 3, 79, 261, Infinity, NaN, null])
  assert.equal(heightCentimeters(invalid), null);
assert.equal(heightCentimeters("0,80"), 80);
assert.equal(heightCentimeters("2,60"), 260);
const capturedBMI = calculateBMI(55, 1.85);
assert(Math.abs(capturedBMI - 16.0701241782) < 0.000001);
assert.equal(calculateBMI(55, 185), capturedBMI);
assert.equal(formatBodyNumber(capturedBMI), "16,1");
assert.equal(formatBodyNumber(25), "25,0");
assert.equal(formatBodyNumber(NaN), "—");
assert.equal(calculateBMI(55, 1.85e-3), null);
assert.equal(calculateBMI(401, 185), null);
assert.equal(classifyBMI(capturedBMI, 26).state, "below");
assert.equal(classifyBMI(18.499, 26).state, "below");
assert.equal(classifyBMI(18.5, 26).state, "within");
assert.equal(classifyBMI(24.99, 26).state, "within");
assert.equal(classifyBMI(25, 26).detail, "Sobrepeso");
assert.equal(classifyBMI(30, 26).detail, "Obesidade grau 1");
assert.equal(classifyBMI(35, 26).detail, "Obesidade grau 2");
assert.equal(classifyBMI(40, 26).detail, "Obesidade grau 3");
assert.equal(classifyBMI(22, 60).state, "below");
assert.equal(classifyBMI(22.01, 60).state, "within");
assert.equal(classifyBMI(26.99, 60).state, "within");
assert.equal(classifyBMI(27, 60).state, "above");
assert.equal(classifyBMI(45, 60).detail, "Sobrepeso");
assert.equal(getBMIReference(59).group, "adult");
assert.equal(getBMIReference(60).group, "older");
for (const age of [null, NaN, 19, 19.5, 121]) {
  assert.equal(getBMIReference(age), null);
  assert.equal(classifyBMI(25, age), null);
  assert.equal(bmiWeightRange(185, age), null);
}
assert.equal(classifyBMI(NaN, 26), null);
const desired = bmiWeightRange(185, 26);
assert(Math.abs(desired.min - 63.31625) < 0.000001);
assert(Math.abs(desired.max - 85.5625) < 0.000001);
assert.deepEqual(bmiWeightRange(1.85, 26), desired);
assert.equal(formatBodyNumber(desired.min), "63,3");
assert.equal(formatBodyNumber(desired.max), "85,6");
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
  "PASS: height units, decimal comma/BMI regression, age-based classification/reference, latest weight precedence and no authored emoji in authenticated routes.",
);
