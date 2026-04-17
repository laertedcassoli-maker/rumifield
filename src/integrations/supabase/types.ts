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
      access_logs: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip: string | null
          reason: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          allows_quantity: boolean
          created_at: string
          execution_type: Database["public"]["Enums"]["execution_type"]
          has_motor: boolean
          id: string
          is_active: boolean
          name: string
          requires_unique_item: boolean
          updated_at: string
        }
        Insert: {
          allows_quantity?: boolean
          created_at?: string
          execution_type?: Database["public"]["Enums"]["execution_type"]
          has_motor?: boolean
          id?: string
          is_active?: boolean
          name: string
          requires_unique_item?: boolean
          updated_at?: string
        }
        Update: {
          allows_quantity?: boolean
          created_at?: string
          execution_type?: Database["public"]["Enums"]["execution_type"]
          has_motor?: boolean
          id?: string
          is_active?: boolean
          name?: string
          requires_unique_item?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      activity_products: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          is_default: boolean | null
          omie_product_id: string
          requires_meter_hours: boolean | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          omie_product_id: string
          requires_meter_hours?: boolean | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          omie_product_id?: string
          requires_meter_hours?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_products_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_products_omie_product_id_fkey"
            columns: ["omie_product_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_meter_readings: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          meter_type: Database["public"]["Enums"]["meter_type"]
          notes: string | null
          reading_unit: string
          reading_value: number
          user_id: string
          work_order_id: string | null
          workshop_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          meter_type?: Database["public"]["Enums"]["meter_type"]
          notes?: string | null
          reading_unit?: string
          reading_value: number
          user_id: string
          work_order_id?: string | null
          workshop_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          meter_type?: Database["public"]["Enums"]["meter_type"]
          notes?: string | null
          reading_unit?: string
          reading_value?: number
          user_id?: string
          work_order_id?: string | null
          workshop_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_meter_readings_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_meter_readings_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      authorized_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          nome: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      checklist_action_parts: {
        Row: {
          action_id: string
          created_at: string
          default_quantity: number
          id: string
          part_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          default_quantity?: number
          id?: string
          part_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          default_quantity?: number
          id?: string
          part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_action_parts_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_action_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_corrective_actions: {
        Row: {
          action_label: string
          active: boolean
          created_at: string
          id: string
          item_id: string
          order_index: number
        }
        Insert: {
          action_label: string
          active?: boolean
          created_at?: string
          id?: string
          item_id: string
          order_index?: number
        }
        Update: {
          action_label?: string
          active?: boolean
          created_at?: string
          id?: string
          item_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_corrective_actions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_nonconformities: {
        Row: {
          active: boolean
          created_at: string
          id: string
          item_id: string
          nonconformity_label: string
          order_index: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          item_id: string
          nonconformity_label: string
          order_index?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          item_id?: string
          nonconformity_label?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_nonconformities_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_nonconformity_parts: {
        Row: {
          created_at: string
          default_quantity: number
          id: string
          nonconformity_id: string
          part_id: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          id?: string
          nonconformity_id: string
          part_id: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          id?: string
          nonconformity_id?: string
          part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_nonconformity_parts_nonconformity_id_fkey"
            columns: ["nonconformity_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_nonconformities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_nonconformity_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_blocks: {
        Row: {
          block_name: string
          created_at: string
          id: string
          order_index: number
          template_id: string
        }
        Insert: {
          block_name: string
          created_at?: string
          id?: string
          order_index?: number
          template_id: string
        }
        Update: {
          block_name?: string
          created_at?: string
          id?: string
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          active: boolean
          block_id: string
          created_at: string
          id: string
          item_name: string
          order_index: number
        }
        Insert: {
          active?: boolean
          block_id: string
          created_at?: string
          id?: string
          item_name: string
          order_index?: number
        }
        Update: {
          active?: boolean
          block_id?: string
          created_at?: string
          id?: string
          item_name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cidade: string | null
          cod_imilk: string | null
          consultor_rplus_id: string | null
          created_at: string
          data_ativacao_rumiflow: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          fazenda: string | null
          id: string
          latitude: number | null
          link_maps: string | null
          longitude: number | null
          modelo_contrato: string | null
          nome: string
          observacoes: string | null
          omie_codigo: string | null
          ordenhas_dia: number | null
          preventive_frequency_days: number | null
          quantidade_pistolas: number | null
          status: string
          telefone: string | null
          tipo_painel: string | null
          tipo_pistola_id: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cod_imilk?: string | null
          consultor_rplus_id?: string | null
          created_at?: string
          data_ativacao_rumiflow?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fazenda?: string | null
          id?: string
          latitude?: number | null
          link_maps?: string | null
          longitude?: number | null
          modelo_contrato?: string | null
          nome: string
          observacoes?: string | null
          omie_codigo?: string | null
          ordenhas_dia?: number | null
          preventive_frequency_days?: number | null
          quantidade_pistolas?: number | null
          status?: string
          telefone?: string | null
          tipo_painel?: string | null
          tipo_pistola_id?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cod_imilk?: string | null
          consultor_rplus_id?: string | null
          created_at?: string
          data_ativacao_rumiflow?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          fazenda?: string | null
          id?: string
          latitude?: number | null
          link_maps?: string | null
          longitude?: number | null
          modelo_contrato?: string | null
          nome?: string
          observacoes?: string | null
          omie_codigo?: string | null
          ordenhas_dia?: number | null
          preventive_frequency_days?: number | null
          quantidade_pistolas?: number | null
          status?: string
          telefone?: string | null
          tipo_painel?: string | null
          tipo_pistola_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_consultor_rplus_id_fkey"
            columns: ["consultor_rplus_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_tipo_pistola_id_fkey"
            columns: ["tipo_pistola_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      corrective_maintenance: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          checklist_template_id: string | null
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lon: number | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          public_token: string | null
          status: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checklist_template_id?: string | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          public_token?: string | null
          status?: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checklist_template_id?: string | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          public_token?: string | null
          status?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_maintenance_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "corrective_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_maintenance_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "ticket_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_actions: {
        Row: {
          client_id: string
          client_product_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          owner_user_id: string
          priority: number
          status: Database["public"]["Enums"]["action_status"]
          title: string
          type: Database["public"]["Enums"]["action_type"]
        }
        Insert: {
          client_id: string
          client_product_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          owner_user_id: string
          priority?: number
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          type?: Database["public"]["Enums"]["action_type"]
        }
        Update: {
          client_id?: string
          client_product_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          owner_user_id?: string
          priority?: number
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          type?: Database["public"]["Enums"]["action_type"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "crm_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_actions_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "crm_client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_checklist_rules: {
        Row: {
          checklist_template_id: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          product_code: Database["public"]["Enums"]["product_code"]
        }
        Insert: {
          checklist_template_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_code: Database["public"]["Enums"]["product_code"]
        }
        Update: {
          checklist_template_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_code?: Database["public"]["Enums"]["product_code"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_checklist_rules_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_product_qualification_answers: {
        Row: {
          answer_boolean: boolean | null
          answer_choice: string | null
          answer_date: string | null
          answer_number: number | null
          answer_text: string | null
          client_product_id: string
          id: string
          item_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          answer_boolean?: boolean | null
          answer_choice?: string | null
          answer_date?: string | null
          answer_number?: number | null
          answer_text?: string | null
          client_product_id: string
          id?: string
          item_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          answer_boolean?: boolean | null
          answer_choice?: string | null
          answer_date?: string | null
          answer_number?: number | null
          answer_text?: string | null
          client_product_id?: string
          id?: string
          item_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_product_qualification_answers_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "crm_client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_product_qualification_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "crm_product_qualification_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_product_snapshots: {
        Row: {
          client_id: string
          data: Json
          health_reasons: Json
          health_status: string | null
          id: string
          product_code: Database["public"]["Enums"]["product_code"]
          snapshot_at: string
        }
        Insert: {
          client_id: string
          data?: Json
          health_reasons?: Json
          health_status?: string | null
          id?: string
          product_code: Database["public"]["Enums"]["product_code"]
          snapshot_at?: string
        }
        Update: {
          client_id?: string
          data?: Json
          health_reasons?: Json
          health_status?: string | null
          id?: string
          product_code?: Database["public"]["Enums"]["product_code"]
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_product_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "crm_client_product_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_products: {
        Row: {
          client_id: string
          created_at: string
          id: string
          loss_notes: string | null
          loss_reason_id: string | null
          notes: string | null
          owner_user_id: string
          probability: number | null
          product_code: Database["public"]["Enums"]["product_code"]
          stage: Database["public"]["Enums"]["crm_stage"]
          stage_updated_at: string
          value_estimated: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason_id?: string | null
          notes?: string | null
          owner_user_id: string
          probability?: number | null
          product_code: Database["public"]["Enums"]["product_code"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          stage_updated_at?: string
          value_estimated?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason_id?: string | null
          notes?: string | null
          owner_user_id?: string
          probability?: number | null
          product_code?: Database["public"]["Enums"]["product_code"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          stage_updated_at?: string
          value_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "crm_client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_products_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "crm_loss_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loss_reasons: {
        Row: {
          id: string
          is_active: boolean
          product_code: Database["public"]["Enums"]["product_code"]
          reason: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          product_code: Database["public"]["Enums"]["product_code"]
          reason: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          product_code?: Database["public"]["Enums"]["product_code"]
          reason?: string
          sort_order?: number
        }
        Relationships: []
      }
      crm_metric_definitions: {
        Row: {
          group_name: string | null
          id: string
          is_active: boolean
          label: string
          metric_key: string
          priority: number
          product_code: Database["public"]["Enums"]["product_code"]
          unit: string | null
          value_type: string
        }
        Insert: {
          group_name?: string | null
          id?: string
          is_active?: boolean
          label: string
          metric_key: string
          priority?: number
          product_code: Database["public"]["Enums"]["product_code"]
          unit?: string | null
          value_type?: string
        }
        Update: {
          group_name?: string | null
          id?: string
          is_active?: boolean
          label?: string
          metric_key?: string
          priority?: number
          product_code?: Database["public"]["Enums"]["product_code"]
          unit?: string | null
          value_type?: string
        }
        Relationships: []
      }
      crm_opportunity_notes: {
        Row: {
          client_product_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_product_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_product_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunity_notes_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "crm_client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunity_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_product_qualification_items: {
        Row: {
          answer_type: string
          choice_options: string[] | null
          id: string
          is_required: boolean
          question: string
          sort_order: number
          template_id: string
        }
        Insert: {
          answer_type?: string
          choice_options?: string[] | null
          id?: string
          is_required?: boolean
          question: string
          sort_order?: number
          template_id: string
        }
        Update: {
          answer_type?: string
          choice_options?: string[] | null
          id?: string
          is_required?: boolean
          question?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_product_qualification_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_product_qualification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_product_qualification_templates: {
        Row: {
          id: string
          is_active: boolean
          name: string
          product_code: Database["public"]["Enums"]["product_code"]
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          product_code: Database["public"]["Enums"]["product_code"]
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          product_code?: Database["public"]["Enums"]["product_code"]
        }
        Relationships: []
      }
      crm_proposals: {
        Row: {
          client_product_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          proposed_value: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          valid_until: string | null
        }
        Insert: {
          client_product_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          proposed_value?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          valid_until?: string | null
        }
        Update: {
          client_product_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          proposed_value?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposals_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "crm_client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_visit_audios: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          product_code: string
          status: string
          storage_path: string | null
          summary: string[] | null
          transcription: string | null
          user_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          product_code: string
          status?: string
          storage_path?: string | null
          summary?: string[] | null
          transcription?: string | null
          user_id: string
          visit_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          product_code?: string
          status?: string
          storage_path?: string | null
          summary?: string[] | null
          transcription?: string | null
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_visit_audios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visit_audios_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "crm_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_visit_checklists: {
        Row: {
          checklist_template_id: string
          completed_at: string | null
          created_at: string
          id: string
          origin: string
          product_code: Database["public"]["Enums"]["product_code"] | null
          started_at: string | null
          status: Database["public"]["Enums"]["checklist_execution_status"]
          visit_id: string
        }
        Insert: {
          checklist_template_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          origin?: string
          product_code?: Database["public"]["Enums"]["product_code"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          visit_id: string
        }
        Update: {
          checklist_template_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          origin?: string
          product_code?: Database["public"]["Enums"]["product_code"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_visit_checklists_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visit_checklists_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "crm_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_visit_product_snapshots: {
        Row: {
          client_product_id: string
          created_at: string
          id: string
          loss_notes: string | null
          loss_reason_id: string | null
          probability: number | null
          product_code: Database["public"]["Enums"]["product_code"]
          stage: Database["public"]["Enums"]["crm_stage"]
          value_estimated: number | null
          visit_id: string
        }
        Insert: {
          client_product_id: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason_id?: string | null
          probability?: number | null
          product_code: Database["public"]["Enums"]["product_code"]
          stage: Database["public"]["Enums"]["crm_stage"]
          value_estimated?: number | null
          visit_id: string
        }
        Update: {
          client_product_id?: string
          created_at?: string
          id?: string
          loss_notes?: string | null
          loss_reason_id?: string | null
          probability?: number | null
          product_code?: Database["public"]["Enums"]["product_code"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          value_estimated?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_visit_product_snapshots_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "crm_client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visit_product_snapshots_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "crm_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visit_product_snapshots_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "crm_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_visits: {
        Row: {
          cancellation_reason: string | null
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lon: number | null
          client_id: string
          created_at: string
          id: string
          objective: string | null
          owner_user_id: string
          planned_end_at: string | null
          planned_start_at: string | null
          route_id: string | null
          status: Database["public"]["Enums"]["crm_visit_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id: string
          created_at?: string
          id?: string
          objective?: string | null
          owner_user_id: string
          planned_end_at?: string | null
          planned_start_at?: string | null
          route_id?: string | null
          status?: Database["public"]["Enums"]["crm_visit_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id?: string
          created_at?: string
          id?: string
          objective?: string | null
          owner_user_id?: string
          planned_end_at?: string | null
          planned_start_at?: string | null
          route_id?: string | null
          status?: Database["public"]["Enums"]["crm_visit_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "crm_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visits_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_visits_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "preventive_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_chat_history: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          source_doc_ids: string[] | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          source_doc_ids?: string[] | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          source_doc_ids?: string[] | null
          user_id?: string
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
          galoes: number
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
          galoes?: number
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
          galoes?: number
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
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
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
          vacas_lactacao: number | null
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
          vacas_lactacao?: number | null
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
          vacas_lactacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
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
      motor_replacement_history: {
        Row: {
          created_at: string
          id: string
          motor_hours_used: number
          new_motor_code: string | null
          notes: string | null
          old_motor_code: string | null
          replaced_at: string
          replaced_at_meter_hours: number
          user_id: string
          warranty_batch_id: string | null
          work_order_id: string | null
          workshop_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motor_hours_used: number
          new_motor_code?: string | null
          notes?: string | null
          old_motor_code?: string | null
          replaced_at?: string
          replaced_at_meter_hours: number
          user_id: string
          warranty_batch_id?: string | null
          work_order_id?: string | null
          workshop_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motor_hours_used?: number
          new_motor_code?: string | null
          notes?: string | null
          old_motor_code?: string | null
          replaced_at?: string
          replaced_at_meter_hours?: number
          user_id?: string
          warranty_batch_id?: string | null
          work_order_id?: string | null
          workshop_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motor_replacement_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motor_replacement_history_warranty_batch_id_fkey"
            columns: ["warranty_batch_id"]
            isOneToOne: false
            referencedRelation: "warranty_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motor_replacement_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motor_replacement_history_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
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
          familia: string | null
          id: string
          imagem_url: string | null
          is_asset: boolean
          nome: string
          omie_codigo: string | null
          quantidade_estoque: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string
          descricao?: string | null
          familia?: string | null
          id?: string
          imagem_url?: string | null
          is_asset?: boolean
          nome: string
          omie_codigo?: string | null
          quantidade_estoque?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string
          descricao?: string | null
          familia?: string | null
          id?: string
          imagem_url?: string | null
          is_asset?: boolean
          nome?: string
          omie_codigo?: string | null
          quantidade_estoque?: number | null
        }
        Relationships: []
      }
      pedido_item_assets: {
        Row: {
          created_at: string
          id: string
          pedido_item_id: string
          workshop_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_item_id: string
          workshop_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pedido_item_id?: string
          workshop_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_assets_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_assets_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_item_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_quantity: number | null
          old_quantity: number | null
          peca_codigo: string | null
          peca_id: string | null
          peca_nome: string | null
          pedido_id: string
          pedido_item_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          peca_codigo?: string | null
          peca_id?: string | null
          peca_nome?: string | null
          pedido_id: string
          pedido_item_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          peca_codigo?: string | null
          peca_id?: string | null
          peca_nome?: string | null
          pedido_id?: string
          pedido_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_log_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_log_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_item_log_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          asset_codes: string[] | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          peca_id: string
          pedido_id: string
          quantidade: number
          workshop_item_id: string | null
        }
        Insert: {
          asset_codes?: string[] | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          peca_id: string
          pedido_id: string
          quantidade?: number
          workshop_item_id?: string | null
        }
        Update: {
          asset_codes?: string[] | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          peca_id?: string
          pedido_id?: string
          quantidade?: number
          workshop_item_id?: string | null
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
          {
            foreignKeyName: "pedido_itens_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
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
          omie_nf_numero_2: string | null
          omie_pedido_id: string | null
          origem: string | null
          pedido_code: string | null
          preventive_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["pedido_status"]
          tipo_envio: string | null
          tipo_logistica: string | null
          updated_at: string
          urgencia: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          omie_data_faturamento?: string | null
          omie_nf_numero?: string | null
          omie_nf_numero_2?: string | null
          omie_pedido_id?: string | null
          origem?: string | null
          pedido_code?: string | null
          preventive_id?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["pedido_status"]
          tipo_envio?: string | null
          tipo_logistica?: string | null
          updated_at?: string
          urgencia?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          omie_data_faturamento?: string | null
          omie_nf_numero?: string | null
          omie_nf_numero_2?: string | null
          omie_pedido_id?: string | null
          origem?: string | null
          pedido_code?: string | null
          preventive_id?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["pedido_status"]
          tipo_envio?: string | null
          tipo_logistica?: string | null
          updated_at?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_preventive_id_fkey"
            columns: ["preventive_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_checklist_blocks: {
        Row: {
          block_name_snapshot: string
          checklist_id: string
          created_at: string
          id: string
          order_index: number
          template_block_id: string | null
        }
        Insert: {
          block_name_snapshot: string
          checklist_id: string
          created_at?: string
          id?: string
          order_index?: number
          template_block_id?: string | null
        }
        Update: {
          block_name_snapshot?: string
          checklist_id?: string
          created_at?: string
          id?: string
          order_index?: number
          template_block_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_checklist_blocks_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_checklist_blocks_template_block_id_fkey"
            columns: ["template_block_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_checklist_item_actions: {
        Row: {
          action_label_snapshot: string
          created_at: string
          exec_item_id: string
          id: string
          selected_at: string
          template_action_id: string | null
        }
        Insert: {
          action_label_snapshot: string
          created_at?: string
          exec_item_id: string
          id?: string
          selected_at?: string
          template_action_id?: string | null
        }
        Update: {
          action_label_snapshot?: string
          created_at?: string
          exec_item_id?: string
          id?: string
          selected_at?: string
          template_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_checklist_item_actions_exec_item_id_fkey"
            columns: ["exec_item_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_checklist_item_actions_template_action_id_fkey"
            columns: ["template_action_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_corrective_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_checklist_item_nonconformities: {
        Row: {
          created_at: string
          exec_item_id: string
          id: string
          nonconformity_label_snapshot: string
          selected_at: string
          template_nonconformity_id: string | null
        }
        Insert: {
          created_at?: string
          exec_item_id: string
          id?: string
          nonconformity_label_snapshot: string
          selected_at?: string
          template_nonconformity_id?: string | null
        }
        Update: {
          created_at?: string
          exec_item_id?: string
          id?: string
          nonconformity_label_snapshot?: string
          selected_at?: string
          template_nonconformity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_checklist_item_noncon_template_nonconformity_id_fkey"
            columns: ["template_nonconformity_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_nonconformities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_checklist_item_nonconformities_exec_item_id_fkey"
            columns: ["exec_item_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_checklist_items: {
        Row: {
          answered_at: string | null
          created_at: string
          exec_block_id: string
          id: string
          item_name_snapshot: string
          notes: string | null
          order_index: number
          status: Database["public"]["Enums"]["checklist_item_status"] | null
          template_item_id: string | null
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          exec_block_id: string
          id?: string
          item_name_snapshot: string
          notes?: string | null
          order_index?: number
          status?: Database["public"]["Enums"]["checklist_item_status"] | null
          template_item_id?: string | null
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          exec_block_id?: string
          id?: string
          item_name_snapshot?: string
          notes?: string | null
          order_index?: number
          status?: Database["public"]["Enums"]["checklist_item_status"] | null
          template_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_checklist_items_exec_block_id_fkey"
            columns: ["exec_block_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklist_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_checklists: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          preventive_id: string
          started_at: string
          status: Database["public"]["Enums"]["checklist_execution_status"]
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          preventive_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          template_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          preventive_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_checklists_preventive_id_fkey"
            columns: ["preventive_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_maintenance: {
        Row: {
          client_id: string
          completed_date: string | null
          created_at: string
          id: string
          internal_notes: string | null
          notes: string | null
          public_notes: string | null
          public_token: string | null
          route_id: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["preventive_maintenance_status"]
          technician_user_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_date?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_notes?: string | null
          public_token?: string | null
          route_id?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["preventive_maintenance_status"]
          technician_user_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_date?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_notes?: string | null
          public_token?: string | null
          route_id?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["preventive_maintenance_status"]
          technician_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "preventive_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "preventive_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_part_consumption: {
        Row: {
          asset_unique_code: string | null
          consumed_at: string
          created_at: string
          exec_item_id: string | null
          exec_nonconformity_id: string | null
          id: string
          is_manual: boolean | null
          notes: string | null
          part_code_snapshot: string
          part_id: string
          part_name_snapshot: string
          preventive_id: string
          quantity: number
          stock_source: string | null
          unit_cost_snapshot: number | null
        }
        Insert: {
          asset_unique_code?: string | null
          consumed_at?: string
          created_at?: string
          exec_item_id?: string | null
          exec_nonconformity_id?: string | null
          id?: string
          is_manual?: boolean | null
          notes?: string | null
          part_code_snapshot: string
          part_id: string
          part_name_snapshot: string
          preventive_id: string
          quantity?: number
          stock_source?: string | null
          unit_cost_snapshot?: number | null
        }
        Update: {
          asset_unique_code?: string | null
          consumed_at?: string
          created_at?: string
          exec_item_id?: string | null
          exec_nonconformity_id?: string | null
          id?: string
          is_manual?: boolean | null
          notes?: string | null
          part_code_snapshot?: string
          part_id?: string
          part_name_snapshot?: string
          preventive_id?: string
          quantity?: number
          stock_source?: string | null
          unit_cost_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_part_consumption_exec_item_id_fkey"
            columns: ["exec_item_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_part_consumption_exec_nonconformity_id_fkey"
            columns: ["exec_nonconformity_id"]
            isOneToOne: false
            referencedRelation: "preventive_checklist_item_nonconformities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_part_consumption_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_part_consumption_preventive_id_fkey"
            columns: ["preventive_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_route_items: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          client_id: string
          created_at: string
          id: string
          order_index: number | null
          planned_date: string | null
          route_id: string
          status: Database["public"]["Enums"]["preventive_route_item_status"]
          suggested_reason: string | null
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          client_id: string
          created_at?: string
          id?: string
          order_index?: number | null
          planned_date?: string | null
          route_id: string
          status?: Database["public"]["Enums"]["preventive_route_item_status"]
          suggested_reason?: string | null
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          client_id?: string
          created_at?: string
          id?: string
          order_index?: number | null
          planned_date?: string | null
          route_id?: string
          status?: Database["public"]["Enums"]["preventive_route_item_status"]
          suggested_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_route_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "preventive_route_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_route_items_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "preventive_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_routes: {
        Row: {
          checklist_template_id: string | null
          created_at: string
          created_by_user_id: string
          end_date: string
          field_technician_user_id: string
          id: string
          notes: string | null
          route_code: string
          start_date: string
          status: Database["public"]["Enums"]["preventive_route_status"]
          updated_at: string
        }
        Insert: {
          checklist_template_id?: string | null
          created_at?: string
          created_by_user_id: string
          end_date: string
          field_technician_user_id: string
          id?: string
          notes?: string | null
          route_code: string
          start_date: string
          status?: Database["public"]["Enums"]["preventive_route_status"]
          updated_at?: string
        }
        Update: {
          checklist_template_id?: string | null
          created_at?: string
          created_by_user_id?: string
          end_date?: string
          field_technician_user_id?: string
          id?: string
          notes?: string | null
          route_code?: string
          start_date?: string
          status?: Database["public"]["Enums"]["preventive_route_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_routes_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_visit_media: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          preventive_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          preventive_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          preventive_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_visit_media_preventive_id_fkey"
            columns: ["preventive_id"]
            isOneToOne: false
            referencedRelation: "preventive_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      product_health_indicators: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          produto_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          produto_id: string
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          produto_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_health_indicators_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          badge_color: string | null
          cod_imilk: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          product_code: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          badge_color?: string | null
          cod_imilk?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          product_code?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          badge_color?: string | null
          cod_imilk?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          product_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      produtos_quimicos: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          id: string
          litros_por_vaca_2x: number | null
          litros_por_vaca_3x: number | null
          litros_por_vaca_mes: number | null
          nome: string
          unidade: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          litros_por_vaca_2x?: number | null
          litros_por_vaca_3x?: number | null
          litros_por_vaca_mes?: number | null
          nome: string
          unidade?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          litros_por_vaca_2x?: number | null
          litros_por_vaca_3x?: number | null
          litros_por_vaca_mes?: number | null
          nome?: string
          unidade?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cidade_base: string | null
          cidade_base_lat: number | null
          cidade_base_lon: number | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cidade_base?: string | null
          cidade_base_lat?: number | null
          cidade_base_lon?: number | null
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cidade_base?: string | null
          cidade_base_lat?: number | null
          cidade_base_lon?: number | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_menu_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          menu_group: string
          menu_key: string
          menu_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_group?: string
          menu_key: string
          menu_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_group?: string
          menu_key?: string
          menu_label?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      system_documentation: {
        Row: {
          ai_metadata: Json | null
          category: Database["public"]["Enums"]["doc_category"]
          content: string
          created_at: string
          id: string
          is_public: boolean
          related_modules: string[] | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_metadata?: Json | null
          category: Database["public"]["Enums"]["doc_category"]
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean
          related_modules?: string[] | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_metadata?: Json | null
          category?: Database["public"]["Enums"]["doc_category"]
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean
          related_modules?: string[] | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      technical_tickets: {
        Row: {
          assigned_technician_id: string | null
          category_id: string | null
          client_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          products: string[] | null
          resolution_summary: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          substatus: string | null
          ticket_code: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_technician_id?: string | null
          category_id?: string | null
          client_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          products?: string[] | null
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          substatus?: string | null
          ticket_code: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_technician_id?: string | null
          category_id?: string | null
          client_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          products?: string[] | null
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          substatus?: string | null
          ticket_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "technical_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "tecnico_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      ticket_parts_requests: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          ticket_id: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          ticket_id: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          ticket_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_parts_requests_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_parts_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "technical_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_parts_requests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "ticket_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tag_links: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "ticket_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tag_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "technical_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      ticket_timeline: {
        Row: {
          created_at: string
          event_description: string
          event_type: string
          id: string
          interaction_type: string | null
          metadata: Json | null
          notes: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_description: string
          event_type: string
          id?: string
          interaction_type?: string | null
          metadata?: Json | null
          notes?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_description?: string
          event_type?: string
          id?: string
          interaction_type?: string | null
          metadata?: Json | null
          notes?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_timeline_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "technical_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_visit_actions: {
        Row: {
          action_description: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          order_index: number
          visit_id: string
        }
        Insert: {
          action_description: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          visit_id: string
        }
        Update: {
          action_description?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_visit_actions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "ticket_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_visits: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lon: number | null
          checklist_template_id: string | null
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lon: number | null
          client_id: string
          created_at: string
          field_technician_user_id: string
          id: string
          internal_notes: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          public_notes: string | null
          result: Database["public"]["Enums"]["visit_result"] | null
          status: Database["public"]["Enums"]["ticket_visit_status"]
          ticket_id: string
          updated_at: string
          visit_code: string | null
          visit_summary: string | null
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checklist_template_id?: string | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id: string
          created_at?: string
          field_technician_user_id: string
          id?: string
          internal_notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          public_notes?: string | null
          result?: Database["public"]["Enums"]["visit_result"] | null
          status?: Database["public"]["Enums"]["ticket_visit_status"]
          ticket_id: string
          updated_at?: string
          visit_code?: string | null
          visit_summary?: string | null
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lon?: number | null
          checklist_template_id?: string | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lon?: number | null
          client_id?: string
          created_at?: string
          field_technician_user_id?: string
          id?: string
          internal_notes?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          public_notes?: string | null
          result?: Database["public"]["Enums"]["visit_result"] | null
          status?: Database["public"]["Enums"]["ticket_visit_status"]
          ticket_id?: string
          updated_at?: string
          visit_code?: string | null
          visit_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_visits_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ticket_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_visits_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "technical_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          cidade_base: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
        }
        Insert: {
          cidade_base?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          nome: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
        }
        Update: {
          cidade_base?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "visitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by_user_id: string
          finalized_at: string | null
          id: string
          notes: string | null
          status: string
          supplier_invoice: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by_user_id: string
          finalized_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          supplier_invoice?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by_user_id?: string
          finalized_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          supplier_invoice?: string | null
        }
        Relationships: []
      }
      warranty_requests: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          hours_used: number
          id: string
          invoice_number: string | null
          motor_code: string
          motor_replacement_history_id: string | null
          replacement_date: string
          status: string
          updated_at: string
          work_order_id: string | null
          workshop_item_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          hours_used: number
          id?: string
          invoice_number?: string | null
          motor_code: string
          motor_replacement_history_id?: string | null
          replacement_date: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
          workshop_item_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          hours_used?: number
          id?: string
          invoice_number?: string | null
          motor_code?: string
          motor_replacement_history_id?: string | null
          replacement_date?: string
          status?: string
          updated_at?: string
          work_order_id?: string | null
          workshop_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_requests_motor_replacement_history_id_fkey"
            columns: ["motor_replacement_history_id"]
            isOneToOne: false
            referencedRelation: "motor_replacement_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_requests_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_items: {
        Row: {
          created_at: string
          id: string
          meter_hours_entry: number | null
          meter_hours_exit: number | null
          notes: string | null
          omie_product_id: string | null
          quantity: number
          status: string | null
          work_order_id: string
          workshop_item_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meter_hours_entry?: number | null
          meter_hours_exit?: number | null
          notes?: string | null
          omie_product_id?: string | null
          quantity?: number
          status?: string | null
          work_order_id: string
          workshop_item_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meter_hours_entry?: number | null
          meter_hours_exit?: number | null
          notes?: string | null
          omie_product_id?: string | null
          quantity?: number
          status?: string | null
          work_order_id?: string
          workshop_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_omie_product_id_fkey"
            columns: ["omie_product_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_workshop_item_id_fkey"
            columns: ["workshop_item_id"]
            isOneToOne: false
            referencedRelation: "workshop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_parts_used: {
        Row: {
          added_by_user_id: string
          created_at: string
          id: string
          motor_code_installed: string | null
          motor_code_removed: string | null
          notes: string | null
          omie_product_id: string
          quantity: number
          work_order_id: string
        }
        Insert: {
          added_by_user_id: string
          created_at?: string
          id?: string
          motor_code_installed?: string | null
          motor_code_removed?: string | null
          notes?: string | null
          omie_product_id: string
          quantity?: number
          work_order_id: string
        }
        Update: {
          added_by_user_id?: string
          created_at?: string
          id?: string
          motor_code_installed?: string | null
          motor_code_removed?: string | null
          notes?: string | null
          omie_product_id?: string
          quantity?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_parts_used_omie_product_id_fkey"
            columns: ["omie_product_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parts_used_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["time_entry_status"]
          user_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          user_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          activity_id: string
          assigned_to_user_id: string | null
          cliente_id: string | null
          code: string
          created_at: string
          created_by_user_id: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          total_time_seconds: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          assigned_to_user_id?: string | null
          cliente_id?: string | null
          code: string
          created_at?: string
          created_by_user_id: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          total_time_seconds?: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          assigned_to_user_id?: string | null
          cliente_id?: string | null
          code?: string
          created_at?: string
          created_by_user_id?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          total_time_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "client_preventive_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "work_orders_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_items: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          creation_source: string
          current_motor_code: string | null
          id: string
          meter_hours_last: number | null
          meter_hours_updated_at: string | null
          motor_replaced_at_meter_hours: number | null
          notes: string | null
          omie_product_id: string
          status: string | null
          unique_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          creation_source?: string
          current_motor_code?: string | null
          id?: string
          meter_hours_last?: number | null
          meter_hours_updated_at?: string | null
          motor_replaced_at_meter_hours?: number | null
          notes?: string | null
          omie_product_id: string
          status?: string | null
          unique_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          creation_source?: string
          current_motor_code?: string | null
          id?: string
          meter_hours_last?: number | null
          meter_hours_updated_at?: string | null
          motor_replaced_at_meter_hours?: number | null
          notes?: string | null
          omie_product_id?: string
          status?: string | null
          unique_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_items_omie_product_id_fkey"
            columns: ["omie_product_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_preventive_overview: {
        Row: {
          client_id: string | null
          client_name: string | null
          consultor_rplus_id: string | null
          days_since_last: number | null
          days_until_due: number | null
          fazenda: string | null
          last_preventive_date: string | null
          preventive_frequency_days: number | null
          preventive_status: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          consultor_rplus_id?: string | null
          days_since_last?: never
          days_until_due?: never
          fazenda?: string | null
          last_preventive_date?: never
          preventive_frequency_days?: number | null
          preventive_status?: never
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          consultor_rplus_id?: string | null
          days_since_last?: never
          days_until_due?: never
          fazenda?: string | null
          last_preventive_date?: never
          preventive_frequency_days?: number | null
          preventive_status?: never
        }
        Relationships: [
          {
            foreignKeyName: "clientes_consultor_rplus_id_fkey"
            columns: ["consultor_rplus_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: {
          _cidade_base?: string
          _invite_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      can_delete_peca: { Args: { _peca_id: string }; Returns: boolean }
      duplicate_checklist_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      generate_corrective_visit_code: { Args: never; Returns: string }
      generate_preventive_route_code: { Args: never; Returns: string }
      generate_ticket_code: { Args: never; Returns: string }
      generate_warranty_batch_number: { Args: never; Returns: string }
      generate_work_order_code: { Args: never; Returns: string }
      get_client_preventive_status: {
        Args: { p_client_id: string; p_frequency_days: number }
        Returns: {
          days_since_last: number
          days_until_due: number
          last_preventive_date: string
          preventive_status: string
        }[]
      }
      get_schema_tables: {
        Args: never
        Returns: {
          column_count: number
          has_rls: boolean
          policy_count: number
          table_name: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin_or_coordinator: { Args: { _user_id: string }; Returns: boolean }
      is_crm_client_owner: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      reorder_checklist_blocks: {
        Args: { p_ordered_ids: string[]; p_template_id: string }
        Returns: undefined
      }
      reorder_checklist_items: {
        Args: { p_block_id: string; p_ordered_ids: string[] }
        Returns: undefined
      }
      validate_rumina_login: {
        Args: { p_email: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      action_status: "aberta" | "em_execucao" | "concluida"
      action_type: "tarefa" | "pendencia" | "oportunidade"
      app_role:
        | "admin"
        | "coordenador_rplus"
        | "consultor_rplus"
        | "coordenador_servicos"
        | "tecnico_campo"
        | "tecnico_oficina"
        | "coordenador_logistica"
      checklist_execution_status: "em_andamento" | "concluido"
      checklist_item_status: "S" | "N" | "NA"
      crm_stage:
        | "nao_qualificado"
        | "qualificado"
        | "em_negociacao"
        | "ganho"
        | "perdido"
      crm_visit_status: "planejada" | "em_andamento" | "concluida" | "cancelada"
      doc_category:
        | "visao_geral"
        | "modulo"
        | "regra_transversal"
        | "permissao"
        | "tabela"
      execution_type: "UNIVOCA" | "LOTE"
      meter_type: "horimetro"
      pedido_status:
        | "rascunho"
        | "solicitado"
        | "processamento"
        | "faturado"
        | "enviado"
        | "entregue"
      preventive_maintenance_status: "planejada" | "concluida" | "cancelada"
      preventive_route_item_status:
        | "planejado"
        | "executado"
        | "reagendado"
        | "cancelado"
      preventive_route_status:
        | "em_elaboracao"
        | "planejada"
        | "em_execucao"
        | "finalizada"
      product_code:
        | "ideagri"
        | "rumiflow"
        | "onfarm"
        | "rumiaction"
        | "insights"
      proposal_status: "ativa" | "expirada" | "aceita" | "recusada"
      ticket_priority: "baixa" | "media" | "alta" | "urgente"
      ticket_status:
        | "aberto"
        | "em_atendimento"
        | "aguardando_peca"
        | "resolvido"
        | "cancelado"
      ticket_visit_status:
        | "em_elaboracao"
        | "planejada"
        | "em_execucao"
        | "finalizada"
        | "cancelada"
      time_entry_status: "running" | "paused" | "finished"
      visit_result: "resolvido" | "parcial" | "aguardando_peca"
      work_order_status: "aguardando" | "em_manutencao" | "concluido"
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
      action_status: ["aberta", "em_execucao", "concluida"],
      action_type: ["tarefa", "pendencia", "oportunidade"],
      app_role: [
        "admin",
        "coordenador_rplus",
        "consultor_rplus",
        "coordenador_servicos",
        "tecnico_campo",
        "tecnico_oficina",
        "coordenador_logistica",
      ],
      checklist_execution_status: ["em_andamento", "concluido"],
      checklist_item_status: ["S", "N", "NA"],
      crm_stage: [
        "nao_qualificado",
        "qualificado",
        "em_negociacao",
        "ganho",
        "perdido",
      ],
      crm_visit_status: ["planejada", "em_andamento", "concluida", "cancelada"],
      doc_category: [
        "visao_geral",
        "modulo",
        "regra_transversal",
        "permissao",
        "tabela",
      ],
      execution_type: ["UNIVOCA", "LOTE"],
      meter_type: ["horimetro"],
      pedido_status: [
        "rascunho",
        "solicitado",
        "processamento",
        "faturado",
        "enviado",
        "entregue",
      ],
      preventive_maintenance_status: ["planejada", "concluida", "cancelada"],
      preventive_route_item_status: [
        "planejado",
        "executado",
        "reagendado",
        "cancelado",
      ],
      preventive_route_status: [
        "em_elaboracao",
        "planejada",
        "em_execucao",
        "finalizada",
      ],
      product_code: ["ideagri", "rumiflow", "onfarm", "rumiaction", "insights"],
      proposal_status: ["ativa", "expirada", "aceita", "recusada"],
      ticket_priority: ["baixa", "media", "alta", "urgente"],
      ticket_status: [
        "aberto",
        "em_atendimento",
        "aguardando_peca",
        "resolvido",
        "cancelado",
      ],
      ticket_visit_status: [
        "em_elaboracao",
        "planejada",
        "em_execucao",
        "finalizada",
        "cancelada",
      ],
      time_entry_status: ["running", "paused", "finished"],
      visit_result: ["resolvido", "parcial", "aguardando_peca"],
      work_order_status: ["aguardando", "em_manutencao", "concluido"],
    },
  },
} as const
