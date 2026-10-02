import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { muscleKeys, MUSCLES } from "@/components/muscle-map/anatomy";
import type { MuscleKey } from "@/components/MuscleBody";
type Mapping = {
  source_name: string;
  muscle_keys: string[];
  status: "mapped" | "pending" | "unsupported";
  notes: string | null;
};
export function MuscleMappingPanel() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Mapping | null>(null);
  const [keys, setKeys] = useState<MuscleKey[]>([]);
  const [status, setStatus] = useState<Mapping["status"]>("pending");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const mappings = useQuery({
    queryKey: ["exercises", "mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_muscle_mappings")
        .select("source_name,muscle_keys,status,notes")
        .order("status")
        .order("source_name")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um mapeamento");
      if (status === "mapped" && !keys.length) throw new Error("Escolha pelo menos um músculo");
      const { error } = await supabase
        .from("exercise_muscle_mappings")
        .update({
          muscle_keys: status === "mapped" ? keys : [],
          status,
          notes: notes.trim() || null,
        })
        .eq("source_name", selected.source_name);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["exercises", "mappings"] });
      toast.success("Mapeamento salvo. Sincronize novamente para aplicar ao catálogo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <details className="rounded-2xl border border-border bg-surface p-4">
      <summary className="min-h-11 cursor-pointer text-2xl">Mapeamento muscular</summary>
      <p className="my-3 text-lg text-muted-foreground">
        Correspondências usam os 15 grupos do avatar. Termos amplos ou regiões não representadas
        exigem revisão.
      </p>
      <Input
        aria-label="Buscar mapeamento muscular"
        className="h-11"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar termo da ExerciseDB"
      />
      {mappings.isPending ? (
        <p role="status">Carregando…</p>
      ) : mappings.isError ? (
        <p role="alert">
          Mapeamentos indisponíveis.{" "}
          <Button onClick={() => void mappings.refetch()}>Tentar novamente</Button>
        </p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {mappings.data
            .filter((m) => m.source_name.includes(search.toLowerCase()))
            .map((m) => (
              <li key={m.source_name}>
                <button
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left focus-visible:outline-2 focus-visible:outline-neon"
                  onClick={() => {
                    setSelected(m);
                    setKeys(muscleKeys.filter((key) => m.muscle_keys.includes(key)));
                    setStatus(m.status);
                    setNotes(m.notes ?? "");
                  }}
                >
                  <span>{m.source_name}</span>
                  <span className="text-neon">
                    {m.status === "mapped"
                      ? m.muscle_keys.map((key) => MUSCLES[key as MuscleKey].label).join(", ")
                      : m.status === "pending"
                        ? "Revisar"
                        : "Fora do avatar"}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="exercise-dialog max-h-[90dvh] overflow-y-auto bg-surface">
          <DialogHeader>
            <DialogTitle>{selected?.source_name}</DialogTitle>
            <DialogDescription>
              Associe somente regiões correspondentes ao dado da fonte.
            </DialogDescription>
          </DialogHeader>
          <label className="text-lg" htmlFor="mapping-status">
            Status
          </label>
          <select
            id="mapping-status"
            className="h-11 rounded-xl border border-border bg-background px-3"
            value={status}
            onChange={(e) => setStatus(e.target.value as Mapping["status"])}
          >
            <option value="pending">Pendente</option>
            <option value="mapped">Mapeado</option>
            <option value="unsupported">Sem região correspondente no avatar</option>
          </select>
          {status === "mapped" && (
            <fieldset>
              <legend>Grupos do avatar</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {muscleKeys.map((key) => (
                  <label key={key} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={keys.includes(key)}
                      onChange={() =>
                        setKeys((prev) =>
                          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
                        )
                      }
                    />
                    {MUSCLES[key].label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label htmlFor="mapping-notes">Justificativa da revisão</label>
          <Textarea
            id="mapping-notes"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button className="h-12" disabled={save.isPending} onClick={() => save.mutate()}>
            Salvar mapeamento
          </Button>
        </DialogContent>
      </Dialog>
    </details>
  );
}
