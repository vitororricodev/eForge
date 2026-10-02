// Shared, side-effect-free parser used by the admin UI, CLI and tests.
export const LIBRARY_CATEGORIES = {
  abdomen: "Abdômen",
  biceps: "Bíceps",
  costas: "Costas",
  deltoides: "Deltoides",
  inferiores: "Membros inferiores",
  panturrilha: "Panturrilha",
  peitoral: "Peitoral",
  triceps: "Tríceps",
} as const;
export const AVATAR_KEYS = new Set([
  "chest",
  "abs",
  "obliques",
  "shoulders",
  "biceps",
  "forearms",
  "quads",
  "calves",
  "traps",
  "lats",
  "lower_back",
  "glutes",
  "hamstrings",
  "triceps",
  "rear_delts",
]);
export const GIF_BUCKET = "exercise-media";
export const MAX_GIF_BYTES = 8 * 1024 * 1024;
export interface GifEntry {
  name: string;
  slug: string;
  category: keyof typeof LIBRARY_CATEGORIES;
  path: string;
  sha256: string;
  bytes: number;
  primaryAnatomy: string;
  primary: string;
  secondary: string[];
  unmapped: string[];
  confidence: "alta" | "media" | "baixa";
  notes: string;
  aliases: { name: string; originalPath: string }[];
}
export interface GifManifest {
  entries: GifEntry[];
  errors: string[];
  aliases: number;
}
const list = (value: string) => [
  ...new Set(
    value
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
export function validateGifEntry(entry: GifEntry): GifEntry {
  if (!entry || !Object.hasOwn(LIBRARY_CATEGORIES, entry.category))
    throw new Error("Categoria inválida");
  if (
    typeof entry.name !== "string" ||
    !entry.name.trim() ||
    entry.name.length > 300 ||
    /\.gif$/i.test(entry.name)
  )
    throw new Error("Nome de exibição inválido");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || entry.slug.length > 160)
    throw new Error("Slug inválido");
  if (
    !new RegExp(
      `^${entry.category}/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)*[a-z0-9]+(?:-[a-z0-9]+)*\\.gif$`,
    ).test(entry.path) ||
    entry.path.length > 300
  )
    throw new Error("Caminho do GIF inválido");
  if (
    !/^[a-f0-9]{64}$/.test(entry.sha256) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes < 13 ||
    entry.bytes > MAX_GIF_BYTES
  )
    throw new Error("Hash ou tamanho inválido");
  if (
    (entry.primary && !AVATAR_KEYS.has(entry.primary)) ||
    !Array.isArray(entry.secondary) ||
    entry.secondary.some((k) => !AVATAR_KEYS.has(k))
  )
    throw new Error("Músculo sem chave no avatar: corrija o manifesto");
  if (
    !["alta", "media", "baixa"].includes(entry.confidence) ||
    typeof entry.primaryAnatomy !== "string" ||
    entry.primaryAnatomy.length > 300 ||
    typeof entry.notes !== "string" ||
    entry.notes.length > 3000 ||
    !Array.isArray(entry.unmapped) ||
    entry.unmapped.some((k) => typeof k !== "string" || k.length > 200)
  )
    throw new Error("Classificação inválida");
  if (
    !Array.isArray(entry.aliases) ||
    entry.aliases.length > 100 ||
    entry.aliases.some(
      (a) =>
        typeof a.name !== "string" ||
        typeof a.originalPath !== "string" ||
        a.name.length > 300 ||
        a.originalPath.length > 500,
    )
  )
    throw new Error("Aliases inválidos");
  return {
    ...entry,
    name: entry.name.trim(),
    secondary: [...new Set(entry.secondary)].filter((k) => k !== entry.primary),
    unmapped: [...new Set(entry.unmapped)],
  };
}
export function csvRows(input: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  input = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) result.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas");
  row.push(field);
  if (row.some((v) => v.trim())) result.push(row);
  return result;
}
export function parseGifManifest(input: string): GifManifest {
  if (input.length > 8_000_000) throw new Error("Manifesto acima de 8 MB");
  const entries: GifEntry[] = [],
    errors: string[] = [];
  let aliases = 0;
  const hashes = new Set<string>(),
    paths = new Set<string>();
  const add = (entry: GifEntry, line: number) => {
    try {
      entry = validateGifEntry(entry);
      if (hashes.has(entry.sha256)) {
        aliases++;
        return;
      }
      if (paths.has(entry.path)) throw new Error("Caminho repetido com hashes diferentes");
      hashes.add(entry.sha256);
      paths.add(entry.path);
      entries.push(entry);
    } catch (e) {
      errors.push(`Registro ${line}: ${e instanceof Error ? e.message : "inválido"}`);
    }
  };
  if (input.trimStart().startsWith("{")) {
    const data = JSON.parse(input) as { version?: number; entries?: GifEntry[] };
    if (data.version !== 1 || !Array.isArray(data.entries))
      throw new Error("Formato JSON inválido");
    data.entries.forEach((e, i) => add(e, i + 1));
  } else {
    const [header, ...rows] = csvRows(input);
    const required = [
      "categoria_padronizada",
      "nome_exercicio",
      "slug",
      "sha256",
      "bytes",
      "importar",
      "musculo_primario_anatomico",
      "musculo_primario_eforge",
      "musculos_secundarios_eforge",
      "musculos_sem_regiao_no_avatar",
      "confianca_classificacao",
      "observacao_classificacao",
      "novo_caminho_categorizado",
    ];
    if (!header || required.some((h) => !header.includes(h)))
      throw new Error("Use o manifesto categorizado, com classificação muscular");
    if (rows.length > 10000) throw new Error("Manifesto com mais de 10.000 registros");
    const mapped = rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
    const byHash = new Map<string, GifEntry["aliases"]>();
    for (const r of mapped) {
      const group = byHash.get(r.sha256) ?? [];
      group.push({
        name: r.nome_exercicio,
        originalPath: r.original_path ?? r.novo_caminho_categorizado,
      });
      byHash.set(r.sha256, group);
    }
    mapped.forEach((r, i) => {
      if (r.importar.trim().toLowerCase() !== "sim") {
        aliases++;
        return;
      }
      add(
        {
          name: r.nome_exercicio,
          slug: r.slug,
          category: r.categoria_padronizada as GifEntry["category"],
          path: r.novo_caminho_categorizado,
          sha256: r.sha256,
          bytes: Number(r.bytes),
          primaryAnatomy: r.musculo_primario_anatomico,
          primary: r.musculo_primario_eforge,
          secondary: list(r.musculos_secundarios_eforge),
          unmapped: list(r.musculos_sem_regiao_no_avatar),
          confidence: r.confianca_classificacao as GifEntry["confidence"],
          notes: r.observacao_classificacao,
          aliases: byHash.get(r.sha256) ?? [],
        },
        i + 2,
      );
    });
  }
  if (entries.length > 5000) throw new Error("Importe no máximo 5.000 GIFs por manifesto");
  if (!entries.length) throw new Error(errors[0] ?? "Manifesto sem GIFs para importar");
  return { entries, errors, aliases };
}
export const gifStoragePath = (entry: GifEntry) =>
  `official/${entry.path.slice(0, -4)}--${entry.sha256}.gif`;
export const gifCatalogSlug = (entry: GifEntry) =>
  `${entry.category}-${entry.slug}-${entry.sha256.slice(0, 12)}`;
export async function verifyGifBytes(entry: GifEntry, bytes: Uint8Array) {
  if (
    bytes.byteLength !== entry.bytes ||
    !["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.slice(0, 6)))
  )
    throw new Error("Tamanho ou assinatura GIF diverge do manifesto");
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== entry.sha256) throw new Error("SHA-256 diverge do manifesto");
}
