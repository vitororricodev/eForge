-- eForge: atualização incremental da biblioteca própria. Execute inteiro no SQL Editor.
-- Não importa arquivos e NÃO remove exercícios ao aplicar o schema.
-- A troca ocorre apenas na ação explícita do painel, após a validação dos GIFs.
BEGIN;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
DO $eforge_prerequisites$
BEGIN
 IF to_regprocedure('public.is_catalog_admin()') IS NULL OR to_regclass('public.exercise_sync_runs') IS NULL OR
    to_regprocedure('public.save_workout_snapshot(jsonb)') IS NULL OR
    NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='musculos_primarios') OR
    pg_get_functiondef('public.save_workout_snapshot(jsonb)'::regprocedure) NOT LIKE '%musculos_primarios%' THEN
   RAISE EXCEPTION 'As migrations anteriores do catálogo e snapshot estão incompletas. Este arquivo não reaplica as migrations antigas.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002120000') OR
    NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002121000') THEN
   RAISE EXCEPTION 'O schema anterior existe, mas falta o histórico das migrations 20261002120000/20261002121000. Reconcilie essas versões antes; não rode o ALTER TABLE source novamente.';
 END IF;
END $eforge_prerequisites$;
DO $eforge_apply_20261002180000$
DECLARE complete boolean:=(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='catalog_deleted_at') AND
   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='equipamentos_pt_br') AND
   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='partes_corpo_pt_br') AND
   to_regprocedure('public.delete_catalog_exercises(uuid[],boolean)') IS NOT NULL AND
   to_regprocedure('public.restore_catalog_exercise(uuid)') IS NOT NULL AND
   to_regprocedure('public.admin_catalog_page(text,text,text,text,integer,integer)') IS NOT NULL AND
   to_regprocedure('public.begin_catalog_translation(uuid,uuid[],boolean)') IS NOT NULL AND
   to_regclass('public.exercise_translation_runs') IS NOT NULL);
BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002180000') THEN
   IF NOT complete THEN RAISE EXCEPTION 'Migration 20261002180000 registrada com estrutura incompleta. Nenhuma reaplicação automática.'; END IF;
 ELSIF complete THEN
   -- Handles a complete manual application without rerunning CREATE/ALTER statements.
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002180000','catalog_management','{}');
 ELSE
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='catalog_deleted_at') OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='equipamentos_pt_br') OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='partes_corpo_pt_br') THEN RAISE EXCEPTION 'Estrutura parcial da migration 20261002180000. Corrija a aplicação parcial antes de continuar.'; END IF;
   EXECUTE $eforge_body_20261002180000$
-- Catalog management: reversible removal, resumable translation and scoped imports.
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS catalog_deleted_at timestamptz;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS equipamentos_pt_br text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS partes_corpo_pt_br text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.exercise_sync_runs ADD COLUMN IF NOT EXISTS body_parts text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_catalog_removed ON public.exercises(catalog_deleted_at) WHERE source<>'user';

CREATE FUNCTION public.guard_catalog_removal() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.equipamentos IS DISTINCT FROM OLD.equipamentos THEN NEW.equipamentos_pt_br:='{}'; END IF;
    IF NEW.partes_corpo IS DISTINCT FROM OLD.partes_corpo THEN NEW.partes_corpo_pt_br:='{}'; END IF;
  END IF;
  IF NEW.catalog_deleted_at IS NOT NULL THEN NEW.active:=false; END IF;
  IF NEW.source='user' AND NEW.catalog_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Official catalog only'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_catalog_removal BEFORE INSERT OR UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_removal();

