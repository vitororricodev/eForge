
CREATE TYPE public.goal_type AS ENUM (
  'aumentar_carga',
  'mais_repeticoes',
  'treinos_semana',
  'distancia_cardio',
  'tempo_cardio',
  'reduzir_peso',
  'aumentar_peso',
  'medidas_corporais'
);

CREATE TYPE public.goal_status AS ENUM ('ativa', 'concluida', 'cancelada');

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo_meta public.goal_type NOT NULL,
  titulo TEXT NOT NULL,
  valor_atual NUMERIC NOT NULL DEFAULT 0,
  valor_alvo NUMERIC NOT NULL,
  unidade TEXT NOT NULL DEFAULT '',
  prazo DATE,
  status public.goal_status NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own goals all" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER goals_touch_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX goals_user_status_idx ON public.goals(user_id, status);

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  medalha TEXT NOT NULL,
  descricao TEXT NOT NULL,
  desbloqueada BOOLEAN NOT NULL DEFAULT false,
  data_conquista TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own achievements all" ON public.achievements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX achievements_user_idx ON public.achievements(user_id, desbloqueada);
