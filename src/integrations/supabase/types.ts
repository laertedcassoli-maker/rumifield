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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          cidade: string | null
          cod_imilk: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          fazenda: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cod_imilk?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fazenda?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cod_imilk?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fazenda?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      envios_log: {
        Row: {
          campo_alterado: string
          created_at: string
          envio_id: string
          id: string
          usuario_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado: string
          created_at?: string
          envio_id: string
          id?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string
          created_at?: string
          envio_id?: string
          id?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envios_log_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      envios_produtos: {
        Row: {
          cliente_id: string
          created_at: string
          data_envio: string
          id: string
          observacoes: string | null
          produto_id: string
          quantidade: number
          registrado_por: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_envio?: string
          id?: string
          observacoes?: string | null
          produto_id: string
          quantidade?: number
          registrado_por?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_envio?: string
          id?: string
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envios_produtos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_quimicos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_cliente: {
        Row: {
          atualizado_por: string | null
          cliente_id: string
          data_afericao: string
          data_atualizacao: string
          galoes_cheios: number
          id: string
          nivel_galao_parcial: number | null
          observacoes: string | null
          produto_id: string
          quantidade: number
          responsavel: string
        }
        Insert: {
          atualizado_por?: string | null
          cliente_id: string
          data_afericao?: string
          data_atualizacao?: string
          galoes_cheios?: number
          id?: string
          nivel_galao_parcial?: number | null
          observacoes?: string | null
          produto_id: string
          quantidade?: number
          responsavel?: string
        }
        Update: {
          atualizado_por?: string | null
          cliente_id?: string
          data_afericao?: string
          data_atualizacao?: string
          galoes_cheios?: number
          id?: string
          nivel_galao_parcial?: number | null
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          responsavel?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_cliente_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_quimicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pecas: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          omie_codigo: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          omie_codigo?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          omie_codigo?: string | null
        }
        Relationships: []
      }
      pedido_itens: {
        Row: {
          created_at: string
          id: string
          peca_id: string
          pedido_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          peca_id: string
          pedido_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          peca_id?: string
          pedido_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          observacoes: string | null
          omie_data_faturamento: string | null
          omie_nf_numero: string | null
          omie_pedido_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["pedido_status"]
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          omie_data_faturamento?: string | null
          omie_nf_numero?: string | null
          omie_pedido_id?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          omie_data_faturamento?: string | null
          omie_nf_numero?: string | null
          omie_pedido_id?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_quimicos: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          unidade: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          unidade?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          unidade?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tecnico_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          tecnico_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          tecnico_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          tecnico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tecnico_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      visita_midias: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          tipo: string
          url: string | null
          visita_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          tipo: string
          url?: string | null
          visita_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          tipo?: string
          url?: string | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_midias_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          cliente_id: string
          created_at: string
          data_visita: string
          descricao: string | null
          id: string
          latitude: number | null
          longitude: number | null
          sincronizado: boolean | null
          tecnico_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_visita?: string
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          sincronizado?: boolean | null
          tecnico_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_visita?: string
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          sincronizado?: boolean | null
          tecnico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "tecnico"
      pedido_status:
        | "solicitado"
        | "processamento"
        | "faturado"
        | "enviado"
        | "entregue"
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
      app_role: ["admin", "gestor", "tecnico"],
      pedido_status: [
        "solicitado",
        "processamento",
        "faturado",
        "enviado",
        "entregue",
      ],
    },
  },
} as const