CREATE FUNCTION public.admin_catalog_page(p_query text DEFAULT '',p_body_part text DEFAULT NULL,p_source text DEFAULT NULL,p_status text DEFAULT 'all',p_page integer DEFAULT 0,p_page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE query tsquery; result jsonb;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF p_page<0 OR p_page>10000 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 OR p_status NOT IN ('all','active','pending','inactive','deleted') THEN RAISE EXCEPTION 'Invalid catalog filter'; END IF;
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO query FROM
    regexp_split_to_table(regexp_replace(translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^[:alnum:] ]',' ','g'),'\s+') term WHERE term<>'';
  WITH filtered AS (
    SELECT * FROM exercises WHERE source<>'user' AND (query IS NULL OR search_vector@@query)
      AND (p_source IS NULL OR source=p_source)
      AND (p_body_part IS NULL OR EXISTS(SELECT 1 FROM unnest(partes_corpo) part WHERE lower(part)=lower(p_body_part)))
      AND CASE p_status WHEN 'deleted' THEN catalog_deleted_at IS NOT NULL ELSE catalog_deleted_at IS NULL AND
        CASE p_status WHEN 'active' THEN active AND review_status='approved'
          WHEN 'pending' THEN review_status='pending' OR NOT classification_reviewed OR cardinality(unmapped_muscles)>0
          WHEN 'inactive' THEN NOT active ELSE true END END
  ), page AS (SELECT * FROM filtered ORDER BY lower(nome),id LIMIT p_page_size OFFSET p_page*p_page_size)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'external_data'-'external_snapshot'-'catalog_overrides'-'search_vector') FROM page),'[]'),
    'total',(SELECT count(*) FROM filtered),
    'catalog_total',(SELECT count(*) FROM exercises WHERE source<>'user' AND catalog_deleted_at IS NULL)) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.delete_catalog_exercises(p_ids uuid[] DEFAULT '{}',p_all boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE removed integer;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF p_all AND cardinality(p_ids)>0 OR NOT p_all AND (cardinality(p_ids)=0 OR cardinality(p_ids)>1000) THEN RAISE EXCEPTION 'Invalid selection'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('eforge-exercisedb-sync'));
  IF EXISTS(SELECT 1 FROM exercise_sync_runs WHERE status='running') THEN RAISE EXCEPTION 'Encerre a importação antes de excluir exercícios.'; END IF;
  IF EXISTS(SELECT 1 FROM exercise_translation_runs WHERE status='running') THEN RAISE EXCEPTION 'Encerre a tradução antes de excluir exercícios.'; END IF;
  IF NOT p_all AND EXISTS(SELECT 1 FROM unnest(p_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM exercises e WHERE e.id=requested.id AND source<>'user')) THEN RAISE EXCEPTION 'Official catalog only'; END IF;
  UPDATE exercises SET catalog_deleted_at=now(),active=false WHERE source<>'user' AND catalog_deleted_at IS NULL AND (p_all OR id=ANY(p_ids));
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END $$;
CREATE FUNCTION public.restore_catalog_exercise(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  UPDATE exercises SET catalog_deleted_at=NULL,active=(review_status='approved') WHERE id=p_id AND source<>'user' AND catalog_deleted_at IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.admin_catalog_page(text,text,text,text,integer,integer),public.delete_catalog_exercises(uuid[],boolean),public.restore_catalog_exercise(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_catalog_page(text,text,text,text,integer,integer),public.delete_catalog_exercises(uuid[],boolean),public.restore_catalog_exercise(uuid) TO authenticated;

CREATE FUNCTION public.begin_exercise_sync_filtered(p_actor uuid,p_body_parts text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_sync_runs; filters text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('eforge-exercisedb-sync'));
  SELECT coalesce(array_agg(DISTINCT lower(trim(part)) ORDER BY lower(trim(part))),'{}') INTO filters FROM unnest(p_body_parts) part;
  IF cardinality(filters)>10 OR EXISTS(SELECT 1 FROM unnest(filters) part WHERE part NOT IN ('chest','back','shoulders','waist','upper arms','lower arms','upper legs','lower legs','neck','cardio')) THEN RAISE EXCEPTION 'Invalid import category'; END IF;
  IF EXISTS(SELECT 1 FROM exercise_translation_runs WHERE status='running') THEN RAISE EXCEPTION 'Encerre a tradução antes de importar.'; END IF;
  SELECT * INTO run FROM exercise_sync_runs WHERE status='running';
  IF FOUND THEN
    IF run.body_parts<>filters THEN RAISE EXCEPTION 'Encerre a importação anterior para mudar as categorias.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
    RETURN to_jsonb(run);
  END IF;
  PERFORM public.begin_exercise_sync(p_actor);
  UPDATE exercise_sync_runs SET body_parts=filters WHERE status='running' RETURNING * INTO run;
  RETURN to_jsonb(run);
END $$;
REVOKE ALL ON FUNCTION public.begin_exercise_sync_filtered(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_exercise_sync_filtered(uuid,text[]) TO service_role;

CREATE TABLE public.exercise_translation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), initiated_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','cancelled')),
 target_ids uuid[] NOT NULL DEFAULT '{}', cursor integer NOT NULL DEFAULT 0,
 total integer NOT NULL DEFAULT 0, translated integer NOT NULL DEFAULT 0, skipped integer NOT NULL DEFAULT 0,
 estimated_characters bigint NOT NULL DEFAULT 0, last_error text,
 lease_token uuid,lease_until timestamptz,claimed_data jsonb NOT NULL DEFAULT '[]',
 started_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz
);
ALTER TABLE public.exercise_translation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog translation admin read" ON public.exercise_translation_runs FOR SELECT TO authenticated USING(public.is_catalog_admin());
CREATE UNIQUE INDEX idx_one_catalog_translation ON public.exercise_translation_runs(status) WHERE status='running';
GRANT SELECT ON public.exercise_translation_runs TO authenticated;
GRANT ALL ON public.exercise_translation_runs TO service_role;

CREATE FUNCTION public.begin_catalog_translation(p_actor uuid,p_ids uuid[] DEFAULT '{}',p_all boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_translation_runs; ids uuid[]; chars bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_all AND cardinality(p_ids)>0 OR NOT p_all AND (cardinality(p_ids)=0 OR cardinality(p_ids)>1000) THEN RAISE EXCEPTION 'Invalid selection'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('eforge-exercisedb-sync'));
 IF EXISTS(SELECT 1 FROM exercise_sync_runs WHERE status='running') THEN RAISE EXCEPTION 'Encerre a importação antes de traduzir.'; END IF;
 SELECT * INTO run FROM exercise_translation_runs WHERE status='running';
 IF FOUND THEN RETURN to_jsonb(run); END IF;
 IF NOT p_all AND EXISTS(SELECT 1 FROM unnest(p_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM exercises e WHERE e.id=requested.id AND source='exercisedb' AND catalog_deleted_at IS NULL)) THEN RAISE EXCEPTION 'ExerciseDB catalog only'; END IF;
 SELECT coalesce(array_agg(id ORDER BY id),'{}'),coalesce(sum(
   CASE WHEN coalesce(name_pt_br,'')='' THEN length(coalesce(name_original,nome)) ELSE 0 END+
   CASE WHEN cardinality(instrucoes_pt_br)=0 THEN length(array_to_string(instrucoes,'')) ELSE 0 END+
   CASE WHEN cardinality(equipamentos_pt_br)=0 THEN length(array_to_string(equipamentos,'')) ELSE 0 END+
   CASE WHEN cardinality(partes_corpo_pt_br)=0 THEN length(array_to_string(partes_corpo,'')) ELSE 0 END),0)
 INTO ids,chars FROM exercises WHERE source='exercisedb' AND catalog_deleted_at IS NULL AND (p_all OR id=ANY(p_ids))
   AND (coalesce(name_pt_br,'')='' OR cardinality(instrucoes)>0 AND cardinality(instrucoes_pt_br)=0
     OR cardinality(equipamentos)>0 AND cardinality(equipamentos_pt_br)=0 OR cardinality(partes_corpo)>0 AND cardinality(partes_corpo_pt_br)=0);
 IF cardinality(ids)>20000 THEN RAISE EXCEPTION 'Select a smaller translation batch'; END IF;
 INSERT INTO exercise_translation_runs(initiated_by,target_ids,total,estimated_characters,status,finished_at)
 VALUES(p_actor,ids,cardinality(ids),chars,CASE WHEN cardinality(ids)=0 THEN 'completed' ELSE 'running' END,CASE WHEN cardinality(ids)=0 THEN now() ELSE NULL END) RETURNING * INTO run;
 RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.claim_catalog_translation(p_run_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_translation_runs; payload jsonb;
BEGIN
 SELECT * INTO run FROM exercise_translation_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Translation not found'; END IF;
 IF run.status<>'running' THEN RETURN to_jsonb(run); END IF;
 IF run.lease_until>now() THEN RAISE EXCEPTION 'Translation page already in progress'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',coalesce(e.name_original,e.nome),'instructions',e.instrucoes,
  'name_pt_br',e.name_pt_br,'instrucoes_pt_br',e.instrucoes_pt_br,
  'equipments',e.equipamentos,'bodyParts',e.partes_corpo,'equipamentos_pt_br',e.equipamentos_pt_br,'partes_corpo_pt_br',e.partes_corpo_pt_br)),'[]') INTO payload
 FROM exercises e WHERE e.id=ANY(run.target_ids[run.cursor+1:run.cursor+3]) AND e.catalog_deleted_at IS NULL;
 UPDATE exercise_translation_runs SET lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',claimed_data=payload,updated_at=now() WHERE id=run.id RETURNING * INTO run;
 RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.apply_catalog_translation(p_run_id uuid,p_token uuid,p_cursor integer,p_results jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_translation_runs; item jsonb; snapshot jsonb; e exercises; added integer:=0; processed integer;
BEGIN
 SELECT * INTO run FROM exercise_translation_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Translation not found'; END IF;
 IF run.status<>'running' OR run.cursor<>p_cursor THEN RETURN to_jsonb(run); END IF;
 IF run.lease_token IS DISTINCT FROM p_token OR run.lease_until<now() THEN RAISE EXCEPTION 'Invalid translation lease'; END IF;
 IF jsonb_typeof(p_results)<>'array' OR jsonb_array_length(p_results)<>jsonb_array_length(run.claimed_data) THEN RAISE EXCEPTION 'Invalid translation response'; END IF;
 FOR snapshot IN SELECT value FROM jsonb_array_elements(run.claimed_data) LOOP
  SELECT value INTO item FROM jsonb_array_elements(p_results) WHERE value->>'id'=snapshot->>'id';
  IF NOT FOUND OR length(coalesce(item->>'name_pt_br',''))=0 OR length(item->>'name_pt_br')>600 OR coalesce(jsonb_typeof(item->'instrucoes_pt_br'),'null')<>'array'
    OR jsonb_array_length(item->'instrucoes_pt_br')<>(CASE WHEN jsonb_array_length(snapshot->'instrucoes_pt_br')>0 THEN jsonb_array_length(snapshot->'instrucoes_pt_br') ELSE jsonb_array_length(snapshot->'instructions') END)
    OR coalesce(jsonb_typeof(item->'equipamentos_pt_br'),'null')<>'array' OR jsonb_array_length(item->'equipamentos_pt_br')<>jsonb_array_length(snapshot->'equipments')
    OR coalesce(jsonb_typeof(item->'partes_corpo_pt_br'),'null')<>'array' OR jsonb_array_length(item->'partes_corpo_pt_br')<>jsonb_array_length(snapshot->'bodyParts')
    THEN RAISE EXCEPTION 'Invalid translated fields'; END IF;
  SELECT * INTO e FROM exercises WHERE id=(snapshot->>'id')::uuid FOR UPDATE;
  IF FOUND AND e.source='exercisedb' AND e.catalog_deleted_at IS NULL AND coalesce(e.name_original,e.nome)=snapshot->>'name'
    AND to_jsonb(e.instrucoes)=snapshot->'instructions' AND to_jsonb(e.name_pt_br) IS NOT DISTINCT FROM nullif(snapshot->'name_pt_br','null')
    AND to_jsonb(e.instrucoes_pt_br)=snapshot->'instrucoes_pt_br'
    AND to_jsonb(e.equipamentos)=snapshot->'equipments' AND to_jsonb(e.partes_corpo)=snapshot->'bodyParts'
    AND to_jsonb(e.equipamentos_pt_br)=snapshot->'equipamentos_pt_br' AND to_jsonb(e.partes_corpo_pt_br)=snapshot->'partes_corpo_pt_br' THEN
    UPDATE exercises SET name_pt_br=CASE WHEN coalesce(e.name_pt_br,'')='' THEN item->>'name_pt_br' ELSE e.name_pt_br END,
      nome=CASE WHEN coalesce(e.name_pt_br,'')='' AND NOT 'nome'=ANY(e.catalog_overrides) THEN item->>'name_pt_br' ELSE e.nome END,
      instrucoes_pt_br=CASE WHEN cardinality(e.instrucoes_pt_br)=0 THEN ARRAY(SELECT jsonb_array_elements_text(item->'instrucoes_pt_br')) ELSE e.instrucoes_pt_br END,
      equipamentos_pt_br=CASE WHEN cardinality(e.equipamentos_pt_br)=0 THEN ARRAY(SELECT jsonb_array_elements_text(item->'equipamentos_pt_br')) ELSE e.equipamentos_pt_br END,
      partes_corpo_pt_br=CASE WHEN cardinality(e.partes_corpo_pt_br)=0 THEN ARRAY(SELECT jsonb_array_elements_text(item->'partes_corpo_pt_br')) ELSE e.partes_corpo_pt_br END,
      catalog_overrides=CASE WHEN 'nome'=ANY(e.catalog_overrides) THEN e.catalog_overrides ELSE array_append(e.catalog_overrides,'nome') END WHERE id=e.id;
    added:=added+1;
  END IF;
 END LOOP;
 processed:=least(3,run.total-run.cursor);
 UPDATE exercise_translation_runs SET cursor=cursor+processed,translated=translated+added,skipped=skipped+processed-added,
  status=CASE WHEN cursor+processed>=total THEN 'completed' ELSE 'running' END,
  finished_at=CASE WHEN cursor+processed>=total THEN now() ELSE NULL END,lease_token=NULL,lease_until=NULL,claimed_data='[]',last_error=NULL,updated_at=now()
 WHERE id=run.id RETURNING * INTO run;
 RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.release_catalog_translation(p_run_id uuid,p_token uuid,p_error text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE exercise_translation_runs SET lease_token=NULL,lease_until=NULL,claimed_data='[]',last_error=left(p_error,300),updated_at=now() WHERE id=p_run_id AND lease_token=p_token AND status='running'
$$;
CREATE FUNCTION public.cancel_catalog_translation(p_run_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_translation_runs;
BEGIN
 SELECT * INTO run FROM exercise_translation_runs WHERE id=p_run_id FOR UPDATE;
 IF run.lease_until>now() THEN RAISE EXCEPTION 'Translation page already in progress'; END IF;
 UPDATE exercise_translation_runs SET status='cancelled',finished_at=now(),lease_token=NULL,lease_until=NULL,claimed_data='[]' WHERE id=p_run_id AND status='running';
END $$;
REVOKE ALL ON FUNCTION public.begin_catalog_translation(uuid,uuid[],boolean),public.claim_catalog_translation(uuid),public.apply_catalog_translation(uuid,uuid,integer,jsonb),public.release_catalog_translation(uuid,uuid,text),public.cancel_catalog_translation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_catalog_translation(uuid,uuid[],boolean),public.claim_catalog_translation(uuid),public.apply_catalog_translation(uuid,uuid,integer,jsonb),public.release_catalog_translation(uuid,uuid,text),public.cancel_catalog_translation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.search_exercises(p_query text DEFAULT '',p_muscles text[] DEFAULT '{}',p_equipment text DEFAULT NULL,p_body_part text DEFAULT NULL,
  p_category text DEFAULT NULL,p_control text DEFAULT NULL,p_source text DEFAULT NULL,p_page integer DEFAULT 0,p_page_size integer DEFAULT 20,p_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE query tsquery; result jsonb;
BEGIN
  IF p_page<0 OR p_page>10000 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 THEN RAISE EXCEPTION 'Invalid pagination/search'; END IF;
  IF p_review AND NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO query FROM
    regexp_split_to_table(regexp_replace(translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^[:alnum:] ]',' ','g'),'\s+') term WHERE term<>'';
  WITH filtered AS (
    SELECT * FROM exercises WHERE catalog_deleted_at IS NULL AND
      (CASE WHEN p_review THEN source<>'user' AND (review_status='pending' OR NOT classification_reviewed OR cardinality(unmapped_muscles)>0) ELSE active AND review_status='approved' END)
      AND (query IS NULL OR search_vector@@query)
      AND (cardinality(p_muscles)=0 OR muscle_keys&&p_muscles)
      AND (p_equipment IS NULL OR p_equipment=ANY(equipamentos)) AND (p_body_part IS NULL OR p_body_part=ANY(partes_corpo))
      AND (p_category IS NULL OR categoria::text=p_category) AND (p_control IS NULL OR tipo_controle::text=p_control)
      AND (p_source IS NULL OR source=p_source)
  ), page AS (SELECT * FROM filtered ORDER BY lower(nome),id LIMIT p_page_size OFFSET p_page*p_page_size)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'external_data'-'external_snapshot'-'catalog_overrides'-'search_vector') FROM page),'[]'),'total',(SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.exercise_catalog_facets() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
   'equipments',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(equipamentos) name FROM exercises WHERE catalog_deleted_at IS NULL AND active AND review_status='approved') e),
   'bodyParts',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(partes_corpo) name FROM exercises WHERE catalog_deleted_at IS NULL AND active AND review_status='approved') b))
