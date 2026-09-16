import type { CSSProperties } from "react";

export type MuscleKey =
  | "chest"
  | "abs"
  | "obliques"
  | "shoulders"
  | "biceps"
  | "forearms"
  | "quads"
  | "calves"
  | "traps"
  | "lats"
  | "lower_back"
  | "glutes"
  | "hamstrings"
  | "triceps"
  | "rear_delts";

export type MuscleLevels = Partial<Record<MuscleKey, number>>; // 0..4

const ACTIVE_FILLS = [
  "rgba(96, 76, 125, 0.34)",
  "rgba(153, 104, 222, 0.48)",
  "rgba(185, 128, 255, 0.74)",
  "rgba(220, 186, 255, 0.92)",
] as const;

function levelFill(level: number) {
  if (level <= 0) return "rgba(110, 118, 138, 0.22)";
  return ACTIVE_FILLS[Math.min(level - 1, ACTIVE_FILLS.length - 1)];
}

function levelStroke(level: number) {
  if (level <= 0) return "rgba(226, 231, 245, 0.16)";
  if (level === 1) return "rgba(186, 154, 255, 0.42)";
  if (level === 2) return "rgba(208, 179, 255, 0.6)";
  return "rgba(239, 226, 255, 0.92)";
}

function levelStyle(level: number): CSSProperties {
  return {
    transition: "fill 240ms ease, opacity 240ms ease, filter 240ms ease, stroke 240ms ease",
    filter:
      level >= 4
        ? "drop-shadow(0 0 12px rgba(184,122,255,0.55))"
        : level >= 3
          ? "drop-shadow(0 0 8px rgba(184,122,255,0.36))"
          : level >= 2
            ? "drop-shadow(0 0 5px rgba(184,122,255,0.24))"
            : undefined,
  };
}

function MuscleShape({ d, k, levels }: { d: string; k: MuscleKey; levels: MuscleLevels }) {
  const level = levels[k] ?? 0;
  return (
    <path
      d={d}
      fill={levelFill(level)}
      stroke={levelStroke(level)}
      strokeWidth={1.35}
      style={levelStyle(level)}
    >
      <title>{k}: nível {level} de 4</title>
    </path>
  );
}

function SharedDefs() {
  return (
    <defs>
      <linearGradient id="eforge-body-base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(198,203,214,0.34)" />
        <stop offset="38%" stopColor="rgba(110,118,138,0.22)" />
        <stop offset="100%" stopColor="rgba(73,79,94,0.16)" />
      </linearGradient>
      <linearGradient id="eforge-edge-shine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.56)" />
        <stop offset="35%" stopColor="rgba(255,255,255,0.18)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
      </linearGradient>
      <radialGradient id="eforge-core-glow" cx="50%" cy="28%" r="66%">
        <stop offset="0%" stopColor="rgba(168, 120, 255, 0.20)" />
        <stop offset="100%" stopColor="rgba(168, 120, 255, 0)" />
      </radialGradient>
    </defs>
  );
}

function BodyShellFront() {
  return (
    <g>
      <ellipse cx="110" cy="32" rx="23" ry="27" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.2" />
      <path d="M97 56 Q110 50 123 56 Q122 71 110 73 Q98 71 97 56 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M58 88 Q78 64 110 66 Q142 64 162 88 Q160 120 154 158 Q148 198 145 226 Q129 244 110 246 Q91 244 75 226 Q72 198 66 158 Q60 120 58 88 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.15" />
      <path d="M75 226 Q90 238 110 238 Q130 238 145 226 Q146 255 150 281 Q136 296 110 297 Q84 296 70 281 Q74 255 75 226 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.05" />
      <path d="M54 90 Q38 112 35 149 Q33 175 41 191 Q48 184 52 170 Q48 125 60 99 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M166 90 Q182 112 185 149 Q187 175 179 191 Q172 184 168 170 Q172 125 160 99 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M41 191 Q34 233 43 286 Q47 307 57 317 Q62 304 62 278 Q55 236 54 191 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M179 191 Q186 233 177 286 Q173 307 163 317 Q158 304 158 278 Q165 236 166 191 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M79 282 Q87 347 87 420 Q87 432 85 441 L103 441 Q106 353 106 296 Q92 294 79 282 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M141 282 Q133 347 133 420 Q133 432 135 441 L117 441 Q114 353 114 296 Q128 294 141 282 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M82 442 Q74 457 74 474 Q82 482 95 474 Q96 454 103 441 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M138 442 Q146 457 146 474 Q138 482 125 474 Q124 454 117 441 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M57 316 Q48 327 46 342 Q50 352 61 348 Q66 334 66 321 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M163 316 Q172 327 174 342 Q170 352 159 348 Q154 334 154 321 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
    </g>
  );
}

