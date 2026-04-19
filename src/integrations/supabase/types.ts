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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address: string
          cnpj: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          cnpj: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          cnpj?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string
          bank_account: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_pix_key: string | null
          company_id: string
          cpf: string
          created_at: string
          department: string | null
          department_id: string | null
          id: string
          is_active: boolean
          is_monthly: boolean
          is_on_leave: boolean
          job_role_id: string | null
          name: string
          notes: string | null
          registration: string | null
          role: string | null
          updated_at: string
          work_card_number: string | null
        }
        Insert: {
          admission_date: string
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          company_id: string
          cpf: string
          created_at?: string
          department?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_monthly?: boolean
          is_on_leave?: boolean
          job_role_id?: string | null
          name: string
          notes?: string | null
          registration?: string | null
          role?: string | null
          updated_at?: string
          work_card_number?: string | null
        }
        Update: {
          admission_date?: string
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_pix_key?: string | null
          company_id?: string
          cpf?: string
          created_at?: string
          department?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_monthly?: boolean
          is_on_leave?: boolean
          job_role_id?: string | null
          name?: string
          notes?: string | null
          registration?: string | null
          role?: string | null
          updated_at?: string
          work_card_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          base_salary: number
          company_id: string
          created_at: string
          deductions_total: number
          deductions: Json
          earnings: Json
          earnings_total: number
          employee_id: string
          id: string
          inss_amount: number
          month: number
          net_salary: number
          notes: string | null
          payroll_batch_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          base_salary?: number
          company_id: string
          created_at?: string
          deductions_total?: number
          deductions?: Json
          earnings?: Json
          earnings_total?: number
          employee_id: string
          id?: string
          inss_amount?: number
          month: number
          net_salary?: number
          notes?: string | null
          payroll_batch_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          base_salary?: number
          company_id?: string
          created_at?: string
          deductions_total?: number
          deductions?: Json
          earnings?: Json
          earnings_total?: number
          employee_id?: string
          id?: string
          inss_amount?: number
          month?: number
          net_salary?: number
          notes?: string | null
          payroll_batch_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_payroll_batch_id_fkey"
            columns: ["payroll_batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_batches: {
        Row: {
          company_id: string
          created_at: string
          id: string
          month: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          month: number
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          month?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      rubrica_formula_items: {
        Row: {
          created_at: string
          id: string
          item_order: number
          operation: string
          rubrica_id: string
          source_rubrica_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_order: number
          operation: string
          rubrica_id: string
          source_rubrica_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_order?: number
          operation?: string
          rubrica_id?: string
          source_rubrica_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubrica_formula_items_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubrica_formula_items_source_rubrica_id_fkey"
            columns: ["source_rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      rubricas: {
        Row: {
          allow_manual_override: boolean
          calculation_method:
            | Database["public"]["Enums"]["rubric_method"]
            | null
          category: string
          classification:
            | Database["public"]["Enums"]["rubric_classification"]
            | null
          code: string
          created_at: string
          display_order: number
          entry_mode: string
          fixed_value: number | null
          id: string
          is_active: boolean
          name: string
          nature: Database["public"]["Enums"]["rubric_nature"] | null
          percentage_base_rubrica_id: string | null
          percentage_value: number | null
          type: string
          updated_at: string
        }
        Insert: {
          allow_manual_override?: boolean
          calculation_method?:
            | Database["public"]["Enums"]["rubric_method"]
            | null
          category: string
          classification?:
            | Database["public"]["Enums"]["rubric_classification"]
            | null
          code: string
          created_at?: string
          display_order?: number
          entry_mode: string
          fixed_value?: number | null
          id?: string
          is_active?: boolean
          name: string
          nature?: Database["public"]["Enums"]["rubric_nature"] | null
          percentage_base_rubrica_id?: string | null
          percentage_value?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          allow_manual_override?: boolean
          calculation_method?:
            | Database["public"]["Enums"]["rubric_method"]
            | null
          category?: string
          classification?:
            | Database["public"]["Enums"]["rubric_classification"]
            | null
          code?: string
          created_at?: string
          display_order?: number
          entry_mode?: string
          fixed_value?: number | null
          id?: string
          is_active?: boolean
          name?: string
          nature?: Database["public"]["Enums"]["rubric_nature"] | null
          percentage_base_rubrica_id?: string | null
          percentage_value?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_percentage_base_rubrica_id_fkey"
            columns: ["percentage_base_rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_payroll_batch: {
        Args: { p_batch_id: string }
        Returns: Database["public"]["Tables"]["payroll_entries"]["Row"][]
      }
    }
    Enums: {
      app_permission:
        | "empresas.view"
        | "funcionarios.view"
        | "estrutura.view"
        | "rubricas.manage"
        | "folha.operar"
        | "relatorios.view"
        | "usuarios.manage"
        | "configuracoes.manage"
      app_role: "admin" | "operacional" | "consulta"
      rubric_classification:
        | "salario_ctps"
        | "salario_g"
        | "outros_rendimentos"
        | "horas_extras"
        | "salario_familia"
        | "ferias_terco"
        | "insalubridade"
        | "inss"
        | "emprestimos"
        | "adiantamentos"
        | "vales"
        | "faltas"
      rubric_method: "manual" | "valor_fixo" | "percentual" | "formula"
      rubric_nature: "base" | "calculada"
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
    Enums: {
      app_permission: [
        "empresas.view",
        "funcionarios.view",
        "estrutura.view",
        "rubricas.manage",
        "folha.operar",
        "relatorios.view",
        "usuarios.manage",
        "configuracoes.manage",
      ],
      app_role: ["admin", "operacional", "consulta"],
      rubric_classification: [
        "salario_ctps",
        "salario_g",
        "outros_rendimentos",
        "horas_extras",
        "salario_familia",
        "ferias_terco",
        "insalubridade",
        "inss",
        "emprestimos",
        "adiantamentos",
        "vales",
        "faltas",
      ],
      rubric_method: ["manual", "valor_fixo", "percentual", "formula"],
      rubric_nature: ["base", "calculada"],
    },
  },
} as const