$$;
CREATE OR REPLACE FUNCTION public.add_exercise_to_workout(p_workout_id uuid,p_exercise_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM workouts WHERE id=p_workout_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Workout unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_workout_id::text));
 IF NOT EXISTS(SELECT 1 FROM exercises WHERE id=p_exercise_id AND catalog_deleted_at IS NULL AND active AND review_status='approved') THEN RAISE EXCEPTION 'Exercise unavailable'; END IF;
 SELECT id INTO item_id FROM workout_exercises WHERE workout_id=p_workout_id AND exercise_id=p_exercise_id LIMIT 1;
 IF FOUND THEN RETURN item_id; END IF;
 INSERT INTO workout_exercises(user_id,workout_id,exercise_id,ordem,series,repeticoes,descanso_seg)
 SELECT auth.uid(),p_workout_id,p_exercise_id,coalesce(max(ordem),-1)+1,3,10,60 FROM workout_exercises WHERE workout_id=p_workout_id RETURNING id INTO item_id;
 RETURN item_id;
END $$;

CREATE OR REPLACE FUNCTION public.exercise_catalog_facets() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
   'equipments',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(equipamentos) name FROM exercises WHERE catalog_deleted_at IS NULL AND active AND review_status='approved') e),
   'bodyParts',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(partes_corpo) name FROM exercises WHERE catalog_deleted_at IS NULL AND active AND review_status='approved') b),
   'equipmentLabels',(SELECT coalesce(jsonb_object_agg(name,label),'{}') FROM (
     SELECT equipamentos[idx] name,min(equipamentos_pt_br[idx]) label FROM exercises,generate_subscripts(equipamentos,1) idx
     WHERE catalog_deleted_at IS NULL AND active AND review_status='approved' AND equipamentos_pt_br[idx] IS NOT NULL GROUP BY equipamentos[idx]) e),
   'bodyPartLabels',(SELECT coalesce(jsonb_object_agg(name,label),'{}') FROM (
     SELECT partes_corpo[idx] name,min(partes_corpo_pt_br[idx]) label FROM exercises,generate_subscripts(partes_corpo,1) idx
     WHERE catalog_deleted_at IS NULL AND active AND review_status='approved' AND partes_corpo_pt_br[idx] IS NOT NULL GROUP BY partes_corpo[idx]) b))
