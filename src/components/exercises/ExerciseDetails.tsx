import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { muscleLabel, equipmentLabel, bodyPartLabel } from "@/lib/exercise-labels";
import type { Exercise } from "@/lib/exercise-types";
import { ExerciseMedia } from "./ExerciseMedia";
export function ExerciseDetails({
  exercise,
  onClose,
  onAdd,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
}) {
  const instructions = exercise?.instrucoes_pt_br.length
    ? exercise.instrucoes_pt_br
    : (exercise?.instrucoes ?? []);
  return (
    <Dialog open={!!exercise} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="exercise-dialog max-h-[90dvh] overflow-y-auto bg-surface sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{exercise?.nome}</DialogTitle>
          <DialogDescription>Detalhes e orientações do exercício.</DialogDescription>
        </DialogHeader>
        {exercise && (
          <>
            <ExerciseMedia
              url={exercise.gif_url}
              name={exercise.nome}
              muscle={exercise.musculo_principal}
              className="h-56 w-full"
            />
            {exercise.name_original && exercise.name_original !== exercise.nome && (
              <details className="text-muted-foreground">
                <summary className="min-h-11 cursor-pointer">Nome original</summary>
                <p lang="en">{exercise.name_original}</p>
              </details>
            )}
            {exercise.descricao && <p>{exercise.descricao}</p>}
            <dl className="space-y-3 text-lg">
              {[
                [
                  exercise.musculo_principal_anatomico
                    ? "Regiões primárias no avatar"
                    : "Principais",
                  (exercise.musculos_primarios.length
                    ? exercise.musculos_primarios
                    : [exercise.musculo_principal]
                  )
                    .map(muscleLabel)
                    .join(", ") || "Não mapeados",
                ],
                [
                  "Secundários",
                  exercise.musculos_secundarios.map(muscleLabel).join(", ") || "Não informados",
                ],
                ...(exercise.musculos_terciarios.length
                  ? [["Terciários", exercise.musculos_terciarios.map(muscleLabel).join(", ")]]
                  : []),
                [
                  "Equipamento",
                  (exercise.equipamentos_pt_br.length
                    ? exercise.equipamentos_pt_br
                    : exercise.equipamentos.map(equipmentLabel)
                  ).join(", ") || "Não informado",
                ],
                [
                  "Categoria da biblioteca",
                  (exercise.partes_corpo_pt_br.length
                    ? exercise.partes_corpo_pt_br
                    : exercise.partes_corpo.map(bodyPartLabel)
                  ).join(", ") || "Não informada",
                ],
                ...(exercise.dificuldade ? [["Dificuldade", exercise.dificuldade]] : []),
                ...(exercise.musculo_principal_anatomico
                  ? [["Músculo primário anatômico", exercise.musculo_principal_anatomico]]
                  : []),
                ...(exercise.classification_confidence
                  ? [
                      [
                        "Confiança da classificação",
                        exercise.classification_confidence === "media"
                          ? "Média"
                          : exercise.classification_confidence === "alta"
                            ? "Alta"
                            : "Baixa",
                      ],
                    ]
                  : []),
                ...(exercise.unmapped_muscles.length
                  ? [["Sem região específica no avatar", exercise.unmapped_muscles.join(", ")]]
                  : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {exercise.gif_sha256 && !exercise.classification_reviewed && (
              <p className="text-base text-muted-foreground">
                Classificação fornecida no manifesto; revisão administrativa pendente. As regiões do
                avatar não substituem a anatomia indicada.
              </p>
            )}
            <section>
              <h3 className="text-2xl">Como executar</h3>
              {instructions.length ? (
                <ol
                  className="mt-3 list-decimal space-y-3 pl-5 text-lg leading-relaxed"
                  lang={
                    exercise.instrucoes_pt_br.length || exercise.source !== "exercisedb"
                      ? "pt-BR"
                      : "en"
                  }
                >
                  {instructions.map((instruction, index) => (
                    <li key={index}>{instruction.replace(/^Step:\s*\d+\s*/i, "")}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">Instruções não disponíveis.</p>
              )}
            </section>
            {exercise.observacoes && (
              <p className="text-muted-foreground">{exercise.observacoes}</p>
            )}
            {exercise.source === "exercisedb" && (
              <p className="text-base text-muted-foreground">
                Dados e mídia:{" "}
                <a
                  href="https://ascendapi.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neon underline"
                >
                  ExerciseDB / AscendAPI
                </a>
                . {exercise.instrucoes_pt_br.length ? "" : "Instruções originais em inglês."}
              </p>
            )}
            <Button
              className="h-12"
              disabled={!exercise.active || exercise.review_status !== "approved"}
              onClick={() => onAdd(exercise)}
            >
              Adicionar ao treino
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function AddToWorkoutDialog({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const workouts = useQuery({
    queryKey: ["workouts", "picker", user?.id, search, page],
    enabled: !!exercise && !!user,
    queryFn: async () => {
      let query = supabase
        .from("workouts")
        .select("id,nome", { count: "exact" })
        .eq("user_id", user!.id)
        .order("nome")
        .order("id")
        .range(page * 20, page * 20 + 19);
      if (search.trim()) query = query.ilike("nome", `%${search.trim().replace(/[%_\\]/g, "")}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return { items: data ?? [], total: count ?? 0 };
    },
  });
  const mutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!exercise) throw new Error("Selecione um exercício");
      const { error } = await supabase.rpc("add_exercise_to_workout", {
        p_workout_id: workoutId,
        p_exercise_id: exercise.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Exercício adicionado ao treino");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog open={!!exercise} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="exercise-dialog max-h-[90dvh] overflow-y-auto bg-surface">
        <DialogHeader>
          <DialogTitle>Adicionar ao treino</DialogTitle>
          <DialogDescription>
            Escolha o treino para {exercise?.nome}. Ajuste as séries na tela de treinos.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Buscar treino"
          placeholder="Buscar treino"
          className="h-11"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        {workouts.isPending ? (
          <p role="status">Carregando treinos…</p>
        ) : workouts.isError ? (
          <p role="alert">
            Não foi possível consultar seus treinos.{" "}
            <Button variant="ghost" onClick={() => void workouts.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {workouts.data.items.map((workout) => (
                <li key={workout.id}>
                  <Button
                    disabled={mutation.isPending}
                    variant="outline"
                    className="min-h-12 w-full justify-start whitespace-normal text-left"
                    onClick={() => mutation.mutate(workout.id)}
                  >
                    {workout.nome}
                  </Button>
                </li>
              ))}
            </ul>
            {!workouts.data.total && (
              <p>
                Nenhum treino encontrado.{" "}
                <Link to="/workouts" className="text-neon underline">
                  Criar um treino
                </Link>
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" disabled={!page} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <Button
                variant="ghost"
                disabled={(page + 1) * 20 >= workouts.data.total}
                onClick={() => setPage(page + 1)}
              >
                Próximo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
