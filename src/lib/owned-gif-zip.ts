import type { GifSource } from "./owned-gif-import";
import { MAX_GIF_BYTES } from "./owned-gif-manifest";
interface ZipEntry {
  name: string;
  offset: number;
  compressed: number;
  size: number;
  method: number;
  flags: number;
}
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const read = async (blob: Blob, start: number, length: number) =>
  new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
// Index only the central directory, then read one selected GIF at a time.
// ZIP64, encrypted and multipart ZIPs are rejected; the provided ZIP uses none of them.
export async function indexGifZip(archive: Blob): Promise<ZipEntry[]> {
  if (archive.size < 22) throw new Error("ZIP inválido");
  const tail = await read(archive, Math.max(0, archive.size - 65557), 65557),
    t = view(tail);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--)
    if (t.getUint32(i, true) === 0x06054b50 && i + 22 + t.getUint16(i + 20, true) === tail.length) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("ZIP sem diretório central válido");
  const count = t.getUint16(end + 10, true),
    length = t.getUint32(end + 12, true),
    offset = t.getUint32(end + 16, true);
  if (
    t.getUint16(end + 4, true) !== 0 ||
    t.getUint16(end + 6, true) !== 0 ||
    t.getUint16(end + 8, true) !== count ||
    count === 65535 ||
    length === 0xffffffff ||
    offset === 0xffffffff
  )
    throw new Error("Extraia o ZIP multipart/ZIP64 e use a opção de pasta");
  if (count > 10000 || length > 8_000_000 || offset + length > archive.size - 22)
    throw new Error("Diretório ZIP inválido ou muito grande");
  const bytes = await read(archive, offset, length),
    d = view(bytes),
    result: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || d.getUint32(p, true) !== 0x02014b50)
      throw new Error("Diretório ZIP truncado");
    const n = d.getUint16(p + 28, true),
      extra = d.getUint16(p + 30, true),
      comment = d.getUint16(p + 32, true);
    if (p + 46 + n + extra + comment > bytes.length) throw new Error("Nome ZIP inválido");
    result.push({
      name: new TextDecoder().decode(bytes.slice(p + 46, p + 46 + n)),
      flags: d.getUint16(p + 8, true),
      method: d.getUint16(p + 10, true),
      compressed: d.getUint32(p + 20, true),
      size: d.getUint32(p + 24, true),
      offset: d.getUint32(p + 42, true),
    });
    p += 46 + n + extra + comment;
  }
  return result;
}
export const zipGifSource = (archive: Blob): GifSource =>
  async function* (entries, signal, failure) {
    if (!entries.length) return;
    const index = await indexGifZip(archive),
      { inflateSync } = await import("fflate");
    for (const entry of entries) {
      if (signal.aborted) return;
      try {
        const candidates = index.filter(
          (f) => f.name === entry.path || f.name.endsWith("/" + entry.path),
        );
        if (candidates.length !== 1)
          throw new Error(
            candidates.length ? "Caminho duplicado no ZIP" : "GIF não encontrado no ZIP",
          );
        const f = candidates[0];
        if (f.flags & 1 || ![0, 8].includes(f.method))
          throw new Error("GIF criptografado ou compressão ZIP não suportada");
        if (
          f.size !== entry.bytes ||
          f.size > MAX_GIF_BYTES ||
          f.compressed > MAX_GIF_BYTES * 2 ||
          f.offset + 30 > archive.size
        )
          throw new Error("Tamanho ZIP diverge do manifesto");
        const header = await read(archive, f.offset, 30),
          h = view(header);
        if (
          header.length !== 30 ||
          h.getUint32(0, true) !== 0x04034b50 ||
          h.getUint16(8, true) !== f.method
        )
          throw new Error("Cabeçalho ZIP inválido");
        const n = h.getUint16(26, true),
          extra = h.getUint16(28, true),
          start = f.offset + 30 + n + extra;
        if (start + f.compressed > archive.size) throw new Error("GIF ZIP truncado");
        const name = new TextDecoder().decode(await read(archive, f.offset + 30, n));
        if (name !== f.name) throw new Error("Nome ZIP inconsistente");
        const compressed = await read(archive, start, f.compressed);
        const bytes =
          f.method === 0
            ? compressed
            : inflateSync(compressed, { out: new Uint8Array(entry.bytes) });
        yield { path: entry.path, bytes };
      } catch (e) {
        failure(entry.path, e instanceof Error ? e.message : "Falha ao extrair GIF");
      }
    }
  };
