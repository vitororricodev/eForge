import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Upload, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LIBRARY_CATEGORIES, parseGifManifest, type GifManifest } from "@/lib/owned-gif-manifest";
import { importGifLibrary, folderGifSource, type GifImportResult } from "@/lib/owned-gif-import";
import { zipGifSource } from "@/lib/owned-gif-zip";
import { ownedGifAdapter } from "@/lib/owned-gif-supabase";
const reportSchema = z.object({
  state: z.object({
    legacy_disabled: z.boolean(),
    activated_at: z.string().nullable(),
    removed_count: z.number(),
    archived_count: z.number(),
  }),
  imported: z.number(),
  storage_files: z.number(),
  available: z.number(),
  legacy_remaining: z.number(),
  expected: z.number(),
  missing: z.array(z.string()),
  categories: z.record(z.number()),
  primaries: z.record(z.number()),
  confidence: z.record(z.number()),
});
function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function OwnedGifImportPanel({ userId }: { userId: string }) {
  const qc = useQueryClient(),
    abort = useRef<AbortController | null>(null),
    folder = useRef<HTMLInputElement>(null);
  const [manifest, setManifest] = useState<GifManifest | null>(null),
    [manifestName, setManifestName] = useState(""),
    [inputError, setInputError] = useState("");
  const [archive, setArchive] = useState<File | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [category, setCategory] = useState("");
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState<GifImportResult | null>(null),
    [confirming, setConfirming] = useState(false),
    [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    folder.current?.setAttribute("webkitdirectory", "");
    return () => abort.current?.abort();
  }, []);
  const hashes = useMemo(() => manifest?.entries.map((e) => e.sha256) ?? [], [manifest]);
  const selected = useMemo(
    () => manifest?.entries.filter((e) => !category || e.category === category) ?? [],
    [manifest, category],
  );
  const report = useQuery({
    queryKey: ["exercises", "owned-report", userId, hashes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owned_catalog_report", { p_hashes: hashes });
      if (error) throw error;
      return reportSchema.parse(data);
    },
  });
  const activation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("activate_owned_gif_library", {
        p_hashes: hashes,
      });
      if (error) throw error;
      return reportSchema.parse(data);
    },
    onSuccess: (data) => {
      toast.success(
        `Biblioteca própria ativada. ${data.state.removed_count} antigos removidos e ${data.state.archived_count} preservados por referências.`,
      );
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  async function start() {
    if (!manifest || !selected.length || (!archive && !files.length)) return;
    setRunning(true);
    abort.current = new AbortController();
    setInputError("");
    try {
      await importGifLibrary(
        selected,
        archive ? zipGifSource(archive) : folderGifSource(files),
        ownedGifAdapter(supabase),
        abort.current.signal,
        setProgress,
      );
    } catch (e) {
      setInputError(e instanceof Error ? e.message : "Importação indisponível");
    } finally {
      setRunning(false);
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    }
  }
  async function exportReport() {
    const { data, error } = await supabase.rpc("owned_catalog_report", {
      p_hashes: hashes,
      p_include_reviews: true,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    downloadJson("eforge-relatorio-biblioteca.json", {
      database: data,
      manifestErrors: manifest?.errors ?? [],
      lastImport: progress,
    });
  }
  const canActivate =
    !!manifest &&
    !manifest.errors.length &&
    report.data?.expected === hashes.length &&
    !report.data.missing.length &&
    !report.data.state.legacy_disabled &&
    !running;
  return (
    <section
      id="gif-import"
      className="rounded-2xl border border-border bg-surface p-4"
      aria-labelledby="owned-import-title"
    >
      <h2 id="owned-import-title" className="flex items-center gap-2 text-2xl">
        <Upload size={20} />
        Importar GIFs eForge
      </h2>
      <p className="mt-1 text-lg text-muted-foreground">
        Escolha o manifesto e o ZIP categorizado. A importação pode ser retomada sem duplicar
        exercícios.
      </p>
      <div className="mt-4 space-y-4">
        <label className="block text-lg">
          1. Manifesto CSV ou JSON
          <span className="owned-file-picker">
            <span className="owned-file-action">Escolher manifesto</span>
            <span className="owned-file-name">{manifestName || "Nenhum arquivo selecionado"}</span>
            <input
              aria-label="Manifesto de GIFs"
              type="file"
              accept=".csv,.json"
              disabled={running}
              className="owned-file-input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 8_000_000) throw new Error("Manifesto acima de 8 MB");
                  setManifest(parseGifManifest(await file.text()));
                  setManifestName(file.name);
                  setInputError("");
                  setProgress(null);
                } catch (error) {
                  setManifest(null);
                  setManifestName("");
                  setInputError(error instanceof Error ? error.message : "Manifesto inválido");
                }
              }}
            />
          </span>
        </label>
        <label className="block text-lg">
          2. ZIP dos GIFs categorizados
          <span className="owned-file-picker">
            <span className="owned-file-action">Escolher ZIP</span>
            <span className="owned-file-name">{archive?.name || "Nenhum ZIP selecionado"}</span>
            <input
              aria-label="ZIP de GIFs"
              type="file"
              accept=".zip,application/zip"
              disabled={running}
              className="owned-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setFiles([]);
                setProgress(null);
                setInputError("");
                if (file && file.size > 512 * 1024 * 1024) {
                  setArchive(null);
                  setInputError(
                    "ZIP acima de 512 MB. Use a pasta extraída ou o importador pelo terminal.",
                  );
                  return;
                }
                setArchive(file);
              }}
            />
          </span>
        </label>
        <details>
          <summary className="min-h-11 cursor-pointer content-center text-lg text-neon">
            Usar uma pasta extraída
          </summary>
          <p className="text-muted-foreground">
            Selecione a pasta que contém as oito categorias. O ZIP também funciona no celular.
          </p>
          <span className="owned-file-picker">
            <span className="owned-file-action">Escolher pasta</span>
            <span className="owned-file-name">
              {files.length ? `${files.length} arquivos selecionados` : "Nenhuma pasta selecionada"}
            </span>
            <input
              ref={folder}
              aria-label="Pasta de GIFs"
              type="file"
              multiple
              accept="image/gif"
              disabled={running}
              className="owned-file-input"
              onChange={(e) => {
                setFiles(Array.from(e.target.files ?? []));
                setArchive(null);
                setProgress(null);
                setInputError("");
              }}
            />
          </span>
        </details>
        <label className="block text-lg">
          3. Categoria para importar
          <select
            aria-label="Categoria de importação"
            value={category}
            disabled={running}
            onChange={(e) => {
              setCategory(e.target.value);
              setProgress(null);
            }}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-3 text-lg focus-visible:outline-2 focus-visible:outline-neon"
          >
            <option value="">Todas as categorias</option>
            {Object.entries(LIBRARY_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {manifest && (
          <p role="status" className="text-lg">
            {selected.length} exercícios encontrados · {manifest.entries.length} GIFs únicos no
            manifesto · {manifest.aliases} aliases preservados.
          </p>
        )}
        {!!manifest?.errors.length && (
          <details className="text-destructive">
            <summary className="min-h-11 cursor-pointer">
              {manifest.errors.length} registros inválidos no manifesto
            </summary>
            <ul>
              {manifest.errors.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-base text-muted-foreground">
          Músculos seguem o manifesto; confiança e observações ficam disponíveis para revisão.
          Importar novamente preserva edições e exclusões.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-12"
            disabled={running || !selected.length || (!archive && !files.length)}
            onClick={() => void start()}
          >
            {running
              ? "Importando…"
              : progress?.paused
                ? "Retomar importação"
                : "Importar exercícios"}
          </Button>
          {running && (
            <Button variant="outline" className="min-h-12" onClick={() => abort.current?.abort()}>
              Pausar após este GIF
            </Button>
          )}
        </div>
        {progress && (
          <div className="space-y-2 rounded-xl border border-border bg-background p-3">
            <p role="status" aria-live="polite" className="text-lg">
              {progress.processed} de {progress.total} · {progress.current}
            </p>
            <progress
              aria-label="Progresso da importação"
              className="h-2 w-full accent-neon"
              value={progress.processed}
              max={Math.max(1, progress.total)}
            />
            <p className="text-lg">
              {progress.created} novos · {progress.existing} já cadastrados · {progress.uploaded}{" "}
              uploads · {progress.errors.length} erros
            </p>
            {!!progress.deleted && (
              <p className="text-muted-foreground">
                {progress.deleted} excluídos foram mantidos fora da biblioteca.
              </p>
            )}
            {!!progress.errors.length && (
              <details>
                <summary className="min-h-11 cursor-pointer text-destructive">
                  Conferir erros
                </summary>
                <ul className="space-y-2 text-base">
                  {progress.errors.map((e, i) => (
                    <li className="break-all" key={i}>
                      {e.path}: {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Button
              className="min-h-11"
              variant="outline"
              onClick={() =>
                downloadJson("eforge-resultado-importacao.json", {
                  manifest: manifestName,
                  category: category || "todas",
                  ...progress,
                })
              }
            >
              <Download size={16} />
              Baixar resultado
            </Button>
          </div>
        )}
        {inputError && (
          <p role="alert" className="text-lg text-destructive">
            {inputError}
          </p>
        )}
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <h3 className="text-xl">Validar e substituir o catálogo antigo</h3>
        {report.isPending ? (
          <p role="status">Conferindo a biblioteca…</p>
        ) : report.isError ? (
          <p role="alert">
            Não foi possível validar a biblioteca. Aplique o SQL desta atualização.{" "}
            <Button variant="ghost" onClick={() => void report.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : (
          <>
            <p className="text-lg">
              {report.data.imported} cadastrados · {report.data.storage_files} GIFs no Storage ·{" "}
              {report.data.available} disponíveis
            </p>
            {manifest && !!report.data.missing.length && (
              <p className="text-muted-foreground">
                Faltam {report.data.missing.length} exercícios válidos deste manifesto. Termine a
                importação antes da substituição.
              </p>
            )}
            {report.data.state.legacy_disabled ? (
              <p className="flex items-center gap-2 text-lg text-neon">
                <CheckCircle2 size={18} />
                Biblioteca própria ativa. {report.data.state.removed_count} antigos removidos;{" "}
                {report.data.state.archived_count} preservados em treinos e histórico.
              </p>
            ) : (
              <p className="text-muted-foreground">
                A troca remove os antigos sem referências e arquiva os usados em treinos. Exercícios
                personalizados são preservados.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                className="min-h-11"
                variant="outline"
                disabled={!canActivate}
                onClick={() => {
                  setConfirmation("");
                  activation.reset();
                  setConfirming(true);
                }}
              >
                Substituir biblioteca antiga
              </Button>
              <Button className="min-h-11" variant="ghost" onClick={() => void exportReport()}>
                <Download size={16} />
                Baixar relatório do banco
              </Button>
            </div>
          </>
        )}
      </div>
      <Dialog
        open={confirming}
        onOpenChange={(open) => !activation.isPending && setConfirming(open)}
      >
        <DialogContent className="exercise-dialog bg-surface">
          <DialogHeader>
            <DialogTitle>Ativar a biblioteca própria?</DialogTitle>
            <DialogDescription>
              Os {hashes.length} GIFs do manifesto serão validados no banco. Exercícios antigos sem
              referências serão removidos; os associados a treinos ou séries serão arquivados com
              seus IDs e dados. A sincronização antiga será bloqueada. Exercícios personalizados
              permanecem.
            </DialogDescription>
          </DialogHeader>
          <label className="text-lg">
            Digite SUBSTITUIR BIBLIOTECA
            <Input
              className="mt-2 h-12"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {activation.isError && (
            <p role="alert" className="text-destructive">
              {activation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={activation.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-11"
              disabled={confirmation !== "SUBSTITUIR BIBLIOTECA" || activation.isPending}
              onClick={() => activation.mutate()}
            >
              {activation.isPending ? "Validando…" : "Confirmar substituição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