$$;

$eforge_body_20261002180000$;
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002180000','catalog_management','{}');
 END IF;
END $eforge_apply_20261002180000$;
DO $eforge_apply_20261002200000$
DECLARE complete boolean:=(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='gif_path') AND
   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='gif_sha256') AND
   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='musculo_principal_anatomico') AND
   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='classification_confidence') AND
   to_regprocedure('public.import_owned_gif(jsonb,text)') IS NOT NULL AND
   to_regprocedure('public.inspect_owned_gif_assets(jsonb)') IS NOT NULL AND
   to_regprocedure('public.admin_owned_catalog_page(text,text,text,text,text,text,text,text,integer,integer,boolean)') IS NOT NULL AND
   to_regclass('public.owned_catalog_state') IS NOT NULL AND to_regprocedure('public.set_owned_exercise_active(uuid,boolean)') IS NOT NULL);
BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002200000') THEN
   IF NOT complete THEN RAISE EXCEPTION 'Migration 20261002200000 registrada com estrutura incompleta. Nenhuma reaplicação automática.'; END IF;
 ELSIF complete THEN
   -- Handles a complete manual application without rerunning CREATE/ALTER statements.
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002200000','owned_gif_library','{}');
 ELSE
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='gif_path') OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='gif_sha256') OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='musculo_principal_anatomico') OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exercises' AND column_name='classification_confidence') THEN RAISE EXCEPTION 'Estrutura parcial da migration 20261002200000. Corrija a aplicação parcial antes de continuar.'; END IF;
   EXECUTE $eforge_body_20261002200000$
-- Owned library: reuse exercises, category facets, admin roles and exercise-media.
ALTER TABLE public.exercises ADD COLUMN gif_path text;
ALTER TABLE public.exercises ADD COLUMN gif_sha256 text;
ALTER TABLE public.exercises ADD COLUMN musculo_principal_anatomico text;
ALTER TABLE public.exercises ADD COLUMN classification_confidence text
  CHECK(classification_confidence IN ('alta','media','baixa'));
ALTER TABLE public.exercises ADD CONSTRAINT owned_gif_identity CHECK (
  (gif_sha256 IS NULL AND gif_path IS NULL) OR
  (source='eforge' AND gif_sha256 IS NOT NULL AND gif_path IS NOT NULL AND gif_sha256 ~ '^[a-f0-9]{64}$' AND gif_path ~ '^official/[a-z0-9/-]+--[a-f0-9]{64}\.gif$'
   AND right(gif_path,68)=gif_sha256||'.gif')
);
CREATE UNIQUE INDEX idx_owned_gif_hash ON public.exercises(gif_sha256) WHERE source='eforge' AND gif_sha256 IS NOT NULL;
CREATE UNIQUE INDEX idx_owned_gif_slug ON public.exercises(slug) WHERE source='eforge' AND gif_sha256 IS NOT NULL;

