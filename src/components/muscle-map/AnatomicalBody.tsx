import { Fragment, useState } from "react";
import type { MuscleKey, MuscleState } from "@/components/MuscleBody";
import { muscleRoleLabel } from "@/lib/muscle-activity";
import { MUSCLES, REGIONS, type BodyView } from "./anatomy";

export function AnatomicalBody({
  view,
  selected,
  training,
  showNames,
  onSelect,
}: {
  view: BodyView;
  selected: MuscleKey | null;
  training: MuscleState;
  showNames: boolean;
  onSelect: (key: MuscleKey) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure
      className="anatomical-figure"
      aria-label={`Mapa muscular — ${view === "front" ? "frente" : "costas"}`}
    >
      <div className="anatomical-stage">
        {failed ? (
          <p role="status" className="anatomical-fallback">
            Não foi possível carregar o avatar. Use a lista de músculos abaixo.
          </p>
        ) : (
          <img
            src={`/anatomy/${view}.webp`}
            alt={`Figura anatômica em vista ${view === "front" ? "frontal" : "posterior"}`}
            width={640}
            height={1024}
            onError={() => setFailed(true)}
            draggable={false}
          />
        )}
        {!failed && (
          <svg
            viewBox={`${view === "front" ? 110 : 770} 0 640 1024`}
            className="anatomical-regions"
            aria-label="Regiões musculares selecionáveis"
          >
            {(Object.entries(REGIONS[view]) as [MuscleKey, string][]).map(([key, d]) => (
              <Fragment key={key}>
                <path
                  d={d}
                  role="button"
                  tabIndex={0}
                  aria-label={MUSCLES[key].label}
                  aria-pressed={selected === key}
                  data-muscle={key}
                  data-selected={selected === key}
                  data-trained={!!training[key]}
                  data-role={training[key]?.role ?? "none"}
                  className="anatomical-region"
                  vectorEffect="non-scaling-stroke"
                  aria-description={
                    training[key]
                      ? `${muscleRoleLabel(training[key].role)} nos treinos desta semana`
                      : "Sem registro de treino nesta semana"
                  }
                  onClick={() => onSelect(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(key);
                    }
                  }}
                >
                  <title>
                    {MUSCLES[key].label}
                    {training[key] ? ` — ${muscleRoleLabel(training[key].role)} na semana` : ""}
                  </title>
                </path>
                <path
                  d={d}
                  className="anatomical-focus"
                  vectorEffect="non-scaling-stroke"
                  aria-hidden="true"
                />
              </Fragment>
            ))}
            {selected && REGIONS[view][selected] && (
              <path
                d={REGIONS[view][selected]}
                className="anatomical-selection"
                vectorEffect="non-scaling-stroke"
                aria-hidden="true"
              />
            )}
          </svg>
        )}
        {showNames && selected && REGIONS[view][selected] && (
          <span className="anatomical-label">{MUSCLES[selected].label}</span>
        )}
      </div>
      <figcaption>{view === "front" ? "Frente" : "Costas"}</figcaption>
    </figure>
  );
}
