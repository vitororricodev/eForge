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
