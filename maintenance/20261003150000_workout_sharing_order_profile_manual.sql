-- eForge: compartilhamento, organização e correção do perfil.
-- Execute este arquivo INTEIRO no SQL Editor do Supabase. Não reaplica migrations antigas.
-- Não publica treinos existentes: o link depende da ação Compartilhar do titular.
BEGIN;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
DO $eforge_prerequisites$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='catalog_deleted_at') OR
    NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='equipamentos_pt_br') OR
    NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='musculos_primarios') OR
    to_regclass('public.owned_catalog_state') IS NULL OR
    to_regprocedure('public.save_workout_snapshot(jsonb)') IS NULL OR
    NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='weight_kg') THEN
   RAISE EXCEPTION 'A biblioteca própria e o perfil anteriores precisam estar instalados. Este arquivo não reaplica o ALTER TABLE source.';
 END IF;
END $eforge_prerequisites$;
DO $eforge_apply_20261003150000$
DECLARE complete boolean:=(
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workouts' AND column_name='ordem') AND
 to_regclass('public.workout_shares') IS NOT NULL AND to_regclass('public.workout_share_imports') IS NOT NULL AND
 to_regprocedure('public.can_use_workout_exercise(uuid)') IS NOT NULL AND
 to_regprocedure('public.save_workout_plan(uuid,text,text,jsonb)') IS NOT NULL AND
 to_regprocedure('public.reorder_workouts(uuid[])') IS NOT NULL AND
 to_regprocedure('public.create_workout_share(uuid)') IS NOT NULL AND
 to_regprocedure('public.revoke_workout_share(uuid)') IS NOT NULL AND
 to_regprocedure('public.get_shared_workout(text)') IS NOT NULL AND
 to_regprocedure('public.import_shared_workout(text,text,jsonb,uuid)') IS NOT NULL AND
 to_regprocedure('public.save_body_profile(numeric,numeric,integer,text,public.fitness_goal)') IS NOT NULL AND
 EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_sex_check' AND pg_get_constraintdef(oid) LIKE '%masculino%')
);
BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261003150000') THEN
   IF NOT complete THEN RAISE EXCEPTION 'Migration 20261003150000 registrada com estrutura incompleta. Corrija antes de continuar.'; END IF;
 ELSIF complete THEN
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261003150000','workout_sharing_order_profile','{}');
 ELSE
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workouts' AND column_name='ordem') OR
      to_regclass('public.workout_shares') IS NOT NULL OR to_regclass('public.workout_share_imports') IS NOT NULL THEN
     RAISE EXCEPTION 'Estrutura parcial da atualização de compartilhamento. Revise a aplicação parcial; não execute migrations antigas.';
   END IF;
   EXECUTE $eforge_body_20261003150000$
-- Compartilhamento por snapshot, importação independente, ordem e perfil corporal.
-- Nenhuma política de exercícios/treinos existentes é tornada pública.
-- O formulário já utiliza estes valores; o CHECK antigo ainda aceitava apenas inglês.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sex_check;
ALTER TABLE public.profiles DISABLE TRIGGER profiles_touch;
UPDATE public.profiles SET sex=CASE sex WHEN 'male' THEN 'masculino' WHEN 'female' THEN 'feminino' WHEN 'other' THEN 'outro' ELSE sex END
  WHERE sex IN ('male','female','other');
ALTER TABLE public.profiles ENABLE TRIGGER profiles_touch;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sex_check CHECK (sex IN ('masculino','feminino','outro'));
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS ordem integer;
WITH positions AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id) - 1 AS pos
  FROM public.workouts
)
UPDATE public.workouts w SET ordem = p.pos FROM positions p WHERE w.id = p.id AND w.ordem IS NULL;
ALTER TABLE public.workouts ALTER COLUMN ordem SET DEFAULT 0, ALTER COLUMN ordem SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workouts'::regclass AND conname='workouts_order_nonnegative') THEN
    ALTER TABLE public.workouts ADD CONSTRAINT workouts_order_nonnegative CHECK (ordem >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS workouts_user_order ON public.workouts(user_id, ordem, created_at, id);

CREATE TABLE IF NOT EXISTS public.workout_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_share_active ON public.workout_shares(workout_id) WHERE revoked_at IS NULL;
ALTER TABLE public.workout_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workout shares select" ON public.workout_shares;
CREATE POLICY "own workout shares select" ON public.workout_shares FOR SELECT TO authenticated USING (user_id=auth.uid());
REVOKE ALL ON public.workout_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,workout_id,token,created_at,revoked_at) ON public.workout_shares TO authenticated;

