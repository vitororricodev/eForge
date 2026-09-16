export type Series = { id: string; reps: string; carga: string; done: boolean; kind: string };
export type Exercise = { exercise_id: string; nome: string; musculo_principal: string; musculos_secundarios: string[]; musculos_terciarios?: string[]; descanso_seg: number; previous?: string; sets: Series[] };
export type Draft = { id: string; userId: string; workoutId: string; name: string; started: number; restUntil: number; exercises: Exercise[]; finished?: number; synced?: boolean };
export const draftKey = (userId: string) => `eforge:v1:${userId}:draft`;
export function readDraft(userId: string): Draft | null { try { const d = JSON.parse(localStorage.getItem(draftKey(userId)) || 'null'); return d?.userId === userId ? d : null; } catch { return null; } }
export function saveDraft(d: Draft) { localStorage.setItem(draftKey(d.userId), JSON.stringify(d)); }
export function number(value: string) { const n = Number(value.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; }
export function totals(d: Draft) { return d.exercises.reduce((a,e) => { for(const s of e.sets) if(s.done) { a.sets++; a.volume += number(s.reps)*number(s.carga); } return a; }, {sets:0,volume:0}); }
export function remaining(until: number, now = Date.now()) { return Math.max(0, Math.ceil((until-now)/1000)); }
