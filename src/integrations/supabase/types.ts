export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      owned_catalog_state: {
        Row: {
          singleton: boolean;
          legacy_disabled: boolean;
          activated_at: string | null;
          activated_by: string | null;
          removed_count: number;
          archived_count: number;
        };
        Insert: {
          singleton?: boolean;
          legacy_disabled?: boolean;
          activated_at?: string | null;
          activated_by?: string | null;
          removed_count?: number;
          archived_count?: number;
        };
        Update: {
          singleton?: boolean;
          legacy_disabled?: boolean;
          activated_at?: string | null;
          activated_by?: string | null;
          removed_count?: number;
          archived_count?: number;
        };
        Relationships: [];
      };
      exercise_translation_runs: {
        Row: {
          id: string;
          initiated_by: string;
          status: "running" | "completed" | "cancelled";
          target_ids: string[];
          cursor: number;
          total: number;
          translated: number;
          skipped: number;
          estimated_characters: number;
          last_error: string | null;
          lease_token: string | null;
          lease_until: string | null;
          claimed_data: Json;
          started_at: string;
          updated_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          initiated_by: string;
          status?: "running" | "completed" | "cancelled";
          target_ids?: string[];
          cursor?: number;
          total?: number;
          translated?: number;
          skipped?: number;
          estimated_characters?: number;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          claimed_data?: Json;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          initiated_by?: string;
          status?: "running" | "completed" | "cancelled";
          target_ids?: string[];
          cursor?: number;
          total?: number;
          translated?: number;
          skipped?: number;
          estimated_characters?: number;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          claimed_data?: Json;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };

      exercise_sync_runs: {
        Row: {
          body_parts: string[];
          id: string;
          initiated_by: string;
          status: "running" | "completed" | "failed";
          received: number;
          new_count: number;
          updated_count: number;
          ignored_count: number;
          error_count: number;
          total: number | null;
          cursor: string | null;
          has_next: boolean;
          cursor_history: string[];
          errors: Json;
          last_error: string | null;
          lease_token: string | null;
          lease_until: string | null;
          started_at: string;
          updated_at: string;
          finished_at: string | null;
        };
        Insert: {
          body_parts?: string[];
          id?: string;
          initiated_by: string;
          status?: "running" | "completed" | "failed";
          received?: number;
          new_count?: number;
          updated_count?: number;
          ignored_count?: number;
          error_count?: number;
          total?: number | null;
          cursor?: string | null;
          has_next?: boolean;
          cursor_history?: string[];
          errors?: Json;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
        Update: {
          body_parts?: string[];
          id?: string;
          initiated_by?: string;
          status?: "running" | "completed" | "failed";
          received?: number;
          new_count?: number;
          updated_count?: number;
          ignored_count?: number;
          error_count?: number;
          total?: number | null;
          cursor?: string | null;
          has_next?: boolean;
          cursor_history?: string[];
          errors?: Json;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      exercise_muscle_mappings: {
        Row: {
          source_name: string;
          muscle_keys: string[];
          status: "mapped" | "pending" | "unsupported";
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          source_name: string;
          muscle_keys?: string[];
          status?: "mapped" | "pending" | "unsupported";
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          source_name?: string;
          muscle_keys?: string[];
          status?: "mapped" | "pending" | "unsupported";
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          codigo: string;
          created_at: string;
          data_conquista: string | null;
          desbloqueada: boolean;
          descricao: string;
          id: string;
          medalha: string;
          user_id: string;
        };
        Insert: {
          codigo: string;
          created_at?: string;
          data_conquista?: string | null;
          desbloqueada?: boolean;
          descricao: string;
          id?: string;
          medalha: string;
          user_id: string;
        };
        Update: {
          codigo?: string;
          created_at?: string;
          data_conquista?: string | null;
          desbloqueada?: boolean;
          descricao?: string;
          id?: string;
          medalha?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          abdomen_cm: number | null;
          arm_cm: number | null;
          calf_cm: number | null;
          chest_cm: number | null;
          created_at: string;
          hip_cm: number | null;
          id: string;
          measured_at: string;
          notes: string | null;
          thigh_cm: number | null;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          abdomen_cm?: number | null;
          arm_cm?: number | null;
          calf_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_at?: string;
          notes?: string | null;
          thigh_cm?: number | null;
          user_id: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          abdomen_cm?: number | null;
          arm_cm?: number | null;
          calf_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_at?: string;
          notes?: string | null;
          thigh_cm?: number | null;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      cardio_logs: {
        Row: {
          calorias: number | null;
          created_at: string;
          data_atividade: string;
          distancia_km: number | null;
          id: string;
          observacoes: string | null;
          ritmo_medio: number | null;
          tempo_min: number | null;
          tipo_cardio: Database["public"]["Enums"]["cardio_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          calorias?: number | null;
          created_at?: string;
          data_atividade?: string;
          distancia_km?: number | null;
          id?: string;
          observacoes?: string | null;
          ritmo_medio?: number | null;
          tempo_min?: number | null;
          tipo_cardio: Database["public"]["Enums"]["cardio_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          calorias?: number | null;
          created_at?: string;
          data_atividade?: string;
          distancia_km?: number | null;
          id?: string;
          observacoes?: string | null;
          ritmo_medio?: number | null;
          tempo_min?: number | null;
          tipo_cardio?: Database["public"]["Enums"]["cardio_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          gif_path: string | null;
          gif_sha256: string | null;
          musculo_principal_anatomico: string | null;
          classification_confidence: "alta" | "media" | "baixa" | null;
          catalog_deleted_at: string | null;
          equipamentos_pt_br: string[];
          partes_corpo_pt_br: string[];
          source: "user" | "eforge" | "exercisedb";
          external_id: string | null;
          name_original: string | null;
          name_pt_br: string | null;
          slug: string | null;
          descricao: string | null;
          equipamentos: string[];
          partes_corpo: string[];
          instrucoes: string[];
          instrucoes_pt_br: string[];
          dificuldade: string | null;
          musculos_primarios: string[];
          active: boolean;
          review_status: "approved" | "pending";
          classification_reviewed: boolean;
          unmapped_muscles: string[];
          external_data: Json;
          external_snapshot: Json;
          catalog_overrides: string[];
          last_synced_at: string | null;
          muscle_keys: string[];
          search_vector: unknown;
          categoria: Database["public"]["Enums"]["exercise_category"];
          created_at: string;
          gif_url: string | null;
          id: string;
          musculo_principal: string;
          musculos_secundarios: string[];
          musculos_terciarios: string[];
          visibility: string;
          nome: string;
          observacoes: string | null;
          tipo_controle: Database["public"]["Enums"]["exercise_control_type"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          gif_path?: string | null;
          gif_sha256?: string | null;
          musculo_principal_anatomico?: string | null;
          classification_confidence?: "alta" | "media" | "baixa" | null;
          catalog_deleted_at?: string | null;
          equipamentos_pt_br?: string[];
          partes_corpo_pt_br?: string[];
          source?: "user" | "eforge" | "exercisedb";
          external_id?: string | null;
          name_original?: string | null;
          name_pt_br?: string | null;
          slug?: string | null;
          descricao?: string | null;
          equipamentos?: string[];
          partes_corpo?: string[];
          instrucoes?: string[];
          instrucoes_pt_br?: string[];
          dificuldade?: string | null;
          musculos_primarios?: string[];
          active?: boolean;
          review_status?: "approved" | "pending";
          classification_reviewed?: boolean;
          unmapped_muscles?: string[];
          external_data?: Json;
          external_snapshot?: Json;
          catalog_overrides?: string[];
          last_synced_at?: string | null;
          categoria: Database["public"]["Enums"]["exercise_category"];
          created_at?: string;
          gif_url?: string | null;
          id?: string;
          musculo_principal: string;
          musculos_secundarios?: string[];
          musculos_terciarios?: string[];
          visibility?: string;
          nome: string;
          observacoes?: string | null;
          tipo_controle: Database["public"]["Enums"]["exercise_control_type"];
          updated_at?: string;
          user_id: string | null;
        };
        Update: {
          gif_path?: string | null;
          gif_sha256?: string | null;
          musculo_principal_anatomico?: string | null;
          classification_confidence?: "alta" | "media" | "baixa" | null;
          catalog_deleted_at?: string | null;
          equipamentos_pt_br?: string[];
          partes_corpo_pt_br?: string[];
          source?: "user" | "eforge" | "exercisedb";
          external_id?: string | null;
          name_original?: string | null;
          name_pt_br?: string | null;
          slug?: string | null;
          descricao?: string | null;
          equipamentos?: string[];
          partes_corpo?: string[];
          instrucoes?: string[];
          instrucoes_pt_br?: string[];
          dificuldade?: string | null;
          musculos_primarios?: string[];
          active?: boolean;
          review_status?: "approved" | "pending";
          classification_reviewed?: boolean;
          unmapped_muscles?: string[];
          external_data?: Json;
          external_snapshot?: Json;
          catalog_overrides?: string[];
          last_synced_at?: string | null;
          categoria?: Database["public"]["Enums"]["exercise_category"];
          created_at?: string;
          gif_url?: string | null;
          id?: string;
          musculo_principal?: string;
          musculos_secundarios?: string[];
          musculos_terciarios?: string[];
          visibility?: string;
          nome?: string;
          observacoes?: string | null;
          tipo_controle?: Database["public"]["Enums"]["exercise_control_type"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          created_at: string;
          id: string;
          prazo: string | null;
          status: Database["public"]["Enums"]["goal_status"];
          tipo_meta: Database["public"]["Enums"]["goal_type"];
          titulo: string;
          unidade: string;
          updated_at: string;
          user_id: string;
          valor_alvo: number;
          valor_atual: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          prazo?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          tipo_meta: Database["public"]["Enums"]["goal_type"];
          titulo: string;
          unidade?: string;
          updated_at?: string;
          user_id: string;
          valor_alvo: number;
          valor_atual?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          prazo?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          tipo_meta?: Database["public"]["Enums"]["goal_type"];
          titulo?: string;
          unidade?: string;
          updated_at?: string;
          user_id?: string;
          valor_alvo?: number;
          valor_atual?: number;
        };
        Relationships: [];
      };
      muscle_activity: {
        Row: {
          id: string;
          intensity: number;
          muscle: string;
          trained_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          intensity?: number;
          muscle: string;
          trained_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          intensity?: number;
          muscle?: string;
          trained_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          age: number | null;
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          display_name: string | null;
          height_cm: number | null;
          id: string;
          objetivo_fitness: Database["public"]["Enums"]["fitness_goal"] | null;
          sex: string | null;
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          age?: number | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string | null;
          height_cm?: number | null;
          id: string;
          objetivo_fitness?: Database["public"]["Enums"]["fitness_goal"] | null;
          sex?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          age?: number | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string | null;
          height_cm?: number | null;
          id?: string;
          objetivo_fitness?: Database["public"]["Enums"]["fitness_goal"] | null;
          sex?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      set_logs: {
        Row: {
          musculos_primarios: string[];
          carga_kg: number | null;
          concluida: boolean;
          created_at: string;
          exercise_id: string | null;
          id: string;
          kind: string;
          musculos_secundarios: string[];
          musculos_terciarios: string[];
          musculo_principal: string | null;
          nome_exercicio: string;
          repeticoes: number | null;
          serie_numero: number;
          session_id: string;
          user_id: string;
        };
        Insert: {
          musculos_primarios?: string[];
          carga_kg?: number | null;
          concluida?: boolean;
          created_at?: string;
          exercise_id?: string | null;
          id?: string;
          kind?: string;
          musculos_secundarios?: string[];
          musculos_terciarios?: string[];
          musculo_principal?: string | null;
          nome_exercicio: string;
          repeticoes?: number | null;
          serie_numero?: number;
          session_id: string;
          user_id: string;
        };
        Update: {
          musculos_primarios?: string[];
          carga_kg?: number | null;
          concluida?: boolean;
          created_at?: string;
          exercise_id?: string | null;
          id?: string;
          kind?: string;
          musculos_secundarios?: string[];
          musculos_terciarios?: string[];
          musculo_principal?: string | null;
          nome_exercicio?: string;
          repeticoes?: number | null;
          serie_numero?: number;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      workout_exercises: {
        Row: {
          carga_kg: number | null;
          created_at: string;
          descanso_seg: number;
          exercise_id: string;
          id: string;
          ordem: number;
          repeticoes: number;
          series: number;
          updated_at: string;
          user_id: string;
          workout_id: string;
        };
        Insert: {
          carga_kg?: number | null;
          created_at?: string;
          descanso_seg?: number;
          exercise_id: string;
          id?: string;
          ordem?: number;
          repeticoes?: number;
          series?: number;
          updated_at?: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          carga_kg?: number | null;
          created_at?: string;
          descanso_seg?: number;
          exercise_id?: string;
          id?: string;
          ordem?: number;
          repeticoes?: number;
          series?: number;
          updated_at?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sessions: {
        Row: {
          created_at: string;
          duracao_min: number | null;
          finalizado_em: string | null;
          id: string;
          iniciado_em: string;
          nome_treino: string;
          status: Database["public"]["Enums"]["session_status"];
          updated_at: string;
          user_id: string;
          volume_total: number;
          workout_id: string | null;
        };
        Insert: {
          created_at?: string;
          duracao_min?: number | null;
          finalizado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          nome_treino: string;
          status?: Database["public"]["Enums"]["session_status"];
          updated_at?: string;
          user_id: string;
          volume_total?: number;
          workout_id?: string | null;
        };
        Update: {
          created_at?: string;
          duracao_min?: number | null;
          finalizado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          nome_treino?: string;
          status?: Database["public"]["Enums"]["session_status"];
          updated_at?: string;
          user_id?: string;
          volume_total?: number;
          workout_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workouts: {
        Row: {
          created_at: string;
          descricao: string | null;
          id: string;
          nome: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_owned_exercise_active: { Args: { p_id: string; p_active: boolean }; Returns: undefined };
      inspect_owned_gif_assets: { Args: { p_entries: Json }; Returns: Json };
      import_owned_gif: { Args: { p_entry: Json; p_gif_url: string }; Returns: Json };
      owned_catalog_report: {
        Args: { p_hashes?: string[]; p_include_reviews?: boolean };
        Returns: Json;
      };
      activate_owned_gif_library: { Args: { p_hashes: string[] }; Returns: Json };
      admin_owned_catalog_page: {
        Args: {
          p_query?: string;
          p_body_part?: string | null;
          p_primary?: string | null;
          p_secondary?: string | null;
          p_equipment?: string | null;
          p_source?: string | null;
          p_visibility?: string | null;
          p_status?: string;
          p_page?: number;
          p_page_size?: number;
          p_ids_only?: boolean;
        };
        Returns: Json;
      };
      search_exercises_v2: {
        Args: {
          p_query?: string;
          p_muscles?: string[];
          p_equipment?: string | null;
          p_body_part?: string | null;
          p_category?: string | null;
          p_control?: string | null;
          p_source?: string | null;
          p_page?: number;
          p_page_size?: number;
          p_review?: boolean;
          p_primary?: string | null;
          p_secondary?: string | null;
          p_visibility?: string | null;
        };
        Returns: Json;
      };
      admin_catalog_page: {
        Args: {
          p_query?: string;
          p_body_part?: string | null;
          p_source?: string | null;
          p_status?: string;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: Json;
      };
      delete_catalog_exercises: { Args: { p_ids?: string[]; p_all?: boolean }; Returns: number };
      restore_catalog_exercise: { Args: { p_id: string }; Returns: undefined };
      begin_exercise_sync_filtered: {
        Args: { p_actor: string; p_body_parts?: string[] };
        Returns: Json;
      };
      begin_catalog_translation: {
        Args: { p_actor: string; p_ids?: string[]; p_all?: boolean };
        Returns: Json;
      };
      claim_catalog_translation: { Args: { p_run_id: string }; Returns: Json };
      apply_catalog_translation: {
        Args: { p_run_id: string; p_token: string; p_cursor: number; p_results: Json };
        Returns: Json;
      };
      release_catalog_translation: {
        Args: { p_run_id: string; p_token: string; p_error: string };
        Returns: undefined;
      };
      cancel_catalog_translation: { Args: { p_run_id: string }; Returns: undefined };

      search_exercises: {
        Args: {
          p_query?: string;
          p_muscles?: string[];
          p_equipment?: string | null;
          p_body_part?: string | null;
          p_category?: string | null;
          p_control?: string | null;
          p_source?: string | null;
          p_page?: number;
          p_page_size?: number;
          p_review?: boolean;
        };
        Returns: Json;
      };
      exercise_catalog_facets: { Args: Record<PropertyKey, never>; Returns: Json };
      add_exercise_to_workout: {
        Args: { p_workout_id: string; p_exercise_id: string };
        Returns: string;
      };
      is_catalog_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      begin_exercise_sync: { Args: { p_actor: string }; Returns: Json };
      claim_exercise_sync_page: { Args: { p_run_id: string }; Returns: Json };
      apply_exercise_sync_page: {
        Args: {
          p_run_id: string;
          p_token: string;
          p_cursor: string | null;
          p_next_cursor: string | null;
          p_has_next: boolean;
          p_total: number;
          p_received: number;
          p_records: Json;
          p_errors: Json;
        };
        Returns: Json;
      };
      release_exercise_sync_page: {
        Args: { p_run_id: string; p_token: string; p_error: string };
        Returns: undefined;
      };
      cancel_exercise_sync: { Args: { p_run_id: string }; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      cardio_type: "corrida" | "caminhada" | "bicicleta";
      exercise_category: "musculacao" | "cardio" | "funcional" | "alongamento";
      exercise_control_type: "peso_corporal" | "peso_kg" | "repeticoes" | "segundos" | "distancia";
      fitness_goal:
        | "perder_peso"
        | "ganhar_massa"
        | "manter_peso"
        | "condicionamento"
        | "hipertrofia"
        | "saude_geral";
      goal_status: "ativa" | "concluida" | "cancelada";
      goal_type:
        | "aumentar_carga"
        | "mais_repeticoes"
        | "treinos_semana"
        | "distancia_cardio"
        | "tempo_cardio"
        | "reduzir_peso"
        | "aumentar_peso"
        | "medidas_corporais";
      session_status: "em_andamento" | "concluida" | "cancelada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      cardio_type: ["corrida", "caminhada", "bicicleta"],
      exercise_category: ["musculacao", "cardio", "funcional", "alongamento"],
      exercise_control_type: ["peso_corporal", "peso_kg", "repeticoes", "segundos", "distancia"],
      fitness_goal: [
        "perder_peso",
        "ganhar_massa",
        "manter_peso",
        "condicionamento",
        "hipertrofia",
        "saude_geral",
      ],
      goal_status: ["ativa", "concluida", "cancelada"],
      goal_type: [
        "aumentar_carga",
        "mais_repeticoes",
        "treinos_semana",
        "distancia_cardio",
        "tempo_cardio",
        "reduzir_peso",
        "aumentar_peso",
        "medidas_corporais",
      ],
      session_status: ["em_andamento", "concluida", "cancelada"],
    },
  },
} as const;
