import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import { HomeRedirect } from "./components/HomeRedirect";
import Visitas from "./pages/Visitas";
import Estoque from "./pages/Estoque";
import Consumo from "./pages/estoque/Consumo";
import Previsao from "./pages/estoque/Previsao";
import Historico from "./pages/estoque/Historico";
import Pedidos from "./pages/Pedidos";
import AdminClientes from "./pages/admin/Clientes";
import AdminEnvios from "./pages/admin/Envios";
import AdminUsuarios from "./pages/admin/Usuarios";
import AdminConfig from "./pages/admin/Config";
import AdminPermissoes from "./pages/admin/Permissoes";
import OficinaAtividades from "./pages/oficina/Atividades";
import OficinaItens from "./pages/oficina/ItensOficina";
import OficinaOS from "./pages/oficina/OrdensServico";
import OficinaGarantias from "./pages/oficina/Garantias";
import PreventivasIndex from "./pages/preventivas/Index";
import PreventivasRotas from "./pages/preventivas/Rotas";
import PreventivasNovaRota from "./pages/preventivas/NovaRota";
import PreventivasDetalheRota from "./pages/preventivas/DetalheRota";
import PreventivasMinhasRotas from "./pages/preventivas/MinhasRotas";
import PreventivasExecucaoRota from "./pages/preventivas/ExecucaoRota";
import PreventivasAtendimento from "./pages/preventivas/AtendimentoPreventivo";
import PreventivasCalendario from "./pages/preventivas/Calendario";
import PreventivasChecklists from "./pages/preventivas/Checklists";
import PreventivasChecklistEditor from "./pages/preventivas/ChecklistEditor";
import Teste from "./pages/Teste";
import Instalar from "./pages/Instalar";
import Nfc from "./pages/Nfc";
import NotFound from "./pages/NotFound";
import RelatorioPreventivo from "./pages/preventivas/RelatorioPreventivo";
import ChamadosIndex from "./pages/chamados/Index";
import NovoChamado from "./pages/chamados/NovoChamado";
import DetalheChamado from "./pages/chamados/DetalheChamado";
import ExecucaoVisitaCorretiva from "./pages/chamados/ExecucaoVisitaCorretiva";
import RelatorioCorretivo from "./pages/chamados/RelatorioCorretivo";
import DocsIndex from "./pages/docs/Index";
import DocView from "./pages/docs/DocView";
import DocEditor from "./pages/docs/DocEditor";
import DocChat from "./pages/docs/DocChat";
import PublicDocs from "./pages/docs/PublicDocs";
import ClientesList from "./pages/crm/ClientesList";
// ClienteDetail removed — redirected to CrmCliente360
import CrmCarteira from "./pages/crm/CrmCarteira";
import CrmCliente360 from "./pages/crm/CrmCliente360";
import CrmPipeline from "./pages/crm/CrmPipeline";
import CrmVisitas from "./pages/crm/CrmVisitas";
import CrmVisitaExecucao from "./pages/crm/CrmVisitaExecucao";
import AdminCrmConfig from "./pages/admin/CrmConfig";
import AdminCrmMetricas from "./pages/admin/CrmMetricas";
import AceitarConvite from "./pages/AceitarConvite";
import CrmAcoes from "./pages/crm/CrmAcoes";
import CrmDashboard from "./pages/crm/CrmDashboard";

const ClienteRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/crm/${id}`} replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/convite/:token" element={<AceitarConvite />} />
            <Route
              path="/"
              element={
                <AppLayout>
                  <HomeRedirect />
                </AppLayout>
              }
            />
            <Route
              path="/visitas"
              element={
                <AppLayout>
                  <Visitas />
                </AppLayout>
              }
            />
            <Route
              path="/estoque"
              element={
                <AppLayout>
                  <Estoque />
                </AppLayout>
              }
            />
            <Route
              path="/estoque/consumo"
              element={
                <AppLayout>
                  <Consumo />
                </AppLayout>
              }
            />
            <Route
              path="/estoque/previsao"
              element={
                <AppLayout>
                  <Previsao />
                </AppLayout>
              }
            />
            <Route
              path="/estoque/historico"
              element={
                <AppLayout>
                  <Historico />
                </AppLayout>
              }
            />
            <Route
              path="/pedidos"
              element={
                <AppLayout>
                  <Pedidos />
                </AppLayout>
              }
            />
            <Route
              path="/admin/clientes"
              element={
                <AppLayout>
                  <AdminClientes />
                </AppLayout>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <AppLayout>
                  <AdminUsuarios />
                </AppLayout>
              }
            />
            <Route
              path="/admin/config"
              element={
                <AppLayout>
                  <AdminConfig />
                </AppLayout>
              }
            />
            <Route
              path="/admin/envios"
              element={
                <AppLayout>
                  <AdminEnvios />
                </AppLayout>
              }
            />
            <Route
              path="/admin/permissoes"
              element={
                <AppLayout>
                  <AdminPermissoes />
                </AppLayout>
              }
            />
            <Route
              path="/oficina/atividades"
              element={
                <AppLayout>
                  <OficinaAtividades />
                </AppLayout>
              }
            />
            <Route
              path="/oficina/itens"
              element={
                <AppLayout>
                  <OficinaItens />
                </AppLayout>
              }
            />
            <Route
              path="/oficina/os"
              element={
                <AppLayout>
                  <OficinaOS />
                </AppLayout>
              }
            />
            <Route
              path="/oficina/garantias"
              element={
                <AppLayout>
                  <OficinaGarantias />
                </AppLayout>
              }
            />
            <Route
              path="/teste"
              element={
                <AppLayout>
                  <Teste />
                </AppLayout>
              }
            />
            <Route path="/instalar" element={<Instalar />} />
            <Route
              path="/nfc"
              element={
                <AppLayout>
                  <Nfc />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas"
              element={
                <AppLayout>
                  <PreventivasIndex />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/rotas"
              element={
                <AppLayout>
                  <PreventivasRotas />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/rotas/nova"
              element={
                <AppLayout>
                  <PreventivasNovaRota />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/rotas/:id"
              element={
                <AppLayout>
                  <PreventivasDetalheRota />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/calendario"
              element={
                <AppLayout>
                  <PreventivasCalendario />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/minhas-rotas"
              element={
                <AppLayout>
                  <PreventivasMinhasRotas />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/execucao/:id"
              element={
                <AppLayout>
                  <PreventivasExecucaoRota />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/execucao/:routeId/atendimento/:itemId"
              element={
                <AppLayout>
                  <PreventivasAtendimento />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/checklists"
              element={
                <AppLayout>
                  <PreventivasChecklists />
                </AppLayout>
              }
            />
            <Route
              path="/preventivas/checklists/:id"
              element={
                <AppLayout>
                  <PreventivasChecklistEditor />
                </AppLayout>
              }
            />
            {/* Public report routes - no auth required */}
            <Route path="/relatorio/:token" element={<RelatorioPreventivo />} />
            <Route path="/relatorio/:token/:type" element={<RelatorioPreventivo />} />
            <Route path="/relatorio-corretivo/:token" element={<RelatorioCorretivo />} />
            <Route path="/relatorio-corretivo/:token/:type" element={<RelatorioCorretivo />} />
            <Route path="/docs/public" element={<PublicDocs />} />
            
            {/* CRM - Clientes */}
            <Route
              path="/clientes"
              element={<Navigate to="/crm/carteira" replace />}
            />
            <Route
              path="/clientes/:id"
              element={<ClienteRedirect />}
            />
            <Route
              path="/crm/dashboard"
              element={
                <AppLayout>
                  <CrmDashboard />
                </AppLayout>
              }
            />
            <Route
              path="/crm/carteira"
              element={
                <AppLayout>
                  <CrmCarteira />
                </AppLayout>
              }
            />
            <Route
              path="/crm/:id"
              element={
                <AppLayout>
                  <CrmCliente360 />
                </AppLayout>
              }
            />
            <Route
              path="/crm/pipeline"
              element={
                <AppLayout>
                  <CrmPipeline />
                </AppLayout>
              }
            />
            <Route
              path="/crm/acoes"
              element={
                <AppLayout>
                  <CrmAcoes />
                </AppLayout>
              }
            />
            <Route
              path="/crm/visitas"
              element={
                <AppLayout>
                  <CrmVisitas />
                </AppLayout>
              }
            />
            <Route
              path="/crm/visitas/:id"
              element={
                <AppLayout>
                  <CrmVisitaExecucao />
                </AppLayout>
              }
            />
            
            <Route
              path="/admin/crm/metricas"
              element={
                <AppLayout>
                  <AdminCrmMetricas />
                </AppLayout>
              }
            />
            <Route
              path="/admin/crm"
              element={
                <AppLayout>
                  <AdminCrmConfig />
                </AppLayout>
              }
            />
            {/* Chamados Técnicos */}
            <Route
              path="/chamados"
              element={
                <AppLayout>
                  <ChamadosIndex />
                </AppLayout>
              }
            />
            <Route
              path="/chamados/novo"
              element={
                <AppLayout>
                  <NovoChamado />
                </AppLayout>
              }
            />
            <Route
              path="/chamados/:id"
              element={
                <AppLayout>
                  <DetalheChamado />
                </AppLayout>
              }
            />
            <Route
              path="/chamados/visita/:visitId"
              element={
                <AppLayout>
                  <ExecucaoVisitaCorretiva />
              </AppLayout>
            }
          />

          {/* Documentação do Sistema */}
          <Route
            path="/docs"
            element={
              <AppLayout>
                <DocsIndex />
              </AppLayout>
            }
          />
          <Route
            path="/docs/novo"
            element={
              <AppLayout>
                <DocEditor />
              </AppLayout>
            }
          />
          <Route
            path="/docs/chat"
            element={
              <AppLayout>
                <DocChat />
              </AppLayout>
            }
          />
          <Route
            path="/docs/:slug"
            element={
              <AppLayout>
                <DocView />
              </AppLayout>
            }
          />
          <Route
            path="/docs/:slug/editar"
            element={
              <AppLayout>
                <DocEditor />
              </AppLayout>
            }
          />
            
          <Route path="*" element={<NotFound />} />
        </Routes>
          </TooltipProvider>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
