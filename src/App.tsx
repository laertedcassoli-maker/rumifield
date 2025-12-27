import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
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
import Teste from "./pages/Teste";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <AppLayout>
                  <Dashboard />
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
              path="/teste"
              element={
                <AppLayout>
                  <Teste />
                </AppLayout>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
