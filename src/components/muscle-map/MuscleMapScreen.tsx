import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  Eye,
  EyeOff,
  ListFilter,
  RotateCcw,
  CalendarDays,
  Dumbbell,
  CircleHelp,
} from "lucide-react";
import type { MuscleKey } from "@/components/MuscleBody";
import type { MuscleSummary } from "@/lib/muscle-map-data";
import { AnatomicalBody } from "./AnatomicalBody";
import { MUSCLES, muscleKeys, REGIONS, type BodyView } from "./anatomy";
import "./muscle-map.css";

type ExerciseLink = { id: string; nome: string };
export type MuscleMapScreenProps = {
  weekLabel: string;
  summary: MuscleSummary;
  activityLoading: boolean;
  activityError: boolean;
  onRetry: () => void;
  exercises: (muscle: MuscleKey) => ExerciseLink[];
  exercisesLoading: boolean;
  exercisesError: boolean;
  renderExerciseLink: (
    muscle: MuscleKey,
    children: ReactNode,
    className: string,
    exercise?: ExerciseLink,
  ) => ReactNode;
};
export function MuscleMapScreen(props: MuscleMapScreenProps) {
  const [view, setView] = useState<BodyView>("front");
  const [both, setBoth] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (!media.matches) setBoth(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [selected, setSelected] = useState<MuscleKey | null>(null);
  const [showNames, setShowNames] = useState(true);
  const chooseMuscle = (key: MuscleKey) => {
    setSelected(key);
    if (!REGIONS[view][key]) setView(MUSCLES[key].view);
  };
  const info = selected ? MUSCLES[selected] : null;
  const stats = selected ? props.summary[selected] : undefined;
  const related = selected ? props.exercises(selected) : [];
  const trained = Object.keys(props.summary) as MuscleKey[];
  return (
    <main className="muscle-map-page">
      <header className="muscle-map-heading">
        <p className="muscle-map-eyebrow">
          Evolução <ChevronRight size={14} aria-hidden="true" />
        </p>
        <h1>Mapa muscular</h1>
        <p>Toque no corpo para explorar.</p>
      </header>
      <div className="muscle-map-layout">
        <section className="muscle-map-viewer" aria-label="Explorar músculos">
          <div className="muscle-view-switch" role="group" aria-label="Vista do corpo">
            <button
              type="button"
              className={!both ? "is-current-view" : "mobile-current-view"}
              aria-pressed={!both && view === "front"}
              onClick={() => {
                setView("front");
                setBoth(false);
              }}
            >
              Frente
            </button>
            <button
              type="button"
              className={!both ? "is-current-view" : "mobile-current-view"}
              aria-pressed={!both && view === "back"}
              onClick={() => {
                setView("back");
                setBoth(false);
              }}
            >
              Costas
            </button>
            <button
              type="button"
              className="muscle-both-control"
              aria-pressed={both}
              onClick={() => setBoth(true)}
            >
              Ambos
            </button>
          </div>
          <div className="muscle-map-canvas">
            <button
              type="button"
              className="muscle-names-toggle"
              aria-pressed={showNames}
              aria-label={showNames ? "Ocultar nomes" : "Mostrar nomes"}
              onClick={() => setShowNames((value) => !value)}
            >
              {showNames ? (
                <Eye size={17} aria-hidden="true" />
              ) : (
                <EyeOff size={17} aria-hidden="true" />
              )}{" "}
              Nomes
            </button>
            <div className={`muscle-figures ${both ? "muscle-figures-both" : ""}`}>
              <AnatomicalBody
                key={view}
                view={view}
                selected={selected}
                trained={trained}
                showNames={showNames}
                onSelect={chooseMuscle}
              />
              {both && (
                <div className="muscle-second-figure">
                  <AnatomicalBody
                    view={view === "front" ? "back" : "front"}
                    selected={selected}
                    trained={trained}
                    showNames={showNames}
                    onSelect={setSelected}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="muscle-map-legend" aria-label="Legenda do mapa">
            <span>
              <i className="muscle-dot-selected" /> Selecionado
            </span>
            <span>
              <i className="muscle-dot-trained" /> Treinado
            </span>
            <span>
              <i className="muscle-dot-neutral" /> Outros
            </span>
          </div>
        </section>
        <div className="muscle-map-details">
          <section className="muscle-detail-card" aria-labelledby="muscle-detail-title">
            <div aria-live="polite" aria-atomic="true">
              <p className="muscle-map-kicker">
                {selected ? "Músculo selecionado" : "Explore seu corpo"}
              </p>
              <h2 id="muscle-detail-title">{info?.label ?? "Por onde começar?"}</h2>
              <p className="muscle-detail-region">
                {info?.region ??
                  "Toque em uma região do avatar ou escolha um músculo na lista abaixo."}
              </p>
            </div>
            {selected && (
              <>
                {props.renderExerciseLink(
                  selected,
                  <>
                    Ver exercícios <ArrowRight size={19} aria-hidden="true" />
                  </>,
                  "muscle-primary-action",
                )}
                <button
                  type="button"
                  className="muscle-clear-action"
                  aria-label="Limpar seleção"
                  title="Limpar seleção"
                  onClick={() => setSelected(null)}
                >
                  <RotateCcw size={17} aria-hidden="true" /><span className="sr-only">Limpar seleção</span>
                </button>
              </>
            )}
          </section>
          <section
            className="muscle-week-card"
            aria-labelledby="muscle-week-title"
            aria-busy={props.activityLoading}
          >
            <div className="muscle-week-heading">
              <h2 id="muscle-week-title">
                <CalendarDays size={17} aria-hidden="true" /> Nesta semana
              </h2>
              <span>{props.weekLabel}</span>
            </div>
            {props.activityLoading ? (
              <p role="status">Carregando seus treinos…</p>
            ) : props.activityError ? (
              <div role="alert">
                <p>Não foi possível carregar os treinos.</p>
                <button type="button" onClick={props.onRetry}>
                  Tentar novamente
                </button>
              </div>
            ) : selected ? (
              <>
                <div className="muscle-stat-grid">
                  <div>
                    <strong>{stats?.sets ?? 0}</strong>
                    <span>séries com participação</span>
                  </div>
                  <div>
                    <strong>{stats?.sessions ?? 0}</strong>
                    <span>treinos concluídos</span>
                  </div>
                </div>
                <p className="muscle-week-note">
                  {stats
                    ? "Inclui participação principal, secundária e terciária. Aquecimentos não entram na contagem."
                    : "Nenhuma série registrada para este músculo na semana."}
                </p>
              </>
            ) : (
              <p>
                {trained.length
                  ? `${trained.length} grupos musculares com séries registradas.`
                  : "Seus treinos concluídos aparecerão aqui."}
              </p>
            )}
            <p className="muscle-week-note">
              O mapa acompanha a semana atual. Seu histórico é preservado.
            </p>
          </section>
          {selected && (
            <section className="muscle-related-card" aria-labelledby="muscle-related-title">
              <h2 id="muscle-related-title">Exercícios relacionados</h2>
              {props.exercisesLoading ? (
                <p role="status">Carregando exercícios…</p>
              ) : props.exercisesError ? (
                <p role="alert">
                  Não foi possível consultar sua biblioteca. Abra “Ver exercícios” para tentar
                  novamente.
                </p>
              ) : related.length ? (
                <ul>
                  {related.slice(0, 3).map((exercise) => (
                    <li key={exercise.id}>
                      {props.renderExerciseLink(
                        selected,
                        <>
                          <Dumbbell size={19} aria-hidden="true" />
                          <span>{exercise.nome}</span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </>,
                        "muscle-exercise-link",
                        exercise,
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Nenhum exercício disponível para este músculo. Você pode cadastrar um na
                  biblioteca.
                </p>
              )}
            </section>
          )}
          <details className="muscle-list-card">
            <summary>
              <ListFilter size={18} aria-hidden="true" /> Selecionar pela lista{" "}
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <div className="muscle-accessible-list" role="group" aria-label="Lista de músculos">
              {muscleKeys.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={selected === key}
                  onClick={() => chooseMuscle(key)}
                >
                  {MUSCLES[key].label}
                </button>
              ))}
            </div>
          </details>
          <p className="muscle-map-footnote">
            <CircleHelp size={15} aria-hidden="true" />
            <span>
              As cores indicam seleção e registros de treino, não recuperação ou ativação
              fisiológica.
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
