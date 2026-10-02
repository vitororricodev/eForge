import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadOwnedModule } from "./lib/owned-modules.mjs";
const args = process.argv.slice(2),
  get = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
if (!get("--folder")) {
  console.log("npm run catalog:prepare -- --folder PASTA --output novo-manifesto.json");
  process.exit(1);
}
try {
  const core = await loadOwnedModule("owned-gif-manifest"),
    base = path.resolve(get("--folder")),
    entries = [],
    hashes = new Map();
  async function scan(dir) {
    for (const file of await fs.readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, file.name);
      if (file.isDirectory()) await scan(absolute);
      else if (file.isFile() && /\.gif$/i.test(file.name)) {
        const relative = path.relative(base, absolute).split(path.sep).join("/"),
          category = relative.split("/")[0];
        if (!Object.hasOwn(core.LIBRARY_CATEGORIES, category))
          throw new Error(`Categoria inválida: ${relative}`);
        const bytes = await fs.readFile(absolute);
        if (bytes.length > core.MAX_GIF_BYTES) throw new Error(`GIF acima de 8 MB: ${relative}`);
        const sha256 = createHash("sha256").update(bytes).digest("hex"),
          slug = file.name.slice(0, -4),
          name = slug.replace(/[-_]+/g, " ");
        const alias = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          originalPath: relative,
        };
        if (hashes.has(sha256)) {
          hashes.get(sha256).aliases.push(alias);
          continue;
        }
        const entry = core.validateGifEntry({
          name: alias.name,
          slug,
          category,
          path: relative,
          sha256,
          bytes: bytes.length,
          primaryAnatomy: "",
          primary: "",
          secondary: [],
          unmapped: [],
          confidence: "baixa",
          notes: "Classificação muscular ainda não informada. Revisão necessária.",
          aliases: [alias],
        });
        await core.verifyGifBytes(entry, new Uint8Array(bytes));
        hashes.set(sha256, entry);
        entries.push(entry);
      }
    }
  }
  await scan(base);
  if (!entries.length) throw new Error("Nenhum GIF encontrado");
  const output = get("--output") || "novo-manifesto.json";
  await fs.writeFile(output, JSON.stringify({ version: 1, entries }, null, 2) + "\n");
  console.log(
    `${entries.length} GIFs únicos. Manifesto: ${output}. Músculos vazios; preencha apenas classificações confiáveis.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
