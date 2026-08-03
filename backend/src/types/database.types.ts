export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      crop_images: {
        Row: {
          confidence: number | null
          crop_instance_id: string | null
          crop_state_id: string | null
          disease_class: string | null
          health_status: string | null
          id: string
          image_url: string | null
          original_bytes: number | null
          r2_key: string | null
          stored_bytes: number | null
          treatment_recommended: string | null
          uploaded_at: string | null
        }
        Insert: {
          confidence?: number | null
          crop_instance_id?: string | null
          crop_state_id?: string | null
          disease_class?: string | null
          health_status?: string | null
          id?: string
          image_url?: string | null
          original_bytes?: number | null
          r2_key?: string | null
          stored_bytes?: number | null
          treatment_recommended?: string | null
          uploaded_at?: string | null
        }
        Update: {
          confidence?: number | null
          crop_instance_id?: string | null
          crop_state_id?: string | null
          disease_class?: string | null
          health_status?: string | null
          id?: string
          image_url?: string | null
          original_bytes?: number | null
          r2_key?: string | null
          stored_bytes?: number | null
          treatment_recommended?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_images_crop_instance_id_fkey"
            columns: ["crop_instance_id"]
            isOneToOne: false
            referencedRelation: "crop_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_images_crop_state_id_fkey"
            columns: ["crop_state_id"]
            isOneToOne: false
            referencedRelation: "crop_states"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_instances: {
        Row: {
          created_at: string | null
          crop_type: string
          field_id: string | null
          id: string
          irrigation_method: string | null
          sowing_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          crop_type: string
          field_id?: string | null
          id?: string
          irrigation_method?: string | null
          sowing_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          crop_type?: string
          field_id?: string | null
          id?: string
          irrigation_method?: string | null
          sowing_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_instances_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_states: {
        Row: {
          confidence: number | null
          confidence_score: number | null
          created_at: string | null
          crop_instance_id: string | null
          day_number: number
          disease_risk: number | null
          health_score: number | null
          id: string
          notes: string | null
          nutrient_stress: boolean | null
          phase: string
          recorded_date: string | null
          source: string | null
          stale_days: number | null
          status: string | null
          stress_factors: Json | null
          water_stress: boolean | null
        }
        Insert: {
          confidence?: number | null
          confidence_score?: number | null
          created_at?: string | null
          crop_instance_id?: string | null
          day_number: number
          disease_risk?: number | null
          health_score?: number | null
          id?: string
          notes?: string | null
          nutrient_stress?: boolean | null
          phase: string
          recorded_date?: string | null
          source?: string | null
          stale_days?: number | null
          status?: string | null
          stress_factors?: Json | null
          water_stress?: boolean | null
        }
        Update: {
          confidence?: number | null
          confidence_score?: number | null
          created_at?: string | null
          crop_instance_id?: string | null
          day_number?: number
          disease_risk?: number | null
          health_score?: number | null
          id?: string
          notes?: string | null
          nutrient_stress?: boolean | null
          phase?: string
          recorded_date?: string | null
          source?: string | null
          stale_days?: number | null
          status?: string | null
          stress_factors?: Json | null
          water_stress?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_states_crop_instance_id_fkey"
            columns: ["crop_instance_id"]
            isOneToOne: false
            referencedRelation: "crop_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_checkins: {
        Row: {
          answer: string | null
          asked_at: string
          created_at: string | null
          crop_instance_id: string
          id: string
          model_correction: Json | null
          question_key: string
          question_text: string
          responded_at: string | null
        }
        Insert: {
          answer?: string | null
          asked_at?: string
          created_at?: string | null
          crop_instance_id: string
          id?: string
          model_correction?: Json | null
          question_key: string
          question_text: string
          responded_at?: string | null
        }
        Update: {
          answer?: string | null
          asked_at?: string
          created_at?: string | null
          crop_instance_id?: string
          id?: string
          model_correction?: Json | null
          question_key?: string
          question_text?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_checkins_crop_instance_id_fkey"
            columns: ["crop_instance_id"]
            isOneToOne: false
            referencedRelation: "crop_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      fertilizer_actions: {
        Row: {
          action_date: string
          created_at: string | null
          crop_instance_id: string | null
          fertilizer_type: string
          id: string
          quantity: number
        }
        Insert: {
          action_date: string
          created_at?: string | null
          crop_instance_id?: string | null
          fertilizer_type: string
          id?: string
          quantity: number
        }
        Update: {
          action_date?: string
          created_at?: string | null
          crop_instance_id?: string | null
          fertilizer_type?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "fertilizer_actions_crop_instance_id_fkey"
            columns: ["crop_instance_id"]
            isOneToOne: false
            referencedRelation: "crop_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          area: number | null
          area_source: string | null
          area_sqm: number | null
          boundary: Json | null
          created_at: string | null
          id: string
          latitude: number
          location_name: string
          longitude: number
          soil_type: string
          user_id: string | null
        }
        Insert: {
          area?: number | null
          area_source?: string | null
          area_sqm?: number | null
          boundary?: Json | null
          created_at?: string | null
          id?: string
          latitude: number
          location_name: string
          longitude: number
          soil_type: string
          user_id?: string | null
        }
        Update: {
          area?: number | null
          area_source?: string | null
          area_sqm?: number | null
          boundary?: Json | null
          created_at?: string | null
          id?: string
          latitude?: number
          location_name?: string
          longitude?: number
          soil_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      irrigation_actions: {
        Row: {
          action_date: string
          amount: number
          created_at: string | null
          crop_instance_id: string | null
          id: string
        }
        Insert: {
          action_date: string
          amount: number
          created_at?: string | null
          crop_instance_id?: string | null
          id?: string
        }
        Update: {
          action_date?: string
          amount?: number
          created_at?: string | null
          crop_instance_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_actions_crop_instance_id_fkey"
            columns: ["crop_instance_id"]
            isOneToOne: false
            referencedRelation: "crop_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_observations: {
        Row: {
          backscatter_vh_db: number | null
          backscatter_vv_db: number | null
          cloud_cover_pct: number | null
          created_at: string | null
          field_id: string
          id: string
          likely_flooded: boolean | null
          ndvi: number | null
          ndwi: number | null
          observed_date: string
          source: string
          usable: boolean
        }
        Insert: {
          backscatter_vh_db?: number | null
          backscatter_vv_db?: number | null
          cloud_cover_pct?: number | null
          created_at?: string | null
          field_id: string
          id?: string
          likely_flooded?: boolean | null
          ndvi?: number | null
          ndwi?: number | null
          observed_date: string
          source: string
          usable?: boolean
        }
        Update: {
          backscatter_vh_db?: number | null
          backscatter_vv_db?: number | null
          cloud_cover_pct?: number | null
          created_at?: string | null
          field_id?: string
          id?: string
          likely_flooded?: boolean | null
          ndvi?: number | null
          ndwi?: number | null
          observed_date?: string
          source?: string
          usable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "satellite_observations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
