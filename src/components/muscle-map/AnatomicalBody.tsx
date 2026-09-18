import { useState } from "react";
import type { MuscleKey } from "@/components/MuscleBody";
import { MUSCLES, REGIONS, type BodyView } from "./anatomy";

export function AnatomicalBody({
  view,
  selected,
  trained = [],
  showNames,
  onSelect,
}: {
  view: BodyView;
  selected: MuscleKey | null;
  trained?: MuscleKey[];
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
              <path
                key={key}
                d={d}
                role="button"
                tabIndex={0}
                aria-label={MUSCLES[key].label}
                aria-pressed={selected === key}
                data-muscle={key}
                data-selected={selected === key}
                data-trained={trained.includes(key)}
                className="anatomical-region"
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
                  {trained.includes(key) ? " — registrado na semana" : ""}
                </title>
              </path>
            ))}
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
