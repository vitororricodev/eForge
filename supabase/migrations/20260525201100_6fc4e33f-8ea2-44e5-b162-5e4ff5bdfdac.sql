
CREATE TYPE public.cardio_type AS ENUM ('corrida', 'caminhada', 'bicicleta');

CREATE TABLE public.cardio_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_cardio public.cardio_type NOT NULL,
  distancia_km NUMERIC(6,2),
  tempo_min NUMERIC(6,2),
  ritmo_medio NUMERIC(6,2),
  calorias INTEGER,
  observacoes TEXT,
  data_atividade DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cardio all" ON public.cardio_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cardio_logs_user_date ON public.cardio_logs(user_id, data_atividade DESC);

CREATE TRIGGER trg_cardio_logs_touch
  BEFORE UPDATE ON public.cardio_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