CREATE TABLE IF NOT EXISTS public.workout_share_imports (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  share_id uuid NOT NULL REFERENCES public.workout_shares(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,request_id)
);
ALTER TABLE public.workout_share_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_share_imports FROM PUBLIC, anon, authenticated;

-- A mesma elegibilidade da biblioteca; privados continuam exclusivos do titular.
CREATE OR REPLACE FUNCTION public.can_use_workout_exercise(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id=p_id AND e.active AND e.review_status='approved'
      AND e.catalog_deleted_at IS NULL
      AND (e.user_id=auth.uid() OR e.visibility='public')
      AND (e.source<>'exercisedb' OR NOT EXISTS(SELECT 1 FROM public.owned_catalog_state WHERE legacy_disabled))
  )
$$;

-- Atualização atômica: mantém UUIDs dos itens existentes e não apaga antes de validar.
CREATE OR REPLACE FUNCTION public.save_workout_plan(p_id uuid, p_name text, p_description text, p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); item jsonb; item_id uuid; exercise uuid; pos integer:=0; existing boolean; keep_ids uuid[]:='{}';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para salvar o treino.'; END IF;
  IF p_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe um nome de até 120 caracteres.'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Adicione entre 1 e 250 exercícios.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
  SELECT true INTO existing FROM public.workouts WHERE id=p_id AND user_id=uid FOR UPDATE;
  IF existing IS NOT TRUE THEN
    INSERT INTO public.workouts(id,user_id,nome,descricao,ordem)
      SELECT p_id,uid,btrim(p_name),nullif(btrim(p_description),''),coalesce(max(ordem)+1,0) FROM public.workouts WHERE user_id=uid;
  ELSE
    UPDATE public.workouts SET nome=btrim(p_name),descricao=nullif(btrim(p_description),'') WHERE id=p_id AND user_id=uid;
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <> (SELECT count(DISTINCT value->>'exercise_id') FROM jsonb_array_elements(p_items)) THEN
    RAISE EXCEPTION 'O mesmo exercício não pode aparecer duas vezes.';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    item_id := (item->>'id')::uuid;
    exercise := (item->>'exercise_id')::uuid;
    IF item_id IS NULL OR item_id=ANY(keep_ids) THEN RAISE EXCEPTION 'Identificação inválida dos exercícios.'; END IF;
    IF EXISTS(SELECT 1 FROM public.workout_exercises WHERE id=item_id AND (workout_id<>p_id OR user_id<>uid)) THEN RAISE EXCEPTION 'O item não pertence a este treino.'; END IF;
    IF NOT public.can_use_workout_exercise(exercise) AND NOT EXISTS (
      SELECT 1 FROM public.workout_exercises WHERE id=item_id AND workout_id=p_id AND user_id=uid AND exercise_id=exercise
    ) THEN RAISE EXCEPTION 'Escolha um exercício disponível na sua biblioteca.'; END IF;
    IF coalesce((item->>'series')::numeric,0) NOT BETWEEN 1 AND 100 OR (item->>'series')::numeric <> trunc((item->>'series')::numeric)
      OR coalesce((item->>'repeticoes')::numeric,-1) NOT BETWEEN 1 AND 1000 OR (item->>'repeticoes')::numeric <> trunc((item->>'repeticoes')::numeric)
      OR coalesce((item->>'descanso_seg')::numeric,-1) NOT BETWEEN 0 AND 3600 OR (item->>'descanso_seg')::numeric <> trunc((item->>'descanso_seg')::numeric)
      OR ((item->>'carga_kg') IS NOT NULL AND (item->>'carga_kg')::numeric NOT BETWEEN 0 AND 1000000) THEN RAISE EXCEPTION 'Verifique séries, repetições, carga e descanso.'; END IF;
    INSERT INTO public.workout_exercises(id,workout_id,user_id,exercise_id,ordem,series,repeticoes,carga_kg,descanso_seg)
    VALUES(item_id,p_id,uid,exercise,pos,(item->>'series')::integer,(item->>'repeticoes')::integer,(item->>'carga_kg')::numeric,(item->>'descanso_seg')::integer)
    ON CONFLICT(id) DO UPDATE SET exercise_id=excluded.exercise_id,ordem=excluded.ordem,series=excluded.series,
      repeticoes=excluded.repeticoes,carga_kg=excluded.carga_kg,descanso_seg=excluded.descanso_seg
      WHERE workout_exercises.workout_id=p_id AND workout_exercises.user_id=uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível atualizar o item.'; END IF;
    keep_ids:=array_append(keep_ids,item_id); pos:=pos+1;
  END LOOP;
  DELETE FROM public.workout_exercises WHERE workout_id=p_id AND user_id=uid AND NOT (id=ANY(keep_ids));
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.reorder_workouts(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para organizar os treinos.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
  IF p_ids IS NULL OR cardinality(p_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_ids) AS id)
    OR cardinality(p_ids)<>(SELECT count(*) FROM public.workouts WHERE user_id=uid)
    OR EXISTS(SELECT 1 FROM unnest(p_ids) AS candidate(id) WHERE NOT EXISTS(SELECT 1 FROM public.workouts w WHERE w.id=candidate.id AND w.user_id=uid))
    THEN RAISE EXCEPTION 'A lista de treinos mudou. Recarregue e tente novamente.'; END IF;
  UPDATE public.workouts w SET ordem=p.pos-1 FROM unnest(p_ids) WITH ORDINALITY AS p(id,pos) WHERE w.id=p.id AND w.user_id=uid;
