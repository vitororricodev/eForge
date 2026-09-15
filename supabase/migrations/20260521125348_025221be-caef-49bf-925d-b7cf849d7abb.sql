
-- Enums
CREATE TYPE public.exercise_control_type AS ENUM ('peso_corporal','peso_kg','repeticoes','segundos','distancia');
CREATE TYPE public.exercise_category AS ENUM ('musculacao','cardio','funcional','alongamento');

-- Table
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  gif_url text,
  tipo_controle public.exercise_control_type NOT NULL,
  musculo_principal text NOT NULL,
  musculos_secundarios text[] NOT NULL DEFAULT '{}',
  categoria public.exercise_category NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own exercises select" ON public.exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own exercises insert" ON public.exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own exercises update" ON public.exercises FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own exercises delete" ON public.exercises FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_exercises_touch_updated
BEFORE UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_exercises_user ON public.exercises(user_id, created_at DESC);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-media','exercise-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (user folder = user_id)
CREATE POLICY "exercise-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-media');

CREATE POLICY "exercise-media user insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exercise-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "exercise-media user update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exercise-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "exercise-media user delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'exercise-media' AND auth.uid()::text = (storage.foldername(name))[1]);
