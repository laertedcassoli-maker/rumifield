import { useState, type MutableRefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Loader2, Save, ClipboardCheck } from "lucide-react";

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
  tem_equipamento_previsao_data: string | null;
  tem_quimico_previsao_data: string | null;
  pistolas_previsao_data: string | null;
  install_kit_previsao_data: string | null;
  mangueira_previsao_data: string | null;
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
  /** Data/hora da aprovação registrada automaticamente (somente leitura). */
  approvedAt?: string | null;
  /** Recebe a cada render os valores atuais do formulário (para aprovar sem salvar rascunho antes). */
  valuesRef?: MutableRefObject<AprovacaoCriterios | null>;
}

export default function AprovacaoPreInstalacaoForm({ stageId, criterios, canEdit, responsavelNome, approvedAt, valuesRef }: Props) {
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
  const [temEquipamentoPrev, setTemEquipamentoPrev] = useState<string>(criterios.tem_equipamento_previsao_data ?? '');
  const [temQuimicoPrev, setTemQuimicoPrev] = useState<string>(criterios.tem_quimico_previsao_data ?? '');
  const [pistolasEstoquePrev, setPistolasEstoquePrev] = useState<string>(criterios.pistolas_previsao_data ?? '');
  const [installKitEstoquePrev, setInstallKitEstoquePrev] = useState<string>(criterios.install_kit_previsao_data ?? '');
  const [mangueiraEstoquePrev, setMangueiraEstoquePrev] = useState<string>(criterios.mangueira_previsao_data ?? '');

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
    tem_equipamento_previsao_data: temEquipamento === 'nao' ? (temEquipamentoPrev || null) : null,
    tem_quimico_previsao_data: temQuimico === 'nao' ? (temQuimicoPrev || null) : null,
    pistolas_previsao_data: pistolasEstoque === 'nao' ? (pistolasEstoquePrev || null) : null,
    install_kit_previsao_data: installKitEstoque === 'nao' ? (installKitEstoquePrev || null) : null,
    mangueira_previsao_data: mangueiraEstoque === 'nao' ? (mangueiraEstoquePrev || null) : null,
  };
  if (valuesRef) valuesRef.current = atual;

  const saveMutation = useMutation({
    mutationFn: async () => {
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

  const TriToggle = ({
    value, onChange, label, previsao, onPrevisao,
  }: {
    value: string; onChange: (v: string) => void; label: string;
    previsao: string; onPrevisao: (v: string) => void;
  }) => (
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
      {value === 'nao' && (
        <div className="space-y-1 pt-1">
          <Label className="text-xs">Previsão</Label>
          <Input
            type="date"
            value={previsao}
            disabled={!canEdit}
            onChange={(e) => onPrevisao(e.target.value)}
            className="h-8 w-44"
          />
        </div>
      )}
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
        <TriToggle value={temEquipamento} onChange={setTemEquipamento} previsao={temEquipamentoPrev} onPrevisao={setTemEquipamentoPrev} label="Tem equipamento?" />
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do equipamento</Label>
          <Input
            value={nomeEquipamento}
            disabled={!canEdit}
            onChange={(e) => setNomeEquipamento(e.target.value)}
            placeholder="Ex.: RumiFlow 2000"
          />
        </div>

        <TriToggle value={temQuimico} onChange={setTemQuimico} previsao={temQuimicoPrev} onPrevisao={setTemQuimicoPrev} label="Tem químico?" />
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
        <TriToggle value={pistolasEstoque} onChange={setPistolasEstoque} previsao={pistolasEstoquePrev} onPrevisao={setPistolasEstoquePrev} label="Pistolas em estoque?" />

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
        <TriToggle value={installKitEstoque} onChange={setInstallKitEstoque} previsao={installKitEstoquePrev} onPrevisao={setInstallKitEstoquePrev} label="Install kit em estoque?" />

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
        <TriToggle value={mangueiraEstoque} onChange={setMangueiraEstoque} previsao={mangueiraEstoquePrev} onPrevisao={setMangueiraEstoquePrev} label="Mangueira em estoque?" />

      </div>

      <p className="text-xs text-muted-foreground">
        Data da aprovação:{' '}
        <strong>
          {approvedAt
            ? new Date(approvedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : 'Ainda não aprovada'}
        </strong>
      </p>


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
