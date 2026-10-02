-- Additive catalog integration. Existing IDs, owners and training history are preserved.
ALTER TABLE public.exercises ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.exercises
  ADD COLUMN source text NOT NULL DEFAULT 'user' CHECK (source IN ('user','eforge','exercisedb')),
  ADD COLUMN external_id text,
  ADD COLUMN name_original text,
  ADD COLUMN name_pt_br text,
  ADD COLUMN slug text,
  ADD COLUMN descricao text,
  ADD COLUMN equipamentos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN partes_corpo text[] NOT NULL DEFAULT '{}',
  ADD COLUMN instrucoes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN instrucoes_pt_br text[] NOT NULL DEFAULT '{}',
  ADD COLUMN dificuldade text,
  ADD COLUMN musculos_primarios text[] NOT NULL DEFAULT '{}',
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending')),
  ADD COLUMN classification_reviewed boolean NOT NULL DEFAULT true,
  ADD COLUMN unmapped_muscles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN external_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN external_snapshot jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN catalog_overrides text[] NOT NULL DEFAULT '{}',
  ADD COLUMN last_synced_at timestamptz,
  ADD CONSTRAINT exercises_external_unique UNIQUE(source, external_id),
  ADD CONSTRAINT exercises_origin_check CHECK (
    (source='user' AND user_id IS NOT NULL AND external_id IS NULL)
    OR (source='eforge' AND user_id IS NULL AND external_id IS NULL AND visibility='public')
    OR (source='exercisedb' AND user_id IS NULL AND external_id IS NOT NULL AND visibility='public')
  );
UPDATE public.exercises SET musculos_primarios=ARRAY[musculo_principal];
ALTER TABLE public.set_logs ADD COLUMN musculos_primarios text[] NOT NULL DEFAULT '{}';
UPDATE public.set_logs SET musculos_primarios=ARRAY[musculo_principal] WHERE musculo_principal IS NOT NULL;

CREATE FUNCTION public.is_catalog_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='admin')
$$;
REVOKE ALL ON FUNCTION public.is_catalog_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_catalog_admin() TO authenticated,service_role;
GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY "exercise visibility select" ON public.exercises;
CREATE POLICY "catalog visibility select" ON public.exercises FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR (visibility='public' AND review_status='approved') OR (source<>'user' AND public.is_catalog_admin()));
-- Restrictive policies also protect against an owner forging source/user_id on update.
CREATE POLICY "catalog insert guard" ON public.exercises AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(source='user' AND user_id=auth.uid() AND external_id IS NULL AND review_status='approved');
CREATE POLICY "catalog update guard" ON public.exercises AS RESTRICTIVE FOR UPDATE TO authenticated
  USING((source='user' AND user_id=auth.uid()) OR (source<>'user' AND public.is_catalog_admin()))
  WITH CHECK((source='user' AND user_id=auth.uid() AND external_id IS NULL) OR (source<>'user' AND public.is_catalog_admin()));
CREATE POLICY "catalog delete guard" ON public.exercises AS RESTRICTIVE FOR DELETE TO authenticated
  USING(source='user' AND user_id=auth.uid());
CREATE POLICY "catalog admin update" ON public.exercises FOR UPDATE TO authenticated
  USING(source<>'user' AND public.is_catalog_admin()) WITH CHECK(source<>'user' AND public.is_catalog_admin());

CREATE FUNCTION public.track_catalog_overrides() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE field text;
BEGIN
  IF OLD.source<>'user' AND auth.uid() IS NOT NULL THEN
    IF NEW.source<>OLD.source OR NEW.external_id IS DISTINCT FROM OLD.external_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Catalog identity cannot be changed';
    END IF;
    NEW.catalog_overrides:=OLD.catalog_overrides;
    FOREACH field IN ARRAY ARRAY['nome','slug','gif_url','equipamentos','partes_corpo','instrucoes','musculo_principal','musculos_primarios','musculos_secundarios','review_status','active'] LOOP
      IF to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field AND NOT field=ANY(NEW.catalog_overrides) THEN
        NEW.catalog_overrides:=array_append(NEW.catalog_overrides,field);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER track_catalog_overrides BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.track_catalog_overrides();

