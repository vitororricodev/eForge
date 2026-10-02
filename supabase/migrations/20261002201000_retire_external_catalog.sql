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
