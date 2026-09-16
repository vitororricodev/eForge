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
export type MuscleState = Partial<Record<MuscleKey, { level: number; role: MuscleRole; score: number }>>;

const levelOpacity = (level: number) => {
  if (level >= 4) return 1;
  if (level === 3) return 0.94;
  if (level === 2) return 0.82;
  if (level === 1) return 0.68;
  return 1;
};

function MuscleShape({
  paths,
  k,
  levels,
  state,
  gradientId,
}: {
  paths: string[];
  k: MuscleKey;
  levels?: MuscleLevels;
  state?: MuscleState;
  gradientId: string;
}) {
  const activation = state?.[k];
  const level = activation?.level ?? levels?.[k] ?? 0;
  const role = activation?.role;
  const fill = role
    ? `url(#${gradientId}-${role})`
    : level > 0
      ? `url(#${gradientId}-primary)`
      : `url(#${gradientId}-idle)`;
  const style: CSSProperties = {
    opacity: level === 0 ? 0.78 : levelOpacity(level),
    transition: "fill 220ms ease, opacity 220ms ease, filter 220ms ease",
    filter: level >= 3 ? "drop-shadow(0 0 11px var(--muscle-glow))" : undefined,
  };

  return (
    <g
      fill={fill}
      stroke={level > 0 ? "var(--body-active-stroke)" : "var(--body-muscle-stroke)"}
      strokeWidth={3}
      strokeLinejoin="round"
      style={style}
    >
      {paths.map((d, index) => (
        <path d={d} key={`${k}-${index}`}>
          <title>
            {k}: {activation ? activation.role : "sem atividade"}, nível {level} de 4
          </title>
        </path>
      ))}
    </g>
  );
}

function NeutralShape({ d, gradientId }: { d: string; gradientId: string }) {
  return (
    <path
      d={d}
      fill={`url(#${gradientId}-neutral)`}
      stroke="var(--body-muscle-stroke)"
      strokeWidth={3}
      strokeLinejoin="round"
      opacity={0.78}
    />
  );
}

function SvgShell({ children, label, gradientId }: { children: ReactNode; label: string; gradientId: string }) {
  return (
    <svg viewBox="100 40 460 820" className="h-full w-full" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`${gradientId}-neutral`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--body-base-highlight)" />
          <stop offset="0.28" stopColor="var(--body-base-light)" />
          <stop offset="0.65" stopColor="var(--body-base)" />
          <stop offset="1" stopColor="var(--body-base-dark)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-idle`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--muscle-idle-light)" />
          <stop offset="0.48" stopColor="var(--muscle-idle)" />
          <stop offset="1" stopColor="var(--muscle-idle-dark)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-primary`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--muscle-primary-light)" />
          <stop offset="0.42" stopColor="var(--muscle-primary)" />
          <stop offset="1" stopColor="var(--muscle-primary-dark)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-secondary`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--muscle-secondary-light)" />
          <stop offset="0.42" stopColor="var(--muscle-secondary)" />
          <stop offset="1" stopColor="var(--muscle-secondary-dark)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-tertiary`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--muscle-tertiary-light)" />
          <stop offset="0.42" stopColor="var(--muscle-tertiary)" />
          <stop offset="1" stopColor="var(--muscle-tertiary-dark)" />
        </linearGradient>
        <filter id={`${gradientId}-depth`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#${gradientId}-depth)`}>{children}</g>
    </svg>
  );
}