CREATE TABLE public.owned_catalog_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  legacy_disabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz, activated_by uuid REFERENCES auth.users(id),
  removed_count integer NOT NULL DEFAULT 0, archived_count integer NOT NULL DEFAULT 0
);
INSERT INTO public.owned_catalog_state(singleton) VALUES(true);
ALTER TABLE public.owned_catalog_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owned catalog state read" ON public.owned_catalog_state FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.owned_catalog_state TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.owned_catalog_state FROM anon,authenticated;

CREATE FUNCTION public.guard_owned_catalog() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (NEW.source='exercisedb' OR NEW.source='eforge' AND NEW.gif_sha256 IS NULL AND NEW.active) AND EXISTS(SELECT 1 FROM owned_catalog_state WHERE legacy_disabled) THEN
    RAISE EXCEPTION 'A biblioteca externa foi descontinuada.';
  END IF;
  IF TG_OP='UPDATE' AND OLD.gif_sha256 IS NOT NULL AND
    (NEW.gif_sha256 IS DISTINCT FROM OLD.gif_sha256 OR NEW.gif_path IS DISTINCT FROM OLD.gif_path OR NEW.gif_url IS DISTINCT FROM OLD.gif_url) THEN
    RAISE EXCEPTION 'A mídia oficial é imutável. Importe um novo GIF e arquive a versão anterior.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_owned_catalog BEFORE INSERT OR UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.guard_owned_catalog();

-- The bucket is already public. Personal uploads retain their UUID prefix policies.
CREATE POLICY "owned gif admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='exercise-media' AND name ~ '^official/(abdomen|biceps|costas|deltoides|inferiores|panturrilha|peitoral|triceps)/[a-z0-9/-]+--[a-f0-9]{64}\.gif$'
  AND public.is_catalog_admin()
);
CREATE POLICY "owned gif admin cleanup" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='exercise-media' AND name LIKE 'official/%' AND public.is_catalog_admin()
  AND NOT EXISTS(SELECT 1 FROM public.exercises e WHERE e.gif_path=name)
);
-- Protect referenced objects even if another permissive policy is added later.
CREATE POLICY "owned gif immutable" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(bucket_id<>'exercise-media' OR name NOT LIKE 'official/%')
  WITH CHECK(bucket_id<>'exercise-media' OR name NOT LIKE 'official/%');
CREATE POLICY "owned gif referenced guard" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING(bucket_id<>'exercise-media' OR name NOT LIKE 'official/%' OR
    public.is_catalog_admin() AND NOT EXISTS(SELECT 1 FROM public.exercises e WHERE e.gif_path=name));

CREATE FUNCTION public.inspect_owned_gif_assets(p_entries jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries)>5000 OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_entries) r WHERE coalesce(r->>'sha256','') !~ '^[a-f0-9]{64}$'
    OR coalesce(r->>'path','') !~ '^official/[a-z0-9/-]+--[a-f0-9]{64}\.gif$'
    OR right(r->>'path',68)<>r->>'sha256'||'.gif') THEN RAISE EXCEPTION 'Invalid manifest'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('sha256',r->>'sha256','id',e.id,'path',coalesce(e.gif_path,r->>'path'),
    'deleted',e.catalog_deleted_at IS NOT NULL,'asset_exists',o.id IS NOT NULL,'bytes',o.metadata->'size','mime',o.metadata->>'mimetype')),'[]') INTO result
  FROM jsonb_array_elements(p_entries) r LEFT JOIN exercises e ON e.source='eforge' AND e.gif_sha256=r->>'sha256'
  LEFT JOIN storage.objects o ON o.bucket_id='exercise-media' AND o.name=coalesce(e.gif_path,r->>'path');
  RETURN result;
END $$;

CREATE FUNCTION public.import_owned_gif(p_entry jsonb,p_gif_url text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE e exercises; hash text:=p_entry->>'sha256'; path text; category text:=p_entry->>'category'; primary_key text:=coalesce(p_entry->>'primary',''); secondary_keys text[];
  avatar_keys text[]:=ARRAY['chest','abs','obliques','shoulders','biceps','forearms','quads','calves','traps','lats','lower_back','glutes','hamstrings','triceps','rear_delts'];
  category_label text; bytes bigint; existing exercises;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF jsonb_typeof(p_entry) IS DISTINCT FROM 'object' OR octet_length(p_entry::text)>50000 OR coalesce(hash,'') !~ '^[a-f0-9]{64}$'
    OR btrim(coalesce(p_entry->>'name',''))='' OR length(p_entry->>'name')>300 OR p_entry->>'name' ~* '\.gif$'
    OR coalesce(p_entry->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_entry->>'slug')>160
    OR coalesce(category,'') NOT IN ('abdomen','biceps','costas','deltoides','inferiores','panturrilha','peitoral','triceps')
    OR coalesce(p_entry->>'path','') !~ ('^'||category||'/([a-z0-9]+(-[a-z0-9]+)*/)*[a-z0-9]+(-[a-z0-9]+)*\.gif$') OR length(p_entry->>'path')>300
    OR coalesce(p_entry->>'confidence','') NOT IN ('alta','media','baixa')
    OR jsonb_typeof(p_entry->'secondary') IS DISTINCT FROM 'array' OR jsonb_typeof(p_entry->'unmapped') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_entry->'aliases') IS DISTINCT FROM 'array' OR jsonb_array_length(p_entry->'aliases')>100
    OR length(coalesce(p_entry->>'primaryAnatomy',''))>300 OR length(coalesce(p_entry->>'notes',''))>3000
    OR primary_key<>'' AND NOT primary_key=ANY(avatar_keys)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_entry->'secondary') m WHERE NOT m=ANY(avatar_keys))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_entry->'unmapped') m WHERE length(m)>200)
    THEN RAISE EXCEPTION 'Invalid owned exercise'; END IF;
  bytes:=(p_entry->>'bytes')::bigint;
  IF bytes IS NULL OR bytes<13 OR bytes>8388608 THEN RAISE EXCEPTION 'Invalid GIF size'; END IF;
  path:='official/'||left(p_entry->>'path',length(p_entry->>'path')-4)||'--'||hash||'.gif';
  PERFORM pg_advisory_xact_lock(hashtext('eforge-owned-catalog'));
  SELECT * INTO existing FROM exercises WHERE source='eforge' AND gif_sha256=hash FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('id',existing.id,'status','existing','deleted',existing.catalog_deleted_at IS NOT NULL); END IF;
  IF p_gif_url IS NULL OR p_gif_url !~ '^https://[^/?#]+/storage/v1/object/public/exercise-media/' OR
    right(p_gif_url,length('/storage/v1/object/public/exercise-media/'||path))<>'/storage/v1/object/public/exercise-media/'||path THEN RAISE EXCEPTION 'Invalid Storage URL'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='exercise-media' AND o.name=path
    AND o.metadata->>'mimetype'='image/gif' AND (o.metadata->>'size')::bigint=bytes) THEN RAISE EXCEPTION 'GIF não encontrado ou inválido no Storage'; END IF;
  category_label:=CASE category WHEN 'abdomen' THEN 'Abdômen' WHEN 'biceps' THEN 'Bíceps' WHEN 'costas' THEN 'Costas' WHEN 'deltoides' THEN 'Deltoides'
    WHEN 'inferiores' THEN 'Membros inferiores' WHEN 'panturrilha' THEN 'Panturrilha' WHEN 'peitoral' THEN 'Peitoral' WHEN 'triceps' THEN 'Tríceps' END;
  SELECT coalesce(array_agg(DISTINCT m),'{}') INTO secondary_keys FROM jsonb_array_elements_text(p_entry->'secondary') m WHERE m<>primary_key;
  INSERT INTO exercises(source,user_id,visibility,nome,name_original,name_pt_br,slug,gif_url,gif_path,gif_sha256,
    categoria,tipo_controle,partes_corpo,partes_corpo_pt_br,musculo_principal,musculos_primarios,musculos_secundarios,musculos_terciarios,
    musculo_principal_anatomico,unmapped_muscles,classification_confidence,classification_reviewed,review_status,active,observacoes,external_data)
  VALUES('eforge',NULL,'public',trim(p_entry->>'name'),p_entry->>'name',p_entry->>'name',category||'-'||(p_entry->>'slug')||'-'||left(hash,12),p_gif_url,path,hash,
    'funcional','repeticoes',ARRAY[category],ARRAY[category_label],primary_key,CASE WHEN primary_key='' THEN '{}'::text[] ELSE ARRAY[primary_key] END,secondary_keys,'{}',
    nullif(p_entry->>'primaryAnatomy',''),ARRAY(SELECT jsonb_array_elements_text(p_entry->'unmapped')),p_entry->>'confidence',false,'approved',true,nullif(p_entry->>'notes',''),p_entry)
  RETURNING * INTO e;
  RETURN jsonb_build_object('id',e.id,'status','created','deleted',false);
