import type { CSSProperties } from "react";

export type MuscleKey =
  | "chest" | "abs" | "obliques" | "shoulders" | "biceps" | "forearms" | "quads" | "calves"
  | "traps" | "lats" | "lower_back" | "glutes" | "hamstrings" | "triceps" | "rear_delts";

export type MuscleLevels = Partial<Record<MuscleKey, number>>; // 0..4

const levelToFill = (lvl: number): string => {
  if (lvl <= 0) return "#45404e";          // gray
  if (lvl === 1) return "oklch(0.55 0.12 300 / 0.55)"; // pouco
  if (lvl === 2) return "oklch(0.72 0.20 300 / 0.85)"; // médio
  if (lvl === 3) return "#af74ed";        // alto
  return "#d3afff";                       // neon forte
};

const levelToGlow = (lvl: number): CSSProperties => ({
  filter: lvl >= 3 ? "drop-shadow(0 0 6px oklch(0.76 0.19 300 / 0.7))" : undefined,
});

function M({ d, k, levels }: { d: string; k: MuscleKey; levels: MuscleLevels }) {
  const lvl = levels[k] ?? 0;
  return (
    <path
      d={d}
      fill={levelToFill(lvl)}
      stroke="oklch(0.04 0 0)"
      strokeWidth={0.8}
      style={{ transition: "fill 0.4s ease", ...levelToGlow(lvl) }}
    ><title>{k}: nível {lvl} de 4</title></path>
  );
}

/** Stylized anatomical body — front view */
export function BodyFront({ levels }: { levels: MuscleLevels }) {
  return (
    <svg viewBox="0 0 200 420" className="w-full h-full" aria-label="Corpo frente">
      {/* Silhouette base */}
      <g fill="#292631" stroke="#595264" strokeWidth="1">
        {/* Head */}
        <ellipse cx="100" cy="32" rx="22" ry="26" />
        {/* Neck */}
        <rect x="90" y="54" width="20" height="14" rx="4" />
        {/* Torso */}
        <path d="M55 78 Q100 60 145 78 L150 200 Q100 215 50 200 Z" />
        {/* Hips */}
        <path d="M55 195 Q100 210 145 195 L150 240 Q100 255 50 240 Z" />
        {/* Arms */}
        <path d="M50 82 Q30 110 32 170 L42 175 Q48 130 58 95 Z" />
        <path d="M150 82 Q170 110 168 170 L158 175 Q152 130 142 95 Z" />
        <path d="M32 170 Q28 220 36 260 L48 260 Q44 220 42 175 Z" />
        <path d="M168 170 Q172 220 164 260 L152 260 Q156 220 158 175 Z" />
        {/* Legs */}
        <path d="M60 240 Q70 320 70 400 L92 400 Q94 320 92 240 Z" />
        <path d="M140 240 Q130 320 130 400 L108 400 Q106 320 108 240 Z" />
      </g>

      {/* Muscle overlays */}
      {/* Chest L/R */}
      <M k="chest" levels={levels} d="M70 90 Q98 85 98 130 Q80 138 62 128 Q60 105 70 90 Z" />
      <M k="chest" levels={levels} d="M130 90 Q102 85 102 130 Q120 138 138 128 Q140 105 130 90 Z" />
      {/* Shoulders (delts) */}
      <M k="shoulders" levels={levels} d="M55 80 Q48 92 52 110 Q66 110 70 92 Q66 82 55 80 Z" />
      <M k="shoulders" levels={levels} d="M145 80 Q152 92 148 110 Q134 110 130 92 Q134 82 145 80 Z" />
      {/* Abs (6 pack) */}
      <M k="abs" levels={levels} d="M88 135 H112 V155 H88 Z" />
      <M k="abs" levels={levels} d="M88 158 H112 V178 H88 Z" />
      <M k="abs" levels={levels} d="M88 181 H112 V205 H88 Z" />
      {/* Obliques */}
      <M k="obliques" levels={levels} d="M70 145 Q82 155 84 200 L72 200 Q60 180 70 145 Z" />
      <M k="obliques" levels={levels} d="M130 145 Q118 155 116 200 L128 200 Q140 180 130 145 Z" />
      {/* Biceps */}
      <M k="biceps" levels={levels} d="M36 115 Q30 145 38 168 Q48 165 48 140 Q46 120 36 115 Z" />
      <M k="biceps" levels={levels} d="M164 115 Q170 145 162 168 Q152 165 152 140 Q154 120 164 115 Z" />
      {/* Forearms */}
      <M k="forearms" levels={levels} d="M32 175 Q28 210 36 250 L46 250 Q42 215 42 180 Z" />
      <M k="forearms" levels={levels} d="M168 175 Q172 210 164 250 L154 250 Q158 215 158 180 Z" />
      {/* Quads */}
      <M k="quads" levels={levels} d="M64 245 Q72 310 72 380 L90 380 Q92 310 88 245 Z" />
      <M k="quads" levels={levels} d="M136 245 Q128 310 128 380 L110 380 Q108 310 112 245 Z" />
      {/* Calves visible front (shins) — leave subtle */}
    </svg>
  );
}

