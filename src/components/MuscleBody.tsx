import { useId, type CSSProperties, type ReactNode } from "react";

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

export type MuscleRole = "primary" | "secondary" | "tertiary";
export type BodyGender = "male" | "female";
export type MuscleLevels = Partial<Record<MuscleKey, number>>;
export type MuscleState = Partial<
  Record<MuscleKey, { level: number; role: MuscleRole; score: number }>
>;

const ROLE_FILL: Record<MuscleRole, string> = {
  primary: "var(--muscle-primary)",
  secondary: "var(--muscle-secondary)",
  tertiary: "var(--muscle-tertiary)",
};

const levelOpacity = (level: number) => {
  if (level >= 4) return 1;
  if (level === 3) return 0.92;
  if (level === 2) return 0.78;
  if (level === 1) return 0.62;
  return 1;
};

function MusclePath({
  d,
  k,
  levels,
  state,
}: {
  d: string;
  k: MuscleKey;
  levels?: MuscleLevels;
  state?: MuscleState;
}) {
  const activation = state?.[k];
  const level = activation?.level ?? levels?.[k] ?? 0;
  const fill = activation ? ROLE_FILL[activation.role] : level > 0 ? "var(--muscle-primary)" : "var(--muscle-idle)";
  const style: CSSProperties = {
    opacity: levelOpacity(level),
    transition: "fill 220ms ease, opacity 220ms ease, filter 220ms ease",
    filter: level >= 3 ? "drop-shadow(0 0 7px var(--muscle-glow))" : undefined,
  };

  return (
    <path d={d} fill={fill} stroke="var(--body-muscle-stroke)" strokeWidth={0.75} style={style}>
      <title>
        {k}: {activation ? activation.role : "sem atividade"}, nível {level} de 4
      </title>
    </path>
  );
}

function BodyBase({ gender, view, gradientId }: { gender: BodyGender; view: "front" | "back"; gradientId: string }) {
  const female = gender === "female";
  const torso = female
    ? "M61 78 Q100 64 139 78 Q143 112 139 152 Q136 183 144 208 Q126 222 100 222 Q74 222 56 208 Q64 183 61 152 Q57 112 61 78 Z"
    : "M52 78 Q100 57 148 78 Q151 120 143 165 Q140 190 147 211 Q124 222 100 222 Q76 222 53 211 Q60 190 57 165 Q49 120 52 78 Z";
  const hips = female
    ? "M58 203 Q77 218 100 218 Q123 218 142 203 L148 252 Q127 268 100 268 Q73 268 52 252 Z"
    : "M57 205 Q78 216 100 216 Q122 216 143 205 L145 248 Q123 259 100 259 Q77 259 55 248 Z";
  const leftArm = female
    ? "M59 84 Q40 98 35 137 Q31 169 36 191 L47 188 Q46 161 52 136 Q58 110 69 93 Z"
    : "M53 84 Q31 100 27 140 Q25 171 31 193 L43 190 Q43 160 49 133 Q55 106 66 92 Z";
  const rightArm = female
    ? "M141 84 Q160 98 165 137 Q169 169 164 191 L153 188 Q154 161 148 136 Q142 110 131 93 Z"
    : "M147 84 Q169 100 173 140 Q175 171 169 193 L157 190 Q157 160 151 133 Q145 106 134 92 Z";
  const leftForearm = female
    ? "M36 188 Q31 225 37 269 L50 269 Q47 226 47 188 Z"
    : "M31 189 Q25 229 32 274 L46 274 Q43 229 43 189 Z";
  const rightForearm = female
    ? "M164 188 Q169 225 163 269 L150 269 Q153 226 153 188 Z"
    : "M169 189 Q175 229 168 274 L154 274 Q157 229 157 189 Z";
  const leftLeg = female
    ? "M58 247 Q61 311 66 390 Q69 416 73 425 L94 425 Q96 354 94 267 Z"
    : "M58 244 Q61 312 66 390 Q68 416 72 425 L94 425 Q96 351 92 257 Z";
  const rightLeg = female
    ? "M142 247 Q139 311 134 390 Q131 416 127 425 L106 425 Q104 354 106 267 Z"
    : "M142 244 Q139 312 134 390 Q132 416 128 425 L106 425 Q104 351 108 257 Z";

  return (
    <g>
      <g fill={`url(#${gradientId})`} stroke="var(--body-outline)" strokeWidth="1.25">
        <ellipse cx="100" cy="31" rx={female ? 20 : 22} ry="26" />
        <path d={female ? "M89 52 Q100 58 111 52 L112 70 Q100 76 88 70 Z" : "M88 52 Q100 58 112 52 L114 70 Q100 77 86 70 Z"} />
        <path d={torso} />
        <path d={hips} />
        <path d={leftArm} />
        <path d={rightArm} />
        <path d={leftForearm} />
        <path d={rightForearm} />
        <path d={leftLeg} />
        <path d={rightLeg} />
      </g>
      <g fill="none" stroke="var(--body-guide)" strokeWidth="0.75" opacity="0.55">
        <path d="M100 75 V258" />
        {view === "front" ? (
          <>
            <path d="M69 126 Q100 145 131 126" />
            <path d="M82 211 Q100 218 118 211" />
          </>
        ) : (
          <>
            <path d="M66 103 Q100 82 134 103" />
            <path d="M75 207 Q100 219 125 207" />
          </>
        )}
      </g>
    </g>
  );
}

