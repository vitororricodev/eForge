import type { MuscleKey } from "@/components/MuscleBody";
export type BodyView = "front" | "back";
export const MUSCLES: Record<MuscleKey, { label: string; region: string; view: BodyView }> = {
  chest: { label: "Peitoral", region: "Região anterior do tórax", view: "front" },
  abs: { label: "Abdômen", region: "Região anterior do tronco", view: "front" },
  obliques: { label: "Oblíquos", region: "Laterais do abdômen", view: "front" },
  shoulders: { label: "Ombros", region: "Região anterior e lateral dos ombros", view: "front" },
  biceps: { label: "Bíceps", region: "Região anterior dos braços", view: "front" },
  forearms: { label: "Antebraços", region: "Entre os cotovelos e os punhos", view: "front" },
  quads: { label: "Quadríceps", region: "Região anterior das coxas", view: "front" },
  calves: { label: "Panturrilhas", region: "Região posterior das pernas", view: "back" },
  traps: { label: "Trapézio", region: "Região superior das costas", view: "back" },
  lats: { label: "Dorsais", region: "Laterais das costas", view: "back" },
  lower_back: { label: "Lombar", region: "Região inferior das costas", view: "back" },
  glutes: { label: "Glúteos", region: "Região posterior do quadril", view: "back" },
  hamstrings: { label: "Posterior de coxa", region: "Região posterior das coxas", view: "back" },
  triceps: { label: "Tríceps", region: "Região posterior dos braços", view: "back" },
  rear_delts: {
    label: "Deltoides posteriores",
    region: "Região posterior dos ombros",
    view: "back",
  },
};
export const muscleKeys = Object.keys(MUSCLES) as MuscleKey[];
export function isMuscleKey(value: unknown): value is MuscleKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MUSCLES, value);
}
// Coordinates are traced against the original 1536 × 1024 atlas, not generic body shapes.
// Cropped raster layers retain these coordinates through the SVG viewBox.
export const REGIONS: Record<BodyView, Partial<Record<MuscleKey, string>>> = {
  front: {
    chest:
      "M431 204 Q378 188 337 241 Q331 256 363 278 Q399 293 429 276 Z M442 204 Q488 190 531 241 Q539 256 506 278 Q472 293 442 276 Z",
    shoulders:
      "M332 191 Q289 190 279 236 L282 269 Q306 249 329 240 Q342 211 365 197 Z M535 191 Q578 191 587 236 L583 269 Q562 249 538 240 Q525 211 506 197 Z",
    biceps:
      "M310 257 Q284 268 273 306 Q260 338 273 352 Q292 359 313 320 Q331 289 332 253 Z M556 257 Q581 268 593 306 Q606 338 594 353 Q574 359 554 320 Q537 289 534 253 Z",
    forearms:
      "M266 349 Q245 342 234 380 L207 465 L231 474 Q259 437 281 403 L299 351 L277 366 Z M601 349 Q622 342 633 380 L658 465 L634 474 Q608 437 586 403 L569 351 L590 366 Z",
    abs: "M398 289 Q415 283 431 288 L432 473 Q411 471 398 446 L389 396 L388 324 Z M441 288 Q458 283 475 289 L483 324 L481 396 L466 449 Q458 470 441 473 Z",
    obliques:
      "M342 279 L386 296 L382 334 L389 385 L395 441 L353 415 L347 360 Z M524 279 L482 296 L488 334 L481 385 L475 441 L515 415 L521 360 Z",
    quads:
      "M356 419 Q325 443 319 511 Q313 573 336 622 L351 650 Q372 652 389 619 Q415 565 414 505 L387 457 Z M511 419 Q541 443 549 511 Q556 574 531 622 L518 650 Q495 652 478 619 Q453 565 454 505 L480 457 Z",
    calves:
      "M333 691 Q300 721 309 769 L328 839 L338 873 L358 868 L365 808 L364 700 L353 721 Z M535 691 Q569 721 559 769 L540 839 L530 873 L510 868 L503 808 L504 700 L516 721 Z",
  },
  back: {
    traps:
      "M1076 114 L1090 153 L1105 114 L1119 158 Q1140 177 1173 191 L1143 215 L1118 278 L1091 337 L1067 278 L1039 215 L1010 191 Q1044 178 1064 158 Z",
    rear_delts:
      "M1005 188 Q950 187 938 225 L937 253 Q963 241 984 226 L1012 202 Z M1180 188 Q1234 187 1245 225 L1246 253 Q1221 241 1200 226 L1170 202 Z",
    lats: "M988 230 Q1005 254 1042 264 L1083 338 L1077 416 Q1043 403 1016 375 L992 320 L980 277 Z M1196 230 Q1179 254 1142 264 L1101 338 L1108 416 Q1142 403 1169 375 L1192 320 L1204 277 Z",
    triceps:
      "M964 249 Q942 248 927 278 L917 317 Q918 344 942 355 Q959 343 973 309 L981 274 Z M1219 249 Q1243 248 1257 278 L1267 317 Q1266 344 1242 355 Q1225 343 1211 309 L1203 274 Z",
    forearms:
      "M916 344 Q896 353 884 388 L860 469 L879 482 Q907 443 927 412 L945 361 Z M1268 344 Q1288 353 1300 388 L1324 469 L1305 482 Q1277 443 1257 412 L1239 361 Z",
    lower_back:
      "M1066 343 L1088 361 L1091 437 L1070 419 L1050 404 Z M1116 343 L1096 361 L1094 437 L1115 419 L1134 404 Z",
    glutes:
      "M1068 410 Q1031 400 1007 438 L1006 509 Q1043 537 1088 508 L1090 448 Z M1115 410 Q1153 400 1177 438 L1178 509 Q1140 537 1095 508 L1093 448 Z",
    hamstrings:
      "M1006 520 Q985 561 994 612 L1003 657 L1023 668 L1039 644 L1058 658 Q1078 599 1078 526 L1042 531 Z M1178 520 Q1199 561 1190 612 L1181 657 L1161 668 L1145 644 L1126 658 Q1106 599 1106 526 L1142 531 Z",
    calves:
      "M1006 663 Q978 680 973 725 Q967 766 993 789 L1009 775 Q1027 800 1041 770 Q1058 724 1036 674 L1025 661 Z M1178 663 Q1206 680 1211 725 Q1217 766 1191 789 L1175 775 Q1157 800 1143 770 Q1126 724 1148 674 L1159 661 Z",
  },
};