END $$;
REVOKE ALL ON FUNCTION public.inspect_owned_gif_assets(jsonb),public.import_owned_gif(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inspect_owned_gif_assets(jsonb),public.import_owned_gif(jsonb,text) TO authenticated;

CREATE FUNCTION public.catalog_filter_query(p_query text) RETURNS tsquery LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) FROM
    regexp_split_to_table(regexp_replace(translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^[:alnum:] ]',' ','g'),'\s+') term WHERE term<>''
$$;
CREATE FUNCTION public.search_exercises_v2(p_query text DEFAULT '',p_muscles text[] DEFAULT '{}',p_equipment text DEFAULT NULL,p_body_part text DEFAULT NULL,
  p_category text DEFAULT NULL,p_control text DEFAULT NULL,p_source text DEFAULT NULL,p_page integer DEFAULT 0,p_page_size integer DEFAULT 20,p_review boolean DEFAULT false,
  p_primary text DEFAULT NULL,p_secondary text DEFAULT NULL,p_visibility text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE query tsquery:=public.catalog_filter_query(p_query); result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_page<0 OR p_page>10000 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 THEN RAISE EXCEPTION 'Invalid pagination/search'; END IF;
  IF p_review AND NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  WITH filtered AS (
    SELECT * FROM exercises WHERE catalog_deleted_at IS NULL AND
      (source<>'exercisedb' OR NOT EXISTS(SELECT 1 FROM owned_catalog_state WHERE legacy_disabled))
      AND (CASE WHEN p_review THEN source<>'user' AND (review_status='pending' OR NOT classification_reviewed OR cardinality(unmapped_muscles)>0) ELSE active AND review_status='approved' END)
      AND (query IS NULL OR search_vector@@query) AND (cardinality(p_muscles)=0 OR muscle_keys&&p_muscles)
      AND (p_primary IS NULL OR p_primary=ANY(musculos_primarios) OR p_primary=musculo_principal)
      AND (p_secondary IS NULL OR p_secondary=ANY(musculos_secundarios))
      AND (p_equipment IS NULL OR p_equipment=ANY(equipamentos)) AND (p_body_part IS NULL OR p_body_part=ANY(partes_corpo))
      AND (p_category IS NULL OR categoria::text=p_category) AND (p_control IS NULL OR tipo_controle::text=p_control)
      AND (p_source IS NULL OR source=p_source) AND (p_visibility IS NULL OR visibility=p_visibility)
  ), page AS (SELECT * FROM filtered ORDER BY lower(nome),id LIMIT p_page_size OFFSET p_page*p_page_size)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'external_data'-'external_snapshot'-'catalog_overrides'-'search_vector') FROM page),'[]'),'total',(SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.search_exercises(p_query text DEFAULT '',p_muscles text[] DEFAULT '{}',p_equipment text DEFAULT NULL,p_body_part text DEFAULT NULL,
  p_category text DEFAULT NULL,p_control text DEFAULT NULL,p_source text DEFAULT NULL,p_page integer DEFAULT 0,p_page_size integer DEFAULT 20,p_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT public.search_exercises_v2(p_query,p_muscles,p_equipment,p_body_part,p_category,p_control,p_source,p_page,p_page_size,p_review)
$$;
CREATE FUNCTION public.admin_owned_catalog_page(p_query text DEFAULT '',p_body_part text DEFAULT NULL,p_primary text DEFAULT NULL,p_secondary text DEFAULT NULL,
  p_equipment text DEFAULT NULL,p_source text DEFAULT NULL,p_visibility text DEFAULT NULL,p_status text DEFAULT 'all',p_page integer DEFAULT 0,p_page_size integer DEFAULT 20,p_ids_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE query tsquery:=public.catalog_filter_query(p_query); result jsonb;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF p_page<0 OR p_page>10000 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 OR p_status NOT IN ('all','active','pending','inactive','deleted') THEN RAISE EXCEPTION 'Invalid catalog filter'; END IF;
  WITH filtered AS (
    SELECT * FROM exercises WHERE source<>'user' AND (query IS NULL OR search_vector@@query)
      AND (p_source IS NULL OR source=p_source) AND (p_visibility IS NULL OR visibility=p_visibility)
      AND (p_body_part IS NULL OR p_body_part=ANY(partes_corpo)) AND (p_equipment IS NULL OR p_equipment=ANY(equipamentos))
      AND (p_primary IS NULL OR p_primary=ANY(musculos_primarios) OR p_primary=musculo_principal) AND (p_secondary IS NULL OR p_secondary=ANY(musculos_secundarios))
      AND CASE p_status WHEN 'deleted' THEN catalog_deleted_at IS NOT NULL ELSE catalog_deleted_at IS NULL AND
        CASE p_status WHEN 'active' THEN active AND review_status='approved'
          WHEN 'pending' THEN review_status='pending' OR NOT classification_reviewed OR cardinality(unmapped_muscles)>0
          WHEN 'inactive' THEN NOT active ELSE true END END
  ), page AS (SELECT * FROM filtered ORDER BY lower(nome),id LIMIT CASE WHEN p_ids_only THEN 0 ELSE p_page_size END OFFSET p_page*p_page_size)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'external_data'-'external_snapshot'-'catalog_overrides'-'search_vector') FROM page),'[]'),
    'total',(SELECT count(*) FROM filtered),'catalog_total',(SELECT count(*) FROM exercises WHERE source<>'user' AND catalog_deleted_at IS NULL),
    'matching_ids',CASE WHEN p_ids_only THEN (SELECT coalesce(jsonb_agg(id ORDER BY id),'[]') FROM (SELECT id FROM filtered WHERE catalog_deleted_at IS NULL LIMIT 10001) ids) ELSE '[]'::jsonb END) INTO result;
  IF jsonb_array_length(result->'matching_ids')>10000 THEN RAISE EXCEPTION 'Selecione uma categoria menor. Limite de 10.000 itens.'; END IF;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.delete_catalog_exercises(p_ids uuid[] DEFAULT '{}',p_all boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE removed integer;
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  IF p_all AND cardinality(p_ids)>0 OR NOT p_all AND (cardinality(p_ids)=0 OR cardinality(p_ids)>10000) THEN RAISE EXCEPTION 'Invalid selection'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('eforge-owned-catalog'));
  IF NOT p_all AND EXISTS(SELECT 1 FROM unnest(p_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM exercises e WHERE e.id=requested.id AND source<>'user')) THEN RAISE EXCEPTION 'Official catalog only'; END IF;
  UPDATE exercises SET catalog_deleted_at=now(),active=false WHERE source<>'user' AND catalog_deleted_at IS NULL AND (p_all OR id=ANY(p_ids));
  GET DIAGNOSTICS removed=ROW_COUNT; RETURN removed;
