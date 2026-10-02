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
