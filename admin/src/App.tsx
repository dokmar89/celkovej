import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { SidebarProvider } from "@/components/ui/sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Verifications from "./pages/Verifications";
import Finance from "./pages/Finance";
import Security from "./pages/Security";
import Helpdesk from "./pages/Helpdesk";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <SidebarProvider>
              <div className="min-h-screen flex w-full bg-background">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute>
                        <AdminLayout>
                          <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/companies" element={<Companies />} />
                            <Route path="/verifications" element={<Verifications />} />
                            <Route path="/finance" element={<Finance />} />
                            <Route path="/security" element={<Security />} />
                            <Route path="/helpdesk" element={<Helpdesk />} />
                          </Routes>
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Login />} />
                </Routes>
              </div>
            </SidebarProvider>
          </AuthProvider>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;