function BodyShellBack() {
  return (
    <g>
      <ellipse cx="110" cy="32" rx="23" ry="27" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.2" />
      <path d="M97 56 Q110 50 123 56 Q122 71 110 73 Q98 71 97 56 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M58 88 Q78 64 110 66 Q142 64 162 88 Q160 120 154 158 Q148 198 145 226 Q129 244 110 246 Q91 244 75 226 Q72 198 66 158 Q60 120 58 88 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.15" />
      <path d="M75 226 Q90 238 110 238 Q130 238 145 226 Q146 255 150 281 Q136 296 110 297 Q84 296 70 281 Q74 255 75 226 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1.05" />
      <path d="M54 90 Q38 112 35 149 Q33 175 41 191 Q48 184 52 170 Q48 125 60 99 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M166 90 Q182 112 185 149 Q187 175 179 191 Q172 184 168 170 Q172 125 160 99 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M41 191 Q34 233 43 286 Q47 307 57 317 Q62 304 62 278 Q55 236 54 191 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M179 191 Q186 233 177 286 Q173 307 163 317 Q158 304 158 278 Q165 236 166 191 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M79 282 Q87 347 87 420 Q87 432 85 441 L103 441 Q106 353 106 296 Q92 294 79 282 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M141 282 Q133 347 133 420 Q133 432 135 441 L117 441 Q114 353 114 296 Q128 294 141 282 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M82 442 Q74 457 74 474 Q82 482 95 474 Q96 454 103 441 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M138 442 Q146 457 146 474 Q138 482 125 474 Q124 454 117 441 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M57 316 Q48 327 46 342 Q50 352 61 348 Q66 334 66 321 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
      <path d="M163 316 Q172 327 174 342 Q170 352 159 348 Q154 334 154 321 Z" fill="url(#eforge-body-base)" stroke="url(#eforge-edge-shine)" strokeWidth="1" />
    </g>
  );
}

export function BodyFront({ levels }: { levels: MuscleLevels }) {
  return (
    <svg viewBox="0 0 220 490" className="h-full w-full" aria-label="Corpo frente">
      <SharedDefs />
      <rect x="0" y="0" width="220" height="490" fill="transparent" />
      <ellipse cx="110" cy="220" rx="90" ry="190" fill="url(#eforge-core-glow)" opacity="0.55" />
      <BodyShellFront />

      <MuscleShape k="shoulders" levels={levels} d="M54 92 Q42 108 47 136 Q57 144 73 140 Q78 119 73 100 Q65 90 54 92 Z" />
      <MuscleShape k="shoulders" levels={levels} d="M166 92 Q178 108 173 136 Q163 144 147 140 Q142 119 147 100 Q155 90 166 92 Z" />
      <MuscleShape k="chest" levels={levels} d="M73 98 Q93 86 108 92 Q111 114 108 143 Q91 148 68 136 Q64 116 73 98 Z" />
      <MuscleShape k="chest" levels={levels} d="M147 98 Q127 86 112 92 Q109 114 112 143 Q129 148 152 136 Q156 116 147 98 Z" />
      <MuscleShape k="abs" levels={levels} d="M96 145 Q110 141 124 145 L122 172 Q110 176 98 172 Z" />
      <MuscleShape k="abs" levels={levels} d="M96 176 Q110 171 124 176 L122 203 Q110 206 98 203 Z" />
      <MuscleShape k="abs" levels={levels} d="M96 207 Q110 204 124 207 L121 235 Q110 239 99 235 Z" />
      <MuscleShape k="obliques" levels={levels} d="M78 149 Q90 164 89 232 Q78 235 71 224 Q69 181 78 149 Z" />
      <MuscleShape k="obliques" levels={levels} d="M142 149 Q130 164 131 232 Q142 235 149 224 Q151 181 142 149 Z" />
      <MuscleShape k="biceps" levels={levels} d="M45 145 Q36 171 41 197 Q47 203 56 198 Q64 173 60 150 Q52 142 45 145 Z" />
      <MuscleShape k="biceps" levels={levels} d="M175 145 Q184 171 179 197 Q173 203 164 198 Q156 173 160 150 Q168 142 175 145 Z" />
      <MuscleShape k="forearms" levels={levels} d="M45 203 Q39 242 49 299 Q56 303 63 296 Q64 250 56 201 Z" />
      <MuscleShape k="forearms" levels={levels} d="M175 203 Q181 242 171 299 Q164 303 157 296 Q156 250 164 201 Z" />
      <MuscleShape k="quads" levels={levels} d="M79 286 Q92 321 93 438 Q80 443 69 433 Q66 351 79 286 Z" />
      <MuscleShape k="quads" levels={levels} d="M141 286 Q128 321 127 438 Q140 443 151 433 Q154 351 141 286 Z" />
      <MuscleShape k="calves" levels={levels} d="M79 377 Q71 407 75 442 Q81 447 89 442 Q94 408 92 380 Z" />
      <MuscleShape k="calves" levels={levels} d="M141 377 Q149 407 145 442 Q139 447 131 442 Q126 408 128 380 Z" />

      <path d="M110 75 L110 240" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <path d="M87 285 Q100 300 110 297 Q120 300 133 285" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function BodyBack({ levels }: { levels: MuscleLevels }) {
  return (
    <svg viewBox="0 0 220 490" className="h-full w-full" aria-label="Corpo costas">
      <SharedDefs />
      <rect x="0" y="0" width="220" height="490" fill="transparent" />
      <ellipse cx="110" cy="220" rx="90" ry="190" fill="url(#eforge-core-glow)" opacity="0.55" />
      <BodyShellBack />

      <MuscleShape k="traps" levels={levels} d="M92 67 Q110 58 128 67 Q134 98 126 143 L110 166 L94 143 Q86 98 92 67 Z" />
      <MuscleShape k="rear_delts" levels={levels} d="M54 93 Q44 106 47 134 Q58 142 74 139 Q78 121 73 102 Q64 91 54 93 Z" />
      <MuscleShape k="rear_delts" levels={levels} d="M166 93 Q176 106 173 134 Q162 142 146 139 Q142 121 147 102 Q156 91 166 93 Z" />
      <MuscleShape k="lats" levels={levels} d="M73 106 Q86 121 95 212 Q80 220 65 205 Q60 154 73 106 Z" />
      <MuscleShape k="lats" levels={levels} d="M147 106 Q134 121 125 212 Q140 220 155 205 Q160 154 147 106 Z" />
      <MuscleShape k="lower_back" levels={levels} d="M98 188 Q110 183 122 188 L121 237 Q110 243 99 237 Z" />
      <MuscleShape k="triceps" levels={levels} d="M45 145 Q36 171 41 197 Q47 203 56 198 Q64 173 60 150 Q52 142 45 145 Z" />
      <MuscleShape k="triceps" levels={levels} d="M175 145 Q184 171 179 197 Q173 203 164 198 Q156 173 160 150 Q168 142 175 145 Z" />
      <MuscleShape k="forearms" levels={levels} d="M45 203 Q39 242 49 299 Q56 303 63 296 Q64 250 56 201 Z" />
      <MuscleShape k="forearms" levels={levels} d="M175 203 Q181 242 171 299 Q164 303 157 296 Q156 250 164 201 Z" />
      <MuscleShape k="glutes" levels={levels} d="M78 241 Q98 247 105 280 Q89 294 70 286 Q63 261 78 241 Z" />
      <MuscleShape k="glutes" levels={levels} d="M142 241 Q122 247 115 280 Q131 294 150 286 Q157 261 142 241 Z" />
      <MuscleShape k="hamstrings" levels={levels} d="M80 289 Q91 337 92 435 Q82 441 72 435 Q69 337 80 289 Z" />
      <MuscleShape k="hamstrings" levels={levels} d="M140 289 Q129 337 128 435 Q138 441 148 435 Q151 337 140 289 Z" />
      <MuscleShape k="calves" levels={levels} d="M79 381 Q70 410 75 444 Q82 449 90 444 Q95 409 92 382 Z" />
      <MuscleShape k="calves" levels={levels} d="M141 381 Q150 410 145 444 Q138 449 130 444 Q125 409 128 382 Z" />

      <path d="M110 74 L110 442" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}