END $$;

CREATE OR REPLACE FUNCTION public.create_workout_share(p_workout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.workouts; payload jsonb; shared public.workout_shares;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para compartilhar.'; END IF;
  SELECT * INTO w FROM public.workouts WHERE id=p_workout_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Treino não encontrado.'; END IF;
  SELECT jsonb_build_object('nome',w.nome,'descricao',w.descricao,'items',coalesce(jsonb_agg(
    jsonb_build_object('item_id',we.id,'exercise_id',we.exercise_id,'nome',coalesce(e.nome,'Exercício indisponível'),
      'gif_url',e.gif_url,'musculo_principal',coalesce(e.musculo_principal,''),
      'musculos_primarios',coalesce(e.musculos_primarios,'{}'::text[]),'musculos_secundarios',coalesce(e.musculos_secundarios,'{}'::text[]),
      'categoria',e.categoria,'equipamentos',coalesce(e.equipamentos_pt_br,'{}'::text[]),
      'descricao',e.descricao,'instrucoes',coalesce(nullif(e.instrucoes_pt_br,'{}'::text[]),e.instrucoes,'{}'::text[]),
      'series',we.series,'repeticoes',we.repeticoes,'carga_kg',we.carga_kg,'descanso_seg',we.descanso_seg)
    ORDER BY we.ordem,we.id) FILTER(WHERE we.id IS NOT NULL),'[]'::jsonb)) INTO payload
  FROM public.workout_exercises we LEFT JOIN public.exercises e ON e.id=we.exercise_id
    AND (e.user_id=uid OR (e.visibility='public' AND e.review_status='approved'))
  WHERE we.workout_id=w.id AND we.user_id=uid;
  IF jsonb_array_length(payload->'items')=0 THEN RAISE EXCEPTION 'Adicione exercícios antes de compartilhar.'; END IF;
  -- Gerar novamente é uma ação explícita: o link anterior é revogado.
  UPDATE public.workout_shares SET revoked_at=now() WHERE workout_id=w.id AND user_id=uid AND revoked_at IS NULL;
  INSERT INTO public.workout_shares(user_id,workout_id,token,snapshot) VALUES(uid,w.id,
    replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),payload) RETURNING * INTO shared;
  RETURN jsonb_build_object('id',shared.id,'token',shared.token,'created_at',shared.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_workout_share(p_share_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  UPDATE public.workout_shares SET revoked_at=coalesce(revoked_at,now()) WHERE id=p_share_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Compartilhamento não encontrado.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_shared_workout(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE shared public.workout_shares; items jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO shared FROM public.workout_shares WHERE token=p_token AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Apenas a lista autorizada de campos gravada pela função de criação é exposta.
  SELECT jsonb_agg(item || jsonb_build_object('available',auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.exercises e WHERE e.id=(item->>'exercise_id')::uuid AND e.active
      AND e.review_status='approved' AND e.catalog_deleted_at IS NULL
      AND (e.user_id=auth.uid() OR e.visibility='public')
      AND (e.source<>'exercisedb' OR NOT EXISTS(SELECT 1 FROM public.owned_catalog_state WHERE legacy_disabled))
  )) ORDER BY pos) INTO items FROM jsonb_array_elements(shared.snapshot->'items') WITH ORDINALITY AS x(item,pos);
  RETURN jsonb_build_object('nome',shared.snapshot->'nome','descricao',shared.snapshot->'descricao',
    'created_at',shared.created_at,'items',coalesce(items,'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.import_shared_workout(p_token text,p_name text,p_replacements jsonb,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); shared public.workout_shares; previous public.workout_share_imports;
  item jsonb; replacement text; exercise uuid; new_id uuid:=gen_random_uuid(); rows jsonb:='[]'; key text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para copiar o treino.'; END IF;
  IF p_request_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe um nome de até 120 caracteres.'; END IF;
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_replacements) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Compartilhamento inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
  SELECT * INTO shared FROM public.workout_shares WHERE token=p_token AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este link não está mais disponível.'; END IF;
  SELECT * INTO previous FROM public.workout_share_imports WHERE user_id=uid AND request_id=p_request_id;
  IF FOUND THEN
    IF previous.share_id<>shared.id THEN RAISE EXCEPTION 'Pedido de importação inválido.'; END IF;
    RETURN previous.workout_id;
  END IF;
  FOR key IN SELECT jsonb_object_keys(p_replacements) LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(shared.snapshot->'items') AS x WHERE x->>'item_id'=key) THEN RAISE EXCEPTION 'Substituição desconhecida.'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(shared.snapshot->'items') LOOP
    exercise:=(item->>'exercise_id')::uuid;
    replacement:=p_replacements->>(item->>'item_id');
    IF public.can_use_workout_exercise(exercise) THEN
      IF p_replacements ? (item->>'item_id') THEN RAISE EXCEPTION 'Substitua apenas os exercícios indisponíveis.'; END IF;
    ELSE
      IF replacement IS NULL OR NOT public.can_use_workout_exercise(replacement::uuid) THEN RAISE EXCEPTION 'Escolha um substituto da sua biblioteca para cada exercício indisponível.'; END IF;
      exercise:=replacement::uuid;
    END IF;
    rows:=rows||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'exercise_id',exercise,
      'series',item->'series','repeticoes',item->'repeticoes','carga_kg',item->'carga_kg','descanso_seg',item->'descanso_seg'));
  END LOOP;
  -- O mesmo validador transacional usado pelo editor; auth.uid() continua o destinatário.
  PERFORM public.save_workout_plan(new_id,p_name,shared.snapshot->>'descricao',rows);
  INSERT INTO public.workout_share_imports(user_id,request_id,share_id,workout_id) VALUES(uid,p_request_id,shared.id,new_id);
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_body_profile(p_weight numeric,p_height numeric,p_age integer,p_sex text,p_goal public.fitness_goal)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para salvar o perfil.'; END IF;
  IF p_weight IS NULL OR p_weight NOT BETWEEN 20 AND 400 OR p_height IS NULL OR p_height NOT BETWEEN 80 AND 260
    OR p_age IS NULL OR p_age NOT BETWEEN 10 AND 120 OR p_sex IS NULL OR p_sex NOT IN ('masculino','feminino','outro') OR p_goal IS NULL
    THEN RAISE EXCEPTION 'Verifique os dados do perfil.'; END IF;
  INSERT INTO public.profiles(id,weight_kg,height_cm,age,sex,objetivo_fitness)
    VALUES(auth.uid(),p_weight,p_height,p_age,p_sex,p_goal)
  ON CONFLICT(id) DO UPDATE SET weight_kg=excluded.weight_kg,height_cm=excluded.height_cm,
    age=excluded.age,sex=excluded.sex,objetivo_fitness=excluded.objetivo_fitness RETURNING * INTO result;
  RETURN to_jsonb(result);
END $$;

REVOKE EXECUTE ON FUNCTION public.can_use_workout_exercise(uuid),public.save_workout_plan(uuid,text,text,jsonb),
  public.reorder_workouts(uuid[]),public.create_workout_share(uuid),public.revoke_workout_share(uuid),
  public.get_shared_workout(text),public.import_shared_workout(text,text,jsonb,uuid),public.save_body_profile(numeric,numeric,integer,text,public.fitness_goal) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_workout_exercise(uuid),public.save_workout_plan(uuid,text,text,jsonb),
  public.reorder_workouts(uuid[]),public.create_workout_share(uuid),public.revoke_workout_share(uuid),
  public.import_shared_workout(text,text,jsonb,uuid),public.save_body_profile(numeric,numeric,integer,text,public.fitness_goal) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_workout(text) TO anon,authenticated;

$eforge_body_20261003150000$;
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261003150000','workout_sharing_order_profile','{}');
 END IF;
END $eforge_apply_20261003150000$;
COMMIT;