function SvgShell({ children, label, gradientId }: { children: ReactNode; label: string; gradientId: string }) {
  return (
    <svg viewBox="0 0 200 440" className="h-full w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--body-base-light)" />
          <stop offset="0.55" stopColor="var(--body-base)" />
          <stop offset="1" stopColor="var(--body-base-dark)" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export function BodyFront({
  levels,
  state,
  gender = "male",
}: {
  levels?: MuscleLevels;
  state?: MuscleState;
  gender?: BodyGender;
}) {
  const female = gender === "female";
  const gradientId = `body-shell-${useId().replace(/:/g, "")}`;
  return (
    <SvgShell label={`Corpo ${female ? "feminino" : "masculino"}, vista frontal`} gradientId={gradientId}>
      <BodyBase gender={gender} view="front" gradientId={gradientId} />

      <MusclePath k="chest" levels={levels} state={state} d={female ? "M70 91 Q83 84 98 90 L98 130 Q83 137 66 127 Q64 106 70 91 Z" : "M65 88 Q82 82 98 89 L98 132 Q80 140 61 128 Q59 104 65 88 Z"} />
      <MusclePath k="chest" levels={levels} state={state} d={female ? "M130 91 Q117 84 102 90 L102 130 Q117 137 134 127 Q136 106 130 91 Z" : "M135 88 Q118 82 102 89 L102 132 Q120 140 139 128 Q141 104 135 88 Z"} />

      <MusclePath k="shoulders" levels={levels} state={state} d="M59 79 Q49 88 50 108 Q58 116 69 105 Q72 91 65 82 Z" />
      <MusclePath k="shoulders" levels={levels} state={state} d="M141 79 Q151 88 150 108 Q142 116 131 105 Q128 91 135 82 Z" />

      <MusclePath k="biceps" levels={levels} state={state} d="M43 111 Q34 136 37 168 Q42 179 49 166 Q52 139 48 116 Z" />
      <MusclePath k="biceps" levels={levels} state={state} d="M157 111 Q166 136 163 168 Q158 179 151 166 Q148 139 152 116 Z" />
      <MusclePath k="forearms" levels={levels} state={state} d="M36 188 Q31 222 37 262 L48 262 Q47 225 46 190 Z" />
      <MusclePath k="forearms" levels={levels} state={state} d="M164 188 Q169 222 163 262 L152 262 Q153 225 154 190 Z" />

      <MusclePath k="abs" levels={levels} state={state} d="M87 136 Q100 132 113 136 L111 158 Q100 162 89 158 Z" />
      <MusclePath k="abs" levels={levels} state={state} d="M88 161 Q100 157 112 161 L111 182 Q100 186 89 182 Z" />
      <MusclePath k="abs" levels={levels} state={state} d="M89 185 Q100 181 111 185 L110 207 Q100 211 90 207 Z" />
      <MusclePath k="obliques" levels={levels} state={state} d="M66 139 Q78 147 84 166 L84 207 Q72 204 63 189 Q60 162 66 139 Z" />
      <MusclePath k="obliques" levels={levels} state={state} d="M134 139 Q122 147 116 166 L116 207 Q128 204 137 189 Q140 162 134 139 Z" />

      <MusclePath k="quads" levels={levels} state={state} d="M61 261 Q66 303 69 347 Q72 365 83 374 Q93 354 91 268 Q77 258 61 261 Z" />
      <MusclePath k="quads" levels={levels} state={state} d="M139 261 Q134 303 131 347 Q128 365 117 374 Q107 354 109 268 Q123 258 139 261 Z" />
      <MusclePath k="calves" levels={levels} state={state} d="M70 370 Q72 399 78 416 L90 416 Q90 389 87 374 Q79 366 70 370 Z" />
      <MusclePath k="calves" levels={levels} state={state} d="M130 370 Q128 399 122 416 L110 416 Q110 389 113 374 Q121 366 130 370 Z" />
    </SvgShell>
  );
}

export function BodyBack({
  levels,
  state,
  gender = "male",
}: {
  levels?: MuscleLevels;
  state?: MuscleState;
  gender?: BodyGender;
}) {
  const female = gender === "female";
  const gradientId = `body-shell-${useId().replace(/:/g, "")}`;
  return (
    <SvgShell label={`Corpo ${female ? "feminino" : "masculino"}, vista posterior`} gradientId={gradientId}>
      <BodyBase gender={gender} view="back" gradientId={gradientId} />

      <MusclePath k="traps" levels={levels} state={state} d="M88 66 Q100 61 112 66 L123 89 Q111 96 100 103 Q89 96 77 89 Z" />
      <MusclePath k="traps" levels={levels} state={state} d="M76 91 Q100 99 124 91 L119 111 Q100 117 81 111 Z" />
      <MusclePath k="traps" levels={levels} state={state} d="M82 113 Q100 119 118 113 L108 157 L100 170 L92 157 Z" />

      <MusclePath k="rear_delts" levels={levels} state={state} d="M58 80 Q48 89 50 109 Q57 118 69 106 Q72 91 65 82 Z" />
      <MusclePath k="rear_delts" levels={levels} state={state} d="M142 80 Q152 89 150 109 Q143 118 131 106 Q128 91 135 82 Z" />

      <MusclePath k="lats" levels={levels} state={state} d="M65 101 Q82 112 93 128 L91 181 Q73 184 60 166 Q57 132 65 101 Z" />
      <MusclePath k="lats" levels={levels} state={state} d="M135 101 Q118 112 107 128 L109 181 Q127 184 140 166 Q143 132 135 101 Z" />
      <MusclePath k="lower_back" levels={levels} state={state} d="M86 174 Q100 181 114 174 L116 211 Q100 218 84 211 Z" />

      <MusclePath k="triceps" levels={levels} state={state} d="M42 112 Q34 138 38 171 Q43 179 49 166 Q51 137 47 116 Z" />
      <MusclePath k="triceps" levels={levels} state={state} d="M158 112 Q166 138 162 171 Q157 179 151 166 Q149 137 153 116 Z" />
      <MusclePath k="forearms" levels={levels} state={state} d="M36 188 Q31 222 37 262 L48 262 Q47 225 46 190 Z" />
      <MusclePath k="forearms" levels={levels} state={state} d="M164 188 Q169 222 163 262 L152 262 Q153 225 154 190 Z" />

      <MusclePath k="glutes" levels={levels} state={state} d={female ? "M57 217 Q76 211 96 223 L94 261 Q74 272 57 252 Q52 235 57 217 Z" : "M59 216 Q77 212 96 223 L94 259 Q75 267 59 250 Q55 233 59 216 Z"} />
      <MusclePath k="glutes" levels={levels} state={state} d={female ? "M143 217 Q124 211 104 223 L106 261 Q126 272 143 252 Q148 235 143 217 Z" : "M141 216 Q123 212 104 223 L106 259 Q125 267 141 250 Q145 233 141 216 Z"} />

      <MusclePath k="hamstrings" levels={levels} state={state} d="M64 266 Q69 308 72 356 Q77 367 88 360 Q92 318 90 271 Q77 262 64 266 Z" />
      <MusclePath k="hamstrings" levels={levels} state={state} d="M136 266 Q131 308 128 356 Q123 367 112 360 Q108 318 110 271 Q123 262 136 266 Z" />
      <MusclePath k="calves" levels={levels} state={state} d="M70 363 Q70 396 78 419 L90 419 Q91 389 87 368 Q78 359 70 363 Z" />
      <MusclePath k="calves" levels={levels} state={state} d="M130 363 Q130 396 122 419 L110 419 Q109 389 113 368 Q122 359 130 363 Z" />
    </SvgShell>
  );
}

export function MuscleBody({
  view,
  gender = "male",
  state,
  levels,
}: {
  view: "front" | "back";
  gender?: BodyGender;
  state?: MuscleState;
  levels?: MuscleLevels;
}) {
  return view === "front" ? (
    <BodyFront gender={gender} state={state} levels={levels} />
  ) : (
    <BodyBack gender={gender} state={state} levels={levels} />
  );
}
