import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Loader2, Save, ClipboardCheck, AlertTriangle } from "lucide-react";

export type TriState = 'sim' | 'nao' | 'na';

export interface AprovacaoCriterios {
  tem_equipamento: string | null;
  nome_equipamento: string | null;
  tem_quimico: string | null;
  qtd_pistolas: number | null;
  pistolas_em_estoque: string | null;
  qtd_install_kit: number | null;
  install_kit_em_estoque: string | null;
  qtd_mangueira_ft: number | null;
  mangueira_em_estoque: string | null;
}

const TRI_FIELDS: { key: keyof AprovacaoCriterios; label: string }[] = [
  { key: 'tem_equipamento', label: 'Tem equipamento?' },
  { key: 'tem_quimico', label: 'Tem químico?' },
  { key: 'pistolas_em_estoque', label: 'Pistolas em estoque?' },
  { key: 'install_kit_em_estoque', label: 'Install kit em estoque?' },
  { key: 'mangueira_em_estoque', label: 'Mangueira em estoque?' },
];

/** Todos os critérios sim/não/NA precisam estar em "Sim" ou "NA" para liberar a aprovação. */
export function criteriosPendentes(c: Partial<AprovacaoCriterios> | null | undefined): string[] {
  if (!c) return TRI_FIELDS.map(f => f.label);
  return TRI_FIELDS.filter(f => {
    const v = (c as any)[f.key];
    return v !== 'sim' && v !== 'na';
  }).map(f => f.label);
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface Props {
  stageId: string;
  criterios: AprovacaoCriterios;
  /** Quando false, exibe os dados em modo leitura (sem salvar). */
  canEdit: boolean;
  responsavelNome?: string | null;
}

export default function AprovacaoPreInstalacaoForm({ stageId, criterios, canEdit, responsavelNome }: Props) {
  const queryClient = useQueryClient();

  // Props são apenas valores iniciais — nunca sincronizados por useEffect
  const [temEquipamento, setTemEquipamento] = useState<string>(criterios.tem_equipamento ?? '');
  const [nomeEquipamento, setNomeEquipamento] = useState<string>(criterios.nome_equipamento ?? '');
  const [temQuimico, setTemQuimico] = useState<string>(criterios.tem_quimico ?? '');
  const [qtdPistolas, setQtdPistolas] = useState<string>(criterios.qtd_pistolas?.toString() ?? '');
  const [pistolasEstoque, setPistolasEstoque] = useState<string>(criterios.pistolas_em_estoque ?? '');
  const [qtdInstallKit, setQtdInstallKit] = useState<string>(criterios.qtd_install_kit?.toString() ?? '');
  const [installKitEstoque, setInstallKitEstoque] = useState<string>(criterios.install_kit_em_estoque ?? '');
  const [qtdMangueira, setQtdMangueira] = useState<string>(criterios.qtd_mangueira_ft?.toString() ?? '');
  const [mangueiraEstoque, setMangueiraEstoque] = useState<string>(criterios.mangueira_em_estoque ?? '');
  const [dataInicio, setDataInicio] = useState<string>(criterios.aprovacao_data_inicio ?? '');
  const [dataFim, setDataFim] = useState<string>(criterios.aprovacao_data_fim ?? '');

  const atual: AprovacaoCriterios = {
    tem_equipamento: temEquipamento || null,
    nome_equipamento: nomeEquipamento || null,
    tem_quimico: temQuimico || null,
    qtd_pistolas: toNumberOrNull(qtdPistolas),
    pistolas_em_estoque: pistolasEstoque || null,
    qtd_install_kit: toNumberOrNull(qtdInstallKit),
    install_kit_em_estoque: installKitEstoque || null,
    qtd_mangueira_ft: toNumberOrNull(qtdMangueira),
    mangueira_em_estoque: mangueiraEstoque || null,
    aprovacao_data_inicio: dataInicio || null,
    aprovacao_data_fim: dataFim || null,
  };

  const pendentes = criteriosPendentes(atual);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dataInicio && dataFim && dataFim < dataInicio) {
        throw new Error('A data final da janela de aprovação não pode ser anterior à inicial.');
      }
      const { data, error } = await Promise.race([
        (supabase as any).from('installation_stages').update(atual).eq('id', stageId).select('id'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo esgotado ao salvar. Verifique sua conexão.')), 15_000),
        ),
      ]) as { data: any[] | null; error: any };
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('O salvamento não foi confirmado pelo servidor. Verifique suas permissões.');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installation-stage', stageId] });
      queryClient.invalidateQueries({ queryKey: ['installations'] });
      toast.success('Critérios salvos!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar critérios: ' + (error?.message || ''));
    },
  });

  const TriToggle = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => canEdit && v && onChange(v)}
        className="justify-start"
        disabled={!canEdit}
      >
        <ToggleGroupItem value="sim" className="h-8 px-3 text-xs">Sim</ToggleGroupItem>
        <ToggleGroupItem value="nao" className="h-8 px-3 text-xs">Não</ToggleGroupItem>
        <ToggleGroupItem value="na" className="h-8 px-3 text-xs">NA</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  return (
    <div className="mt-3 space-y-4 rounded-lg border p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold">Critérios de aprovação</h2>
      </div>

      {responsavelNome && (
        <p className="text-xs text-muted-foreground">
          Técnico responsável pela instalação: <strong>{responsavelNome}</strong>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TriToggle value={temEquipamento} onChange={setTemEquipamento} label="Tem equipamento?" />
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do equipamento</Label>
          <Input
            value={nomeEquipamento}
            disabled={!canEdit}
            onChange={(e) => setNomeEquipamento(e.target.value)}
            placeholder="Ex.: RumiFlow 2000"
          />
        </div>

        <TriToggle value={temQuimico} onChange={setTemQuimico} label="Tem químico?" />
        <div />

        <div className="space-y-1.5">
          <Label className="text-xs">Quantidade de pistolas</Label>
          <Input
            type="number"
            min={0}
            value={qtdPistolas}
            disabled={!canEdit}
            onChange={(e) => setQtdPistolas(e.target.value)}
          />
        </div>
        <TriToggle value={pistolasEstoque} onChange={setPistolasEstoque} label="Pistolas em estoque?" />

        <div className="space-y-1.5">
          <Label className="text-xs">Quantidade de install kit</Label>
          <Input
            type="number"
            min={0}
            value={qtdInstallKit}
            disabled={!canEdit}
            onChange={(e) => setQtdInstallKit(e.target.value)}
          />
        </div>
        <TriToggle value={installKitEstoque} onChange={setInstallKitEstoque} label="Install kit em estoque?" />

        <div className="space-y-1.5">
          <Label className="text-xs">Metragem de mangueira (ft)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={qtdMangueira}
            disabled={!canEdit}
            onChange={(e) => setQtdMangueira(e.target.value)}
          />
        </div>
        <TriToggle value={mangueiraEstoque} onChange={setMangueiraEstoque} label="Mangueira em estoque?" />

        <div className="space-y-1.5">
          <Label className="text-xs">Início da janela de aprovação</Label>
          <Input type="date" value={dataInicio} disabled={!canEdit} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fim da janela de aprovação</Label>
          <Input type="date" value={dataFim} disabled={!canEdit} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Faltam para liberar a aprovação (precisam estar em "Sim" ou "NA"): <strong>{pendentes.join(', ')}</strong>
          </span>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Salvar rascunho
          </Button>
        </div>
      )}
    </div>
  );
}