-- Normalize legacy Portuguese names and canonical keys for indexed server filters.
CREATE FUNCTION public.catalog_muscle_keys(names text[]) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(array_agg(DISTINCT key ORDER BY key),'{}') FROM (
    SELECT unnest(CASE regexp_replace(translate(lower(trim(name)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),'[ -]+','_','g')
      WHEN 'peito' THEN ARRAY['chest'] WHEN 'peitoral' THEN ARRAY['chest'] WHEN 'chest' THEN ARRAY['chest']
      WHEN 'abdomen' THEN ARRAY['abs'] WHEN 'abdominal' THEN ARRAY['abs'] WHEN 'abdominais' THEN ARRAY['abs'] WHEN 'abs' THEN ARRAY['abs']
      WHEN 'core' THEN ARRAY['abs','obliques'] WHEN 'obliquos' THEN ARRAY['obliques'] WHEN 'obliques' THEN ARRAY['obliques']
      WHEN 'ombro' THEN ARRAY['shoulders'] WHEN 'ombros' THEN ARRAY['shoulders'] WHEN 'shoulder' THEN ARRAY['shoulders'] WHEN 'shoulders' THEN ARRAY['shoulders']
      WHEN 'biceps' THEN ARRAY['biceps'] WHEN 'biceps_braquial' THEN ARRAY['biceps'] WHEN 'triceps' THEN ARRAY['triceps']
      WHEN 'antebraco' THEN ARRAY['forearms'] WHEN 'antebracos' THEN ARRAY['forearms'] WHEN 'forearm' THEN ARRAY['forearms'] WHEN 'forearms' THEN ARRAY['forearms']
      WHEN 'quadriceps' THEN ARRAY['quads'] WHEN 'quads' THEN ARRAY['quads']
      WHEN 'panturrilha' THEN ARRAY['calves'] WHEN 'panturrilhas' THEN ARRAY['calves'] WHEN 'calf' THEN ARRAY['calves'] WHEN 'calves' THEN ARRAY['calves']
      WHEN 'trapezio' THEN ARRAY['traps'] WHEN 'trapezios' THEN ARRAY['traps'] WHEN 'trap' THEN ARRAY['traps'] WHEN 'traps' THEN ARRAY['traps']
      WHEN 'costas' THEN ARRAY['lats'] WHEN 'dorsal' THEN ARRAY['lats'] WHEN 'dorsais' THEN ARRAY['lats'] WHEN 'back' THEN ARRAY['lats'] WHEN 'lat' THEN ARRAY['lats'] WHEN 'lats' THEN ARRAY['lats']
      WHEN 'lombar' THEN ARRAY['lower_back'] WHEN 'lower_back' THEN ARRAY['lower_back']
      WHEN 'gluteo' THEN ARRAY['glutes'] WHEN 'gluteos' THEN ARRAY['glutes'] WHEN 'glute' THEN ARRAY['glutes'] WHEN 'glutes' THEN ARRAY['glutes']
      WHEN 'posterior' THEN ARRAY['hamstrings'] WHEN 'posteriores' THEN ARRAY['hamstrings'] WHEN 'posterior_de_coxa' THEN ARRAY['hamstrings'] WHEN 'hamstring' THEN ARRAY['hamstrings'] WHEN 'hamstrings' THEN ARRAY['hamstrings']
      WHEN 'rear_delt' THEN ARRAY['rear_delts'] WHEN 'rear_delts' THEN ARRAY['rear_delts'] WHEN 'deltoide_posterior' THEN ARRAY['rear_delts'] WHEN 'deltoides_posteriores' THEN ARRAY['rear_delts'] WHEN 'ombro_posterior' THEN ARRAY['rear_delts']
      ELSE '{}'::text[] END) AS key FROM unnest(names) name
  ) mapped
$$;
ALTER TABLE public.exercises ADD COLUMN muscle_keys text[] GENERATED ALWAYS AS (
  public.catalog_muscle_keys(ARRAY[musculo_principal]||musculos_primarios||musculos_secundarios||musculos_terciarios)
) STORED;
ALTER TABLE public.exercises ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('simple',translate(lower(nome||' '||coalesce(name_original,'')||' '||coalesce(name_pt_br,'')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))
) STORED;
CREATE INDEX idx_catalog_search ON public.exercises USING gin(search_vector);
CREATE INDEX idx_catalog_muscles ON public.exercises USING gin(muscle_keys);
CREATE INDEX idx_catalog_equipment ON public.exercises USING gin(equipamentos);
CREATE INDEX idx_catalog_body_parts ON public.exercises USING gin(partes_corpo);
CREATE INDEX idx_catalog_page ON public.exercises(active,review_status,nome,id);

CREATE TABLE public.exercise_muscle_mappings (
  source_name text PRIMARY KEY,
  muscle_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('mapped','pending','unsupported')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(muscle_keys <@ ARRAY['chest','abs','obliques','shoulders','biceps','forearms','quads','calves','traps','lats','lower_back','glutes','hamstrings','triceps','rear_delts']),
  CHECK((status='mapped' AND cardinality(muscle_keys)>0) OR (status<>'mapped' AND cardinality(muscle_keys)=0))
);
ALTER TABLE public.exercise_muscle_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog mapping admin" ON public.exercise_muscle_mappings FOR ALL TO authenticated
  USING(public.is_catalog_admin()) WITH CHECK(public.is_catalog_admin());
CREATE TRIGGER touch_catalog_mapping BEFORE UPDATE ON public.exercise_muscle_mappings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.exercise_muscle_mappings(source_name,muscle_keys,status) VALUES
 ('pectorals','{chest}','mapped'),('abdominals','{abs}','mapped'),('obliques','{obliques}','mapped'),
 ('deltoids','{shoulders}','mapped'),('rear deltoids','{rear_delts}','mapped'),('biceps','{biceps}','mapped'),
 ('triceps','{triceps}','mapped'),('forearms','{forearms}','mapped'),('quadriceps','{quads}','mapped'),('quads','{quads}','mapped'),
 ('hamstrings','{hamstrings}','mapped'),('glutes','{glutes}','mapped'),('calves','{calves}','mapped'),('soleus','{calves}','mapped'),
 ('latissimus dorsi','{lats}','mapped'),('lats','{lats}','mapped'),('trapezius','{traps}','mapped'),('traps','{traps}','mapped');

CREATE TABLE public.exercise_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), initiated_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  received integer NOT NULL DEFAULT 0, new_count integer NOT NULL DEFAULT 0, updated_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0, error_count integer NOT NULL DEFAULT 0, total integer,
  cursor text, has_next boolean NOT NULL DEFAULT true, cursor_history text[] NOT NULL DEFAULT '{}',
  errors jsonb NOT NULL DEFAULT '[]', last_error text, lease_token uuid, lease_until timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
