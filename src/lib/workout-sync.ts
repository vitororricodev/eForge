import { supabase } from '@/integrations/supabase/client';
import { type Draft, number, totals, saveDraft, readDraft } from './workout-storage';
let busy = false;
export async function syncDraft(d: Draft) {
 if (busy || !navigator.onLine) return false;
 busy = true;
 try {
  const {data:{session}} = await supabase.auth.getSession();
  if(session?.user.id !== d.userId) return false;
  // Stable UUIDs make retries safe; RPC saves the whole snapshot atomically.
  const {error} = await supabase.rpc('save_workout_snapshot' as never, {payload: {
   id:d.id, workout_id:d.workoutId, nome_treino:d.name, iniciado_em:new Date(d.started).toISOString(),
   finalizado_em:d.finished ? new Date(d.finished).toISOString():null,
   volume_total:totals(d).volume, sets:d.exercises.flatMap(e=>e.sets.map((s,i)=>({id:s.id,exercise_id:e.exercise_id,nome_exercicio:e.nome,musculo_principal:e.musculo_principal,musculos_secundarios:e.musculos_secundarios,musculos_terciarios:e.musculos_terciarios ?? [],serie_numero:i+1,repeticoes:number(s.reps),carga_kg:number(s.carga),concluida:s.done,kind:s.kind})))
  }} as never);
  if(error) throw error;
  if(d.finished && readDraft(d.userId)?.id === d.id) saveDraft({...d,synced:true});
  return true;
 } finally { busy=false; }
}
