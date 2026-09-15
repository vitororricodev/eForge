-- Enum de objetivo fitness
DO $$ BEGIN
  CREATE TYPE public.fitness_goal AS ENUM (
    'perder_peso','ganhar_massa','manter_peso','condicionamento','hipertrofia','saude_geral'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS objetivo_fitness public.fitness_goal;