END $$;
CREATE OR REPLACE FUNCTION public.restore_catalog_exercise(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('eforge-owned-catalog'));
  IF EXISTS(SELECT 1 FROM exercises WHERE id=p_id AND source='exercisedb') AND EXISTS(SELECT 1 FROM owned_catalog_state WHERE legacy_disabled) THEN RAISE EXCEPTION 'A biblioteca externa foi descontinuada.'; END IF;
  UPDATE exercises SET catalog_deleted_at=NULL,active=(review_status='approved') WHERE id=p_id AND source='eforge' AND gif_sha256 IS NOT NULL AND catalog_deleted_at IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION public.exercise_catalog_facets() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH visible AS (SELECT * FROM exercises WHERE catalog_deleted_at IS NULL AND active AND review_status='approved'
   AND (source<>'exercisedb' OR NOT EXISTS(SELECT 1 FROM owned_catalog_state WHERE legacy_disabled)))
 SELECT jsonb_build_object(
   'equipments',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(equipamentos) name FROM visible) e),
   'bodyParts',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(partes_corpo) name FROM visible) b),
   'equipmentLabels',(SELECT coalesce(jsonb_object_agg(name,label),'{}') FROM (SELECT equipamentos[idx] name,min(equipamentos_pt_br[idx]) label FROM visible,generate_subscripts(equipamentos,1) idx WHERE equipamentos_pt_br[idx] IS NOT NULL GROUP BY equipamentos[idx]) e),
   'bodyPartLabels',(SELECT coalesce(jsonb_object_agg(name,label),'{}') FROM (SELECT partes_corpo[idx] name,min(partes_corpo_pt_br[idx]) label FROM visible,generate_subscripts(partes_corpo,1) idx WHERE partes_corpo_pt_br[idx] IS NOT NULL GROUP BY partes_corpo[idx]) b))