/** Back view */
export function BodyBack({ levels }: { levels: MuscleLevels }) {
  return (
    <svg viewBox="0 0 200 420" className="w-full h-full" aria-label="Corpo costas">
      {/* Silhouette base */}
      <g fill="#292631" stroke="#595264" strokeWidth="1">
        <ellipse cx="100" cy="32" rx="22" ry="26" />
        <rect x="90" y="54" width="20" height="14" rx="4" />
        <path d="M55 78 Q100 60 145 78 L150 200 Q100 215 50 200 Z" />
        <path d="M55 195 Q100 210 145 195 L150 240 Q100 255 50 240 Z" />
        <path d="M50 82 Q30 110 32 170 L42 175 Q48 130 58 95 Z" />
        <path d="M150 82 Q170 110 168 170 L158 175 Q152 130 142 95 Z" />
        <path d="M32 170 Q28 220 36 260 L48 260 Q44 220 42 175 Z" />
        <path d="M168 170 Q172 220 164 260 L152 260 Q156 220 158 175 Z" />
        <path d="M60 240 Q70 320 70 400 L92 400 Q94 320 92 240 Z" />
        <path d="M140 240 Q130 320 130 400 L108 400 Q106 320 108 240 Z" />
      </g>

      {/* Traps */}
      <M k="traps" levels={levels} d="M82 70 Q100 60 118 70 Q112 92 100 95 Q88 92 82 70 Z" />
      {/* Rear delts */}
      <M k="rear_delts" levels={levels} d="M55 80 Q48 92 52 112 Q66 112 70 94 Q66 82 55 80 Z" />
      <M k="rear_delts" levels={levels} d="M145 80 Q152 92 148 112 Q134 112 130 94 Q134 82 145 80 Z" />
      {/* Lats */}
      <M k="lats" levels={levels} d="M62 100 Q80 115 92 175 Q72 180 58 165 Q56 130 62 100 Z" />
      <M k="lats" levels={levels} d="M138 100 Q120 115 108 175 Q128 180 142 165 Q144 130 138 100 Z" />
      {/* Lower back */}
      <M k="lower_back" levels={levels} d="M88 180 H112 V215 H88 Z" />
      {/* Triceps */}
      <M k="triceps" levels={levels} d="M36 115 Q30 145 38 168 Q48 165 48 140 Q46 120 36 115 Z" />
      <M k="triceps" levels={levels} d="M164 115 Q170 145 162 168 Q152 165 152 140 Q154 120 164 115 Z" />
      {/* Glutes */}
      <M k="glutes" levels={levels} d="M62 220 Q82 248 92 268 L72 268 Q56 250 62 220 Z" />
      <M k="glutes" levels={levels} d="M138 220 Q118 248 108 268 L128 268 Q144 250 138 220 Z" />
      {/* Hamstrings */}
      <M k="hamstrings" levels={levels} d="M68 270 Q74 320 76 360 L90 360 Q90 320 86 270 Z" />
      <M k="hamstrings" levels={levels} d="M132 270 Q126 320 124 360 L110 360 Q110 320 114 270 Z" />
      {/* Calves */}
      <M k="calves" levels={levels} d="M72 360 Q74 390 80 405 L90 405 Q90 380 88 360 Z" />
      <M k="calves" levels={levels} d="M128 360 Q126 390 120 405 L110 405 Q110 380 112 360 Z" />
    </svg>
  );
}
