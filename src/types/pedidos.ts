export interface PedidoItem {
  id: string;
  pedido_id: string;
  peca_id: string;
  quantidade: number;
  workshop_item_id?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  asset_codes?: string[] | null;
  created_at: string;
  pecas?: { nome: string; codigo: string; familia?: string | null; is_asset?: boolean; imagem_url?: string | null };
  workshop_items?: { id: string; unique_code: string } | null;
  // Alias used in UI
  workshop_item?: { id: string; unique_code: string } | null;
  // Multiple assets from junction table
  pedido_item_assets?: PedidoItemAsset[];
}

export interface PedidoItemAsset {
  id: string;
  pedido_item_id: string;
  workshop_item_id: string;
  created_at: string;
  workshop_items?: { id: string; unique_code: string } | null;
}

export interface PedidoComItens {
  id: string;
  solicitante_id: string;
  cliente_id: string;
  status: string;
  observacoes?: string | null;
  omie_pedido_id?: string | null;
  omie_nf_numero?: string | null;
  omie_data_faturamento?: string | null;
  origem?: string | null;
  tipo_envio?: string | null;
  tipo_logistica?: string | null;
  urgencia?: string;
  pedido_code?: string | null;
  preventive_id?: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string; fazenda?: string | null; consultor_rplus_id?: string | null };
  pedido_itens?: PedidoItem[];
  solicitante?: { nome: string; email: string } | null;
}
