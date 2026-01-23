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
      activities: {
        Row: {
          allows_quantity: boolean
          created_at: string
          execution_type: Database["public"]["Enums"]["execution_type"]
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
          nome?: string
          omie_codigo?: string | null
          quantidade_estoque?: number | null
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
        ]
      }
      preventive_part_consumption: {
        Row: {
          consumed_at: string
          created_at: string
          exec_item_id: string
          exec_nonconformity_id: string
          id: string
          part_code_snapshot: string
          part_id: string
          part_name_snapshot: string
          preventive_id: string
          quantity: number
          unit_cost_snapshot: number | null
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          exec_item_id: string
          exec_nonconformity_id: string
          id?: string
          part_code_snapshot: string
          part_id: string
          part_name_snapshot: string
          preventive_id: string
          quantity?: number
          unit_cost_snapshot?: number | null
        }
        Update: {
          consumed_at?: string
          created_at?: string
          exec_item_id?: string
          exec_nonconformity_id?: string
          id?: string
          part_code_snapshot?: string
          part_id?: string
          part_name_snapshot?: string
          preventive_id?: string
          quantity?: number
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
      can_delete_peca: { Args: { _peca_id: string }; Returns: boolean }
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
      is_admin_or_coordinator: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador_rplus"
        | "consultor_rplus"
        | "coordenador_servicos"
        | "tecnico_campo"
        | "tecnico_oficina"
      checklist_execution_status: "em_andamento" | "concluido"
      checklist_item_status: "S" | "N" | "NA"
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
      time_entry_status: "running" | "paused" | "finished"
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
      app_role: [
        "admin",
        "coordenador_rplus",
        "consultor_rplus",
        "coordenador_servicos",
        "tecnico_campo",
        "tecnico_oficina",
      ],
      checklist_execution_status: ["em_andamento", "concluido"],
      checklist_item_status: ["S", "N", "NA"],
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
      time_entry_status: ["running", "paused", "finished"],
      work_order_status: ["aguardando", "em_manutencao", "concluido"],
    },
  },
} as const