function FrontFigure({ gender, levels, state, gradientId }: { gender: BodyGender; levels?: MuscleLevels; state?: MuscleState; gradientId: string }) {
  const female = gender === "female";
  const upperTransform = female ? "translate(330 0) scale(.94 1) translate(-330 0)" : undefined;
  const lowerTransform = female ? "translate(330 0) scale(1.035 1) translate(-330 0)" : undefined;

  return (
    <g>
      <g transform={upperTransform}>
        <NeutralShape gradientId={gradientId} d="M294 72 Q330 47 366 72 Q380 86 376 124 Q371 170 330 180 Q289 170 284 124 Q280 86 294 72Z" />
        <NeutralShape gradientId={gradientId} d="M301 154 Q312 184 330 207 Q348 184 359 154 L367 212 L293 212Z" />

        <MuscleShape gradientId={gradientId} k="traps" levels={levels} state={state} paths={["M294 188 C306 202 317 210 330 222 C343 210 354 202 366 188 L405 215 C373 215 350 225 333 246 L330 229 L327 246 C310 225 287 215 255 215Z"]} />
        <MuscleShape gradientId={gradientId} k="chest" levels={levels} state={state} paths={[
          "M327 245 C311 230 282 222 249 234 C240 246 241 275 254 297 C271 314 299 321 326 307 C329 288 329 265 327 245Z",
          "M333 245 C349 230 378 222 411 234 C420 246 419 275 406 297 C389 314 361 321 334 307 C331 288 331 265 333 245Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="shoulders" levels={levels} state={state} paths={[
          "M249 218 C223 214 199 226 190 252 C187 276 194 296 207 311 C216 283 229 260 256 243 C258 233 255 224 249 218Z",
          "M411 218 C437 214 461 226 470 252 C473 276 466 296 453 311 C444 283 431 260 404 243 C402 233 405 224 411 218Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="biceps" levels={levels} state={state} paths={[
          "M203 304 C184 326 179 366 188 402 C193 420 205 428 216 411 C226 381 231 346 235 318 C225 309 214 305 203 304Z",
          "M457 304 C476 326 481 366 472 402 C467 420 455 428 444 411 C434 381 429 346 425 318 C435 309 446 305 457 304Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="forearms" levels={levels} state={state} paths={[
          "M189 399 C178 427 166 467 154 511 C151 530 158 543 174 550 C188 510 202 466 216 419 C209 407 201 401 189 399Z",
          "M471 399 C482 427 494 467 506 511 C509 530 502 543 486 550 C472 510 458 466 444 419 C451 407 459 401 471 399Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="abs" levels={levels} state={state} paths={[
          "M304 323 C313 317 321 315 327 317 L326 365 C317 369 307 367 300 362Z",
          "M333 317 C339 315 347 317 356 323 L360 362 C353 367 343 369 334 365Z",
          "M299 370 C308 366 317 367 326 371 L325 414 C314 419 304 417 296 412Z",
          "M334 371 C343 367 352 366 361 370 L364 412 C356 417 346 419 335 414Z",
          "M296 420 C306 416 315 417 325 422 L324 466 C313 471 302 469 293 463Z",
          "M335 422 C345 417 354 416 364 420 L367 463 C358 469 347 471 336 466Z",
          "M294 471 C305 467 315 469 324 474 L323 501 C316 519 307 528 300 521 C294 508 291 488 294 471Z",
          "M336 474 C345 469 355 467 366 471 C369 488 366 508 360 521 C353 528 344 519 337 501Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="obliques" levels={levels} state={state} paths={[
          "M252 309 C267 320 279 326 292 320 C288 353 286 392 286 433 C281 452 274 466 264 471 C255 446 249 407 248 365 C248 339 249 320 252 309Z",
          "M408 309 C393 320 381 326 368 320 C372 353 374 392 374 433 C379 452 386 466 396 471 C405 446 411 407 412 365 C412 339 411 320 408 309Z",
        ]} />
        <NeutralShape gradientId={gradientId} d="M153 510 Q124 520 112 545 Q120 555 135 544 L126 574 Q133 579 142 555 L138 585 Q146 590 153 558 L153 588 Q163 589 166 555 L174 577 Q184 574 174 537Z M507 510 Q536 520 548 545 Q540 555 525 544 L534 574 Q527 579 518 555 L522 585 Q514 590 507 558 L507 588 Q497 589 494 555 L486 577 Q476 574 486 537Z" />
      </g>

      <g transform={lowerTransform}>
        <NeutralShape gradientId={gradientId} d="M284 469 L327 543 L292 583 L260 493Z M376 469 L333 543 L368 583 L400 493Z" />
        <MuscleShape gradientId={gradientId} k="quads" levels={levels} state={state} paths={[
          "M261 493 C276 508 288 530 295 557 L292 679 C283 707 273 707 265 681 C251 618 248 548 261 493Z",
          "M292 516 C304 535 311 560 313 591 L306 697 C296 713 289 698 289 675 L291 553 C290 535 289 522 292 516Z",
          "M399 493 C384 508 372 530 365 557 L368 679 C377 707 387 707 395 681 C409 618 412 548 399 493Z",
          "M368 516 C356 535 349 560 347 591 L354 697 C364 713 371 698 371 675 L369 553 C370 535 371 522 368 516Z",
        ]} />
        <NeutralShape gradientId={gradientId} d="M269 690 Q288 674 307 699 L300 741 Q282 750 266 731Z M391 690 Q372 674 353 699 L360 741 Q378 750 394 731Z" />
        <MuscleShape gradientId={gradientId} k="calves" levels={levels} state={state} paths={[
          "M267 733 C280 743 291 745 300 738 C299 771 297 808 293 848 L269 848 C264 807 263 769 267 733Z",
          "M393 733 C380 743 369 745 360 738 C361 771 363 808 367 848 L391 848 C396 807 397 769 393 733Z",
        ]} />
      </g>

      <g fill="none" stroke="var(--body-guide)" strokeWidth={2.5} strokeLinecap="round" opacity={0.42}>
        <path d="M330 319V528 M296 365H364 M294 414H366 M292 465H368" />
        <path d="M286 530 Q270 617 294 699 M374 530 Q390 617 366 699" />
      </g>
      {female && (
        <g fill="none" stroke="var(--body-outline)" strokeWidth={3} opacity={0.55}>
          <path d="M270 302 Q330 330 390 302" />
          <path d="M275 484 Q330 511 385 484" />
        </g>
      )}
    </g>
  );
}

