import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { catalogPageSchema, type CatalogFilters } from "@/lib/exercise-types";

export function useDebouncedSearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim().slice(0, 120)), 300);
    return () => clearTimeout(timer);
  }, [value]);
  return search;
}
export function useExerciseCatalog(filters: CatalogFilters = {}, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exercises", "catalog", user?.id, filters],
    enabled: !!user && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_exercises_v2", {
        p_primary: filters.primaryMuscle || null,
        p_secondary: filters.secondaryMuscle || null,
        p_visibility: filters.visibility || null,
        p_query: filters.query ?? "",
        p_muscles: filters.muscles ?? [],
        p_equipment: filters.equipment || null,
        p_body_part: filters.bodyPart || null,
        p_category: filters.category || null,
        p_control: filters.control || null,
        p_source: filters.source || null,
        p_page: filters.page ?? 0,
        p_page_size: filters.pageSize ?? 20,
        p_review: filters.review ?? false,
      });
      if (error) throw error;
      return catalogPageSchema.parse(data);
    },
  });
}
export function useCatalogFacets(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exercises", "facets", user?.id],
    enabled: !!user && enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exercise_catalog_facets");
      if (error) throw error;
      return z
        .object({
          equipments: z.array(z.string()),
          bodyParts: z.array(z.string()),
          equipmentLabels: z.record(z.string()).default({}),
          bodyPartLabels: z.record(z.string()).default({}),
        })
        .parse(data);
    },
  });
}
export function useCatalogAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["catalog-admin", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