ALTER TABLE public.exercise_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog sync admin read" ON public.exercise_sync_runs FOR SELECT TO authenticated USING(public.is_catalog_admin());
CREATE UNIQUE INDEX idx_one_catalog_sync ON public.exercise_sync_runs(status) WHERE status='running';
CREATE INDEX idx_catalog_sync_history ON public.exercise_sync_runs(started_at DESC);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.exercise_muscle_mappings TO authenticated;
GRANT SELECT ON public.exercise_sync_runs TO authenticated;
GRANT ALL ON public.exercises,public.exercise_muscle_mappings,public.exercise_sync_runs TO service_role;

CREATE FUNCTION public.begin_exercise_sync(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_sync_runs;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('eforge-exercisedb-sync'));
  IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO run FROM exercise_sync_runs WHERE status='running';
  IF FOUND THEN RETURN to_jsonb(run); END IF;
  INSERT INTO exercise_sync_runs(initiated_by) VALUES(p_actor) RETURNING * INTO run;
  RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.claim_exercise_sync_page(p_run_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_sync_runs;
BEGIN
  SELECT * INTO run FROM exercise_sync_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sync not found'; END IF;
  IF run.status<>'running' THEN RETURN to_jsonb(run); END IF;
  IF run.lease_until>now() THEN RAISE EXCEPTION 'Sync page already in progress'; END IF;
  IF cardinality(run.cursor_history)>=1000 THEN RAISE EXCEPTION 'Pagination safety limit reached'; END IF;
  UPDATE exercise_sync_runs SET lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
    WHERE id=run.id RETURNING * INTO run;
  RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.apply_exercise_sync_page(p_run_id uuid,p_token uuid,p_cursor text,p_next_cursor text,p_has_next boolean,p_total integer,p_received integer,p_records jsonb,p_errors jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_sync_runs; item jsonb; old exercises; merged jsonb; field text; pending boolean;
  added integer:=0; changed integer:=0; skipped integer:=0; seen text[]:='{}';
BEGIN
  SELECT * INTO run FROM exercise_sync_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sync not found'; END IF;
  IF run.status<>'running' OR run.cursor IS DISTINCT FROM p_cursor THEN RETURN to_jsonb(run); END IF;
  IF run.lease_token IS DISTINCT FROM p_token OR run.lease_until<now() THEN RAISE EXCEPTION 'Invalid sync lease'; END IF;
  IF p_received<0 OR p_received>25 OR jsonb_array_length(p_records)+jsonb_array_length(p_errors)<>p_received THEN RAISE EXCEPTION 'Invalid page size'; END IF;
  IF p_has_next AND (p_next_cursor IS NULL OR p_next_cursor=p_cursor OR p_next_cursor=ANY(run.cursor_history)) THEN RAISE EXCEPTION 'Repeated cursor'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    IF (item->>'external_id')=ANY(seen) THEN skipped:=skipped+1; CONTINUE; END IF;
    seen:=array_append(seen,item->>'external_id');
    INSERT INTO exercise_muscle_mappings(source_name)
      SELECT value FROM jsonb_array_elements_text(item->'unmapped_muscles') ON CONFLICT DO NOTHING;
    SELECT * INTO old FROM exercises WHERE source='exercisedb' AND external_id=item->>'external_id' FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO exercises(user_id,source,external_id,nome,name_original,slug,gif_url,equipamentos,partes_corpo,instrucoes,
        musculo_principal,musculos_primarios,musculos_secundarios,tipo_controle,categoria,classification_reviewed,visibility,active,review_status,unmapped_muscles,external_data,external_snapshot,last_synced_at)
      VALUES(NULL,'exercisedb',item->>'external_id',item->>'nome',item->>'name_original',item->>'slug',item->>'gif_url',
        ARRAY(SELECT jsonb_array_elements_text(item->'equipamentos')),ARRAY(SELECT jsonb_array_elements_text(item->'partes_corpo')),ARRAY(SELECT jsonb_array_elements_text(item->'instrucoes')),
        item->>'musculo_principal',ARRAY(SELECT jsonb_array_elements_text(item->'musculos_primarios')),ARRAY(SELECT jsonb_array_elements_text(item->'musculos_secundarios')),
        'repeticoes','funcional',false,'public',(item->>'review_status')='approved',item->>'review_status',ARRAY(SELECT jsonb_array_elements_text(item->'unmapped_muscles')),item->'external_data',item-'external_data',now());
      added:=added+1;
    ELSE
      merged:=to_jsonb(old);
      FOREACH field IN ARRAY ARRAY['nome','name_original','slug','gif_url','equipamentos','partes_corpo','instrucoes','musculo_principal','musculos_primarios','musculos_secundarios','review_status','unmapped_muscles'] LOOP
        -- Keep the last published version usable if new anatomy needs review.
        IF NOT field=ANY(old.catalog_overrides) AND (old.review_status<>'approved' OR item->>'review_status'='approved' OR field='unmapped_muscles') THEN merged:=jsonb_set(merged,ARRAY[field],coalesce(item->field,'null')); END IF;
      END LOOP;
      pending:=(merged->>'review_status')='pending';
      IF NOT 'active'=ANY(old.catalog_overrides) THEN merged:=jsonb_set(merged,'{active}',to_jsonb(NOT pending)); END IF;
      IF old.external_snapshot IS NOT DISTINCT FROM item-'external_data' AND old.external_data IS NOT DISTINCT FROM item->'external_data' THEN skipped:=skipped+1;
      ELSE changed:=changed+1; END IF;
      UPDATE exercises SET nome=merged->>'nome',name_original=merged->>'name_original',slug=merged->>'slug',gif_url=merged->>'gif_url',
        equipamentos=ARRAY(SELECT jsonb_array_elements_text(merged->'equipamentos')),partes_corpo=ARRAY(SELECT jsonb_array_elements_text(merged->'partes_corpo')),instrucoes=ARRAY(SELECT jsonb_array_elements_text(merged->'instrucoes')),
        musculo_principal=merged->>'musculo_principal',musculos_primarios=ARRAY(SELECT jsonb_array_elements_text(merged->'musculos_primarios')),musculos_secundarios=ARRAY(SELECT jsonb_array_elements_text(merged->'musculos_secundarios')),
        review_status=merged->>'review_status',active=(merged->>'active')::boolean,unmapped_muscles=ARRAY(SELECT jsonb_array_elements_text(merged->'unmapped_muscles')),
        external_data=item->'external_data',external_snapshot=item-'external_data',last_synced_at=now() WHERE id=old.id;
    END IF;
  END LOOP;
  UPDATE exercise_sync_runs SET received=received+p_received,new_count=new_count+added,updated_count=updated_count+changed,ignored_count=ignored_count+skipped,
    error_count=error_count+jsonb_array_length(p_errors),errors=(SELECT coalesce(jsonb_agg(value),'[]') FROM (SELECT value FROM jsonb_array_elements(errors||p_errors) LIMIT 100) limited),
    cursor=p_next_cursor,cursor_history=CASE WHEN p_next_cursor IS NULL THEN cursor_history ELSE array_append(cursor_history,p_next_cursor) END,
    has_next=p_has_next,total=p_total,status=CASE WHEN p_has_next THEN 'running' ELSE 'completed' END,
    finished_at=CASE WHEN p_has_next THEN NULL ELSE now() END,updated_at=now(),lease_token=NULL,lease_until=NULL,last_error=NULL
    WHERE id=run.id RETURNING * INTO run;
  RETURN to_jsonb(run);
END $$;
CREATE FUNCTION public.release_exercise_sync_page(p_run_id uuid,p_token uuid,p_error text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE exercise_sync_runs SET lease_token=NULL,lease_until=NULL,last_error=left(p_error,300),updated_at=now()
  WHERE id=p_run_id AND lease_token=p_token AND status='running'
$$;
CREATE FUNCTION public.cancel_exercise_sync(p_run_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run exercise_sync_runs;
BEGIN
  SELECT * INTO run FROM exercise_sync_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sync not found'; END IF;
  IF run.lease_until>now() THEN RAISE EXCEPTION 'Sync page already in progress'; END IF;
  UPDATE exercise_sync_runs SET status='failed',has_next=false,finished_at=now(),lease_token=NULL,lease_until=NULL,last_error='Cancelada pelo administrador'
  WHERE id=p_run_id AND status='running';
END $$;
REVOKE ALL ON FUNCTION public.begin_exercise_sync(uuid), public.claim_exercise_sync_page(uuid),
  public.apply_exercise_sync_page(uuid,uuid,text,text,boolean,integer,integer,jsonb,jsonb),
  public.release_exercise_sync_page(uuid,uuid,text),public.cancel_exercise_sync(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_exercise_sync(uuid), public.claim_exercise_sync_page(uuid),
  public.apply_exercise_sync_page(uuid,uuid,text,text,boolean,integer,integer,jsonb,jsonb),
  public.release_exercise_sync_page(uuid,uuid,text),public.cancel_exercise_sync(uuid) TO service_role;

CREATE FUNCTION public.search_exercises(p_query text DEFAULT '',p_muscles text[] DEFAULT '{}',p_equipment text DEFAULT NULL,p_body_part text DEFAULT NULL,
  p_category text DEFAULT NULL,p_control text DEFAULT NULL,p_source text DEFAULT NULL,p_page integer DEFAULT 0,p_page_size integer DEFAULT 20,p_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE query tsquery; result jsonb;
BEGIN
  IF p_page<0 OR p_page>10000 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 THEN RAISE EXCEPTION 'Invalid pagination/search'; END IF;
  IF p_review AND NOT public.is_catalog_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO query FROM
    regexp_split_to_table(regexp_replace(translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^[:alnum:] ]',' ','g'),'\s+') term WHERE term<>'';
  WITH filtered AS (
    SELECT * FROM exercises WHERE
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
CREATE FUNCTION public.exercise_catalog_facets() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
   'equipments',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(equipamentos) name FROM exercises WHERE active AND review_status='approved') e),
   'bodyParts',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]') FROM (SELECT DISTINCT unnest(partes_corpo) name FROM exercises WHERE active AND review_status='approved') b))
$$;
CREATE FUNCTION public.add_exercise_to_workout(p_workout_id uuid,p_exercise_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM workouts WHERE id=p_workout_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Workout unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_workout_id::text));
 IF NOT EXISTS(SELECT 1 FROM exercises WHERE id=p_exercise_id AND active AND review_status='approved') THEN RAISE EXCEPTION 'Exercise unavailable'; END IF;
 SELECT id INTO item_id FROM workout_exercises WHERE workout_id=p_workout_id AND exercise_id=p_exercise_id LIMIT 1;
 IF FOUND THEN RETURN item_id; END IF;
 INSERT INTO workout_exercises(user_id,workout_id,exercise_id,ordem,series,repeticoes,descanso_seg)
 SELECT auth.uid(),p_workout_id,p_exercise_id,coalesce(max(ordem),-1)+1,3,10,60 FROM workout_exercises WHERE workout_id=p_workout_id RETURNING id INTO item_id;
 RETURN item_id;
END $$;
REVOKE ALL ON FUNCTION public.search_exercises(text,text[],text,text,text,text,text,integer,integer,boolean),public.exercise_catalog_facets(),public.add_exercise_to_workout(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_exercises(text,text[],text,text,text,text,text,integer,integer,boolean),public.exercise_catalog_facets(),public.add_exercise_to_workout(uuid,uuid) TO authenticated;