function BackFigure({ gender, levels, state, gradientId }: { gender: BodyGender; levels?: MuscleLevels; state?: MuscleState; gradientId: string }) {
  const female = gender === "female";
  const shift = "translate(-540 0)";
  const upperTransform = female ? `${shift} translate(870 0) scale(.94 1) translate(-870 0)` : shift;
  const lowerTransform = female ? `${shift} translate(870 0) scale(1.035 1) translate(-870 0)` : shift;

  return (
    <g>
      <g transform={upperTransform}>
        <NeutralShape gradientId={gradientId} d="M834 72 Q870 47 906 72 Q920 86 916 124 Q911 165 870 176 Q829 165 824 124 Q820 86 834 72Z" />
        <NeutralShape gradientId={gradientId} d="M842 151 L870 190 L898 151 L909 222 L831 222Z" />
        <MuscleShape gradientId={gradientId} k="traps" levels={levels} state={state} paths={[
          "M833 186 C846 201 858 213 870 227 C882 213 894 201 907 186 L952 218 C920 224 899 241 886 270 L870 315 L854 270 C841 241 820 224 788 218Z",
          "M854 271 L870 315 L886 271 L883 389 C879 418 875 446 870 472 C865 446 861 418 857 389Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="rear_delts" levels={levels} state={state} paths={[
          "M790 219 C758 213 733 228 726 254 C724 278 732 296 746 311 C755 282 770 258 798 242 C799 232 796 224 790 219Z",
          "M950 219 C982 213 1007 228 1014 254 C1016 278 1008 296 994 311 C985 282 970 258 942 242 C941 232 944 224 950 219Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="lats" levels={levels} state={state} paths={[
          "M793 244 C819 247 841 264 853 290 L861 464 C848 482 835 495 821 504 C794 465 776 408 766 337 C765 299 774 266 793 244Z",
          "M947 244 C921 247 899 264 887 290 L879 464 C892 482 905 495 919 504 C946 465 964 408 974 337 C975 299 966 266 947 244Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="lower_back" levels={levels} state={state} paths={[
          "M858 291 L870 319 L882 291 L881 473 C879 492 875 509 870 523 C865 509 861 492 859 473Z",
          "M846 402 C853 424 857 449 858 477 L870 523 L855 505 C847 475 843 440 846 402Z",
          "M894 402 C887 424 883 449 882 477 L870 523 L885 505 C893 475 897 440 894 402Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="triceps" levels={levels} state={state} paths={[
          "M742 301 C724 327 718 367 728 405 C734 425 746 430 758 412 C767 382 771 347 771 320 C762 310 753 304 742 301Z",
          "M998 301 C1016 327 1022 367 1012 405 C1006 425 994 430 982 412 C973 382 969 347 969 320 C978 310 987 304 998 301Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="forearms" levels={levels} state={state} paths={[
          "M729 405 L693 514 Q691 541 714 550 L757 419 Q744 401 729 405Z",
          "M1011 405 L1047 514 Q1049 541 1026 550 L983 419 Q996 401 1011 405Z",
        ]} />
        <NeutralShape gradientId={gradientId} d="M692 511 Q663 520 650 544 Q658 554 674 543 L665 574 Q673 578 682 553 L678 584 Q687 589 694 557 L694 587 Q704 588 707 554 L714 575 Q724 572 714 536Z M1048 511 Q1077 520 1090 544 Q1082 554 1066 543 L1075 574 Q1067 578 1058 553 L1062 584 Q1053 589 1046 557 L1046 587 Q1036 588 1033 554 L1026 575 Q1016 572 1026 536Z" />
      </g>

      <g transform={lowerTransform}>
        <MuscleShape gradientId={gradientId} k="glutes" levels={levels} state={state} paths={[
          "M822 492 C841 480 857 486 868 510 C870 539 866 571 860 596 C838 611 816 603 800 578 C793 546 799 514 822 492Z",
          "M918 492 C899 480 883 486 872 510 C870 539 874 571 880 596 C902 611 924 603 940 578 C947 546 941 514 918 492Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="hamstrings" levels={levels} state={state} paths={[
          "M800 578 C815 602 834 610 858 603 C858 637 855 678 851 716 C840 742 829 744 817 722 C802 680 793 626 800 578Z",
          "M940 578 C925 602 906 610 882 603 C882 637 885 678 889 716 C900 742 911 744 923 722 C938 680 947 626 940 578Z",
        ]} />
        <MuscleShape gradientId={gradientId} k="calves" levels={levels} state={state} paths={[
          "M810 717 Q833 735 853 722 L847 829 Q829 857 812 824Z",
          "M930 717 Q907 735 887 722 L893 829 Q911 857 928 824Z",
        ]} />
      </g>

      <g transform={shift} fill="none" stroke="var(--body-guide)" strokeWidth={2.5} strokeLinecap="round" opacity={0.42}>
        <path d="M828 606 Q813 666 842 725 M912 606 Q927 666 898 725" />
      </g>
      {female && (
        <g fill="none" stroke="var(--body-outline)" strokeWidth={3} opacity={0.55}>
          <path d="M274 494 Q330 521 386 494" />
        </g>
      )}
    </g>
  );
}

