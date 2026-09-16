-- Exercise visibility belongs exclusively to exercises, never to workout plans.
-- private: only the owner can read/use it.
-- public: every authenticated user can read/use it; only the owner can edit/delete it.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_visibility_check;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_visibility_check
  CHECK (visibility IN ('private', 'public'));

DROP POLICY IF EXISTS "own exercises select" ON public.exercises;
DROP POLICY IF EXISTS "exercise visibility select" ON public.exercises;

CREATE POLICY "exercise visibility select"
ON public.exercises
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR visibility = 'public');

-- INSERT/UPDATE/DELETE remain owner-only through the existing ownership policies.
-- A user's workout may reference either an owned exercise or a public exercise.
DROP POLICY IF EXISTS eforge_exercise_parent ON public.workout_exercises;
CREATE POLICY eforge_exercise_parent
ON public.workout_exercises AS RESTRICTIVE
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = workout_id AND w.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = exercise_id
      AND (e.user_id = auth.uid() OR e.visibility = 'public')
  )
);

-- Set logs may also reference public exercises used in the owner's workout.
DROP POLICY IF EXISTS eforge_log_parent ON public.set_logs;
CREATE POLICY eforge_log_parent
ON public.set_logs AS RESTRICTIVE
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.workout_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  )
  AND (
    exercise_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = exercise_id
        AND (e.user_id = auth.uid() OR e.visibility = 'public')
    )
  )
);

-- Keep the snapshot RPC aligned with the same visibility rule.
CREATE OR REPLACE FUNCTION public.save_workout_snapshot(payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid := (payload->>'id')::uuid; item jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM workouts WHERE id=(payload->>'workout_id')::uuid AND user_id=uid) THEN RAISE EXCEPTION 'Workout unavailable'; END IF;
 INSERT INTO workout_sessions(id,user_id,workout_id,nome_treino,iniciado_em,finalizado_em,status,volume_total,duracao_min)
 VALUES(sid,uid,(payload->>'workout_id')::uuid,payload->>'nome_treino',(payload->>'iniciado_em')::timestamptz,(payload->>'finalizado_em')::timestamptz,
 CASE WHEN payload->>'finalizado_em' IS NULL THEN 'em_andamento'::session_status ELSE 'concluida'::session_status END,
 (payload->>'volume_total')::numeric,extract(epoch FROM ((payload->>'finalizado_em')::timestamptz-(payload->>'iniciado_em')::timestamptz))/60)
 ON CONFLICT(id) DO UPDATE SET finalizado_em=excluded.finalizado_em,status=excluded.status,volume_total=excluded.volume_total,duracao_min=excluded.duracao_min;
 DELETE FROM set_logs WHERE session_id=sid AND user_id=uid;
 FOR item IN SELECT * FROM jsonb_array_elements(payload->'sets') LOOP
  IF NOT EXISTS(
    SELECT 1 FROM exercises
    WHERE id=(item->>'exercise_id')::uuid
      AND (user_id=uid OR visibility='public')
  ) THEN RAISE EXCEPTION 'Exercise unavailable'; END IF;
  INSERT INTO set_logs(
    id,session_id,user_id,exercise_id,nome_exercicio,musculo_principal,
    serie_numero,repeticoes,carga_kg,concluida,kind,musculos_secundarios,musculos_terciarios
  )
  VALUES(
    (item->>'id')::uuid,sid,uid,(item->>'exercise_id')::uuid,item->>'nome_exercicio',item->>'musculo_principal',
    (item->>'serie_numero')::int,(item->>'repeticoes')::int,(item->>'carga_kg')::numeric,(item->>'concluida')::boolean,item->>'kind',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'musculos_secundarios','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'musculos_terciarios','[]'::jsonb)))
  );
 END LOOP;
 IF payload->>'finalizado_em' IS NOT NULL THEN
  INSERT INTO achievements(user_id,codigo,medalha,descricao,desbloqueada,data_conquista)
  VALUES(uid,'primeiro_treino','Primeiro Treino','Concluiu seu primeiro treino.',true,now())
  ON CONFLICT(user_id,codigo) DO NOTHING;
  IF (SELECT count(*) FROM workout_sessions WHERE user_id=uid AND status='concluida')>=10 THEN
   INSERT INTO achievements(user_id,codigo,medalha,descricao,desbloqueada,data_conquista)
   VALUES(uid,'dez_treinos','Dez Treinos','Concluiu dez treinos.',true,now())
   ON CONFLICT(user_id,codigo) DO NOTHING;
  END IF;
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.save_workout_snapshot(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_workout_snapshot(jsonb) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_exercises_visibility
  ON public.exercises(visibility, created_at DESC);
