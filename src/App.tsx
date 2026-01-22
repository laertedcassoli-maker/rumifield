import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Teste from "./pages/Teste";
import Instalar from "./pages/Instalar";
import Nfc from "./pages/Nfc";
import NotFound from "./pages/NotFound";

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
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TooltipProvider>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