export function BodyFront({ levels, state, gender = "male" }: { levels?: MuscleLevels; state?: MuscleState; gender?: BodyGender }) {
  const gradientId = `body-front-${useId().replace(/:/g, "")}`;
  return (
    <SvgShell label={`Corpo ${gender === "female" ? "feminino" : "masculino"}, vista frontal`} gradientId={gradientId}>
      <FrontFigure gender={gender} levels={levels} state={state} gradientId={gradientId} />
    </SvgShell>
  );
}

export function BodyBack({ levels, state, gender = "male" }: { levels?: MuscleLevels; state?: MuscleState; gender?: BodyGender }) {
  const gradientId = `body-back-${useId().replace(/:/g, "")}`;
  return (
    <SvgShell label={`Corpo ${gender === "female" ? "feminino" : "masculino"}, vista posterior`} gradientId={gradientId}>
      <BackFigure gender={gender} levels={levels} state={state} gradientId={gradientId} />
    </SvgShell>
  );
}

export function MuscleBody({ view, gender = "male", state, levels }: { view: "front" | "back"; gender?: BodyGender; state?: MuscleState; levels?: MuscleLevels }) {
  return view === "front" ? (
    <BodyFront gender={gender} state={state} levels={levels} />
  ) : (
    <BodyBack gender={gender} state={state} levels={levels} />
  );
}
