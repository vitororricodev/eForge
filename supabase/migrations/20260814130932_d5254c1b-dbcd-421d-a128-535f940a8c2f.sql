CREATE TYPE public.session_status AS ENUM ('em_andamento','concluida','cancelada');

CREATE TABLE public.workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workouts all" ON public.workouts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workout_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  series INTEGER NOT NULL DEFAULT 3,
  repeticoes INTEGER NOT NULL DEFAULT 10,
  carga_kg NUMERIC,
  descanso_seg INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout exercises all" ON public.workout_exercises FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  nome_treino TEXT NOT NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  duracao_min NUMERIC,
  volume_total NUMERIC NOT NULL DEFAULT 0,
  status public.session_status NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions all" ON public.workout_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.set_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  nome_exercicio TEXT NOT NULL,
  musculo_principal TEXT,
  serie_numero INTEGER NOT NULL DEFAULT 1,
  repeticoes INTEGER,
  carga_kg NUMERIC,
  concluida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.set_logs TO authenticated;
GRANT ALL ON public.set_logs TO service_role;
ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own set logs all" ON public.set_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER touch_workouts BEFORE UPDATE ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_workout_exercises BEFORE UPDATE ON public.workout_exercises FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_workout_sessions BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_workout_exercises_workout ON public.workout_exercises(workout_id);
CREATE INDEX idx_set_logs_session ON public.set_logs(session_id);
CREATE INDEX idx_sessions_user_date ON public.workout_sessions(user_id, iniciado_em DESC);