$$;
REVOKE ALL ON FUNCTION public.search_exercises_v2(text,text[],text,text,text,text,text,integer,integer,boolean,text,text,text),public.admin_owned_catalog_page(text,text,text,text,text,text,text,text,integer,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_exercises_v2(text,text[],text,text,text,text,text,integer,integer,boolean,text,text,text),public.admin_owned_catalog_page(text,text,text,text,text,text,text,text,integer,integer,boolean) TO authenticated;

CREATE FUNCTION public.set_owned_exercise_active(p_id uuid,p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_active IS NULL THEN RAISE EXCEPTION 'Invalid status'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('eforge-owned-catalog'));
 IF NOT EXISTS(SELECT 1 FROM exercises WHERE id=p_id AND source='eforge' AND gif_sha256 IS NOT NULL AND catalog_deleted_at IS NULL
   AND (NOT p_active OR review_status='approved')) THEN RAISE EXCEPTION 'Revise ou restaure o exercício oficial antes de ativar.'; END IF;
 UPDATE exercises SET active=p_active WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.set_owned_exercise_active(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_owned_exercise_active(uuid,boolean) TO authenticated;

$eforge_body_20261002200000$;
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002200000','owned_gif_library','{}');
 END IF;
END $eforge_apply_20261002200000$;
DO $eforge_apply_20261002201000$
DECLARE complete boolean:=(to_regprocedure('public.activate_owned_gif_library(text[])') IS NOT NULL AND
   to_regprocedure('public.owned_catalog_report(text[],boolean)') IS NOT NULL);
BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261002201000') THEN
   IF NOT complete THEN RAISE EXCEPTION 'Migration 20261002201000 registrada com estrutura incompleta. Nenhuma reaplicação automática.'; END IF;
 ELSIF complete THEN
   -- Handles a complete manual application without rerunning CREATE/ALTER statements.
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002201000','retire_external_catalog','{}');
 ELSE
   IF to_regprocedure('public.activate_owned_gif_library(text[])') IS NOT NULL THEN RAISE EXCEPTION 'Estrutura parcial da migration 20261002201000. Corrija a aplicação parcial antes de continuar.'; END IF;
   EXECUTE $eforge_body_20261002201000$
-- Defines the explicit cutover. Applying this migration does NOT erase a catalog.
-- Call activate_owned_gif_library only after the imported manifest is complete.
CREATE FUNCTION public.owned_catalog_report(p_hashes text[] DEFAULT '{}',p_include_reviews boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF cardinality(p_hashes)>5000 OR EXISTS(SELECT 1 FROM unnest(p_hashes) h WHERE h !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'Invalid manifest'; END IF;
 WITH owned AS (SELECT e.*,o.id storage_id,o.metadata FROM exercises e LEFT JOIN storage.objects o ON o.bucket_id='exercise-media' AND o.name=e.gif_path WHERE e.source='eforge' AND e.gif_sha256 IS NOT NULL),
 valid AS (SELECT * FROM owned WHERE active AND review_status='approved' AND catalog_deleted_at IS NULL AND storage_id IS NOT NULL
   AND metadata->>'mimetype'='image/gif' AND (metadata->>'size')::bigint=(external_data->>'bytes')::bigint)
 SELECT jsonb_build_object('state',(SELECT to_jsonb(s)-'activated_by' FROM owned_catalog_state s WHERE singleton),
   'imported',(SELECT count(*) FROM owned),'storage_files',(SELECT count(*) FROM owned WHERE storage_id IS NOT NULL),
   'available',(SELECT count(*) FROM valid),'legacy_remaining',(SELECT count(*) FROM exercises WHERE source='exercisedb' AND catalog_deleted_at IS NULL),
   'expected',(SELECT count(DISTINCT h) FROM unnest(p_hashes) h),
   'missing',(SELECT coalesce(jsonb_agg(h),'[]') FROM (SELECT DISTINCT h FROM unnest(p_hashes) h WHERE NOT EXISTS(SELECT 1 FROM valid WHERE gif_sha256=h)) missing),
   'categories',(SELECT coalesce(jsonb_object_agg(category,total),'{}') FROM (SELECT partes_corpo[1] category,count(*) total FROM owned GROUP BY partes_corpo[1]) c),
   'primaries',(SELECT coalesce(jsonb_object_agg(musculo_principal,total),'{}') FROM (SELECT coalesce(nullif(musculo_principal,''),'sem_regiao') musculo_principal,count(*) total FROM owned GROUP BY coalesce(nullif(musculo_principal,''),'sem_regiao')) c),
   'anatomy',(SELECT coalesce(jsonb_object_agg(anatomy,total),'{}') FROM (SELECT coalesce(musculo_principal_anatomico,'Não informado') anatomy,count(*) total FROM owned GROUP BY musculo_principal_anatomico) c),
   'confidence',(SELECT coalesce(jsonb_object_agg(confidence,total),'{}') FROM (SELECT coalesce(classification_confidence,'Não informada') confidence,count(*) total FROM owned GROUP BY classification_confidence) c),
   'reviews',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',nome,'confidence',classification_confidence,'anatomy',musculo_principal_anatomico,'primary',musculo_principal,'unmapped',unmapped_muscles,'notes',observacoes) ORDER BY nome),'[]') FROM owned WHERE p_include_reviews AND (NOT classification_reviewed OR review_status='pending'))
 ) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.activate_owned_gif_library(p_hashes text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE report jsonb; removed integer:=0; archived integer:=0; signature text;
BEGIN
 IF NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_hashes IS NULL OR cardinality(p_hashes)<1 OR cardinality(p_hashes)>5000 OR EXISTS(SELECT 1 FROM unnest(p_hashes) h WHERE h IS NULL OR h !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'Informe o manifesto completo para validar a troca.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('eforge-exercisedb-sync'));
 PERFORM pg_advisory_xact_lock(hashtext('eforge-owned-catalog'));
 IF EXISTS(SELECT 1 FROM owned_catalog_state WHERE legacy_disabled) THEN RETURN public.owned_catalog_report(p_hashes); END IF;
 report:=public.owned_catalog_report(p_hashes);
 IF jsonb_array_length(report->'missing')>0 THEN RAISE EXCEPTION 'A nova biblioteca ainda tem GIFs ausentes, inválidos ou indisponíveis. Importe e valide antes de trocar.'; END IF;

 -- Existing references are preserved. Only truly unreferenced legacy records are removed.
 DELETE FROM exercises e WHERE (e.source='exercisedb' OR e.source='eforge' AND e.gif_sha256 IS NULL)
   AND NOT EXISTS(SELECT 1 FROM workout_exercises w WHERE w.exercise_id=e.id)
   AND NOT EXISTS(SELECT 1 FROM set_logs l WHERE l.exercise_id=e.id);
 GET DIAGNOSTICS removed=ROW_COUNT;
 UPDATE exercises SET active=false,catalog_deleted_at=coalesce(catalog_deleted_at,now())
   WHERE source='exercisedb' OR source='eforge' AND gif_sha256 IS NULL;
 GET DIAGNOSTICS archived=ROW_COUNT;
 UPDATE exercise_sync_runs SET status='cancelled',finished_at=now(),lease_token=NULL,lease_until=NULL WHERE status='running';
 UPDATE exercise_translation_runs SET status='cancelled',finished_at=now(),lease_token=NULL,lease_until=NULL,claimed_data='[]' WHERE status='running';
 UPDATE owned_catalog_state SET legacy_disabled=true,activated_at=now(),activated_by=auth.uid(),removed_count=removed,archived_count=archived WHERE singleton;

 -- A previously deployed legacy Edge Function cannot restart or apply work afterward.
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('begin_exercise_sync','begin_exercise_sync_filtered','claim_exercise_sync_page','apply_exercise_sync_page','release_exercise_sync_page','cancel_exercise_sync',
    'begin_catalog_translation','claim_catalog_translation','apply_catalog_translation','release_catalog_translation','cancel_catalog_translation') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||signature||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
 RETURN public.owned_catalog_report(p_hashes);
END $$;
REVOKE ALL ON FUNCTION public.owned_catalog_report(text[],boolean),public.activate_owned_gif_library(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owned_catalog_report(text[],boolean),public.activate_owned_gif_library(text[]) TO authenticated;

$eforge_body_20261002201000$;
   INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261002201000','retire_external_catalog','{}');
 END IF;
END $eforge_apply_20261002201000$;
COMMIT;
SELECT to_regprocedure('public.import_owned_gif(jsonb,text)') IS NOT NULL AS importador_disponivel,
 to_regprocedure('public.activate_owned_gif_library(text[])') IS NOT NULL AS troca_disponivel,
 (SELECT legacy_disabled FROM public.owned_catalog_state WHERE singleton) AS biblioteca_ativada;
