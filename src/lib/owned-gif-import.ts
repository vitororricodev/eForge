import { GIF_BUCKET, gifStoragePath, verifyGifBytes, type GifEntry } from "./owned-gif-manifest";
export interface GifInventory {
  sha256: string;
  id: string | null;
  path: string;
  deleted: boolean;
  asset_exists: boolean;
  bytes: number | null;
  mime: string | null;
}
export interface GifImportAdapter {
  inspect(entries: { sha256: string; path: string }[]): Promise<GifInventory[]>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  save(entry: GifEntry, url: string): Promise<{ id: string; status: string; deleted: boolean }>;
  publicUrl(path: string): string;
}
export interface GifFile {
  path: string;
  bytes: Uint8Array;
}
export interface GifImportResult {
  total: number;
  processed: number;
  created: number;
  existing: number;
  uploaded: number;
  deleted: number;
  paused: boolean;
  current: string;
  errors: { path: string; message: string }[];
}
export type GifSource = (
  entries: GifEntry[],
  signal: AbortSignal,
  failure: (path: string, message: string) => void,
) => AsyncIterable<GifFile>;
export async function importGifLibrary(
  entries: GifEntry[],
  source: GifSource,
  adapter: GifImportAdapter,
  signal: AbortSignal,
  onProgress: (result: GifImportResult) => void,
) {
  const result: GifImportResult = {
    total: entries.length,
    processed: 0,
    created: 0,
    existing: 0,
    uploaded: 0,
    deleted: 0,
    paused: false,
    current: "Conferindo o Storage…",
    errors: [],
  };
  const emit = () => onProgress({ ...result, errors: [...result.errors] });
  const fail = (path: string, message: string) => {
    result.errors.push({ path, message: message.slice(0, 400) });
  };
  emit();
  const inventory = new Map(
    (
      await adapter.inspect(entries.map((e) => ({ sha256: e.sha256, path: gifStoragePath(e) })))
    ).map((i) => [i.sha256, i]),
  );
  const remaining: GifEntry[] = [];
  for (const entry of entries) {
    const item = inventory.get(entry.sha256);
    if (
      item?.id &&
      (item.deleted ||
        (item.asset_exists && item.bytes === entry.bytes && item.mime === "image/gif"))
    ) {
      result.processed++;
      result.existing++;
      if (item.deleted) result.deleted++;
    } else remaining.push(entry);
  }
  const byPath = new Map(remaining.map((e) => [e.path, e])),
    seen = new Set<string>();
  emit();
  try {
    for await (const file of source(remaining, signal, fail)) {
      if (signal.aborted) break;
      const entry = byPath.get(file.path);
      if (!entry) continue;
      if (seen.has(file.path)) {
        fail(file.path, "Arquivo repetido no envio");
        continue;
      }
      seen.add(file.path);
      result.current = entry.name;
      emit();
      try {
        await verifyGifBytes(entry, file.bytes);
        const old = inventory.get(entry.sha256),
          path = old?.path ?? gifStoragePath(entry);
        if (old?.asset_exists && (old.bytes !== entry.bytes || old.mime !== "image/gif"))
          throw new Error(
            "O objeto existente diverge do manifesto. Revise o Storage antes de substituir.",
          );
        if (!old?.asset_exists) {
          try {
            await adapter.upload(path, file.bytes);
            result.uploaded++;
          } catch (uploadError) {
            // A concurrent import or a response lost after upload may already have saved it.
            const check = (await adapter.inspect([{ sha256: entry.sha256, path }]))[0];
            if (!check?.asset_exists || check.bytes !== entry.bytes || check.mime !== "image/gif")
              throw uploadError;
          }
        }
        const saved = await adapter.save(entry, adapter.publicUrl(path));
        if (saved.status === "created") result.created++;
        else result.existing++;
        if (saved.deleted) result.deleted++;
      } catch (e) {
        fail(file.path, e instanceof Error ? e.message : "Falha ao importar o GIF");
      }
      result.processed++;
      emit();
    }
  } catch (e) {
    fail("ZIP / arquivos", e instanceof Error ? e.message : "Falha ao ler os arquivos");
  }
  result.paused = signal.aborted;
  if (!result.paused)
    for (const entry of remaining)
      if (!seen.has(entry.path)) {
        if (!result.errors.some((e) => e.path === entry.path))
          fail(entry.path, "GIF não encontrado nos arquivos selecionados");
        result.processed++;
      }
  result.current = result.paused ? "Pausado após o arquivo atual" : "Importação concluída";
  emit();
  return result;
}

export const folderGifSource = (files: File[]): GifSource =>
  async function* (entries, signal, failure) {
    for (const entry of entries) {
      if (signal.aborted) return;
      const candidates = files.filter((f) => {
        const path = f.webkitRelativePath || f.name;
        return path === entry.path || path.endsWith("/" + entry.path);
      });
      const file =
        candidates.length === 1
          ? candidates[0]
          : files.filter((f) => f.name === entry.path.split("/").pop())[0];
      if (!file) {
        failure(entry.path, "GIF não encontrado na pasta");
        continue;
      }
      yield { path: entry.path, bytes: new Uint8Array(await file.arrayBuffer()) };
    }
  };
