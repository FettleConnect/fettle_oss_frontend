import { useState, useEffect } from "react";
import axios from "axios";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import GoogleLoginPage from "@/components/auth/GoogleLogin";
import { DoctorLogin } from "@/components/auth/DoctorLogin";
import { PatientView } from "@/components/patient/PatientView";
import { DoctorDashboard } from "@/components/doctor/DoctorDashboard";
import NotFound from "./pages/NotFound";
import { BASE_URL } from "@/base_url";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";

const queryClient = new QueryClient();

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

// Patient Route Component - handles authToken
const PatientRoute = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const validatePatientToken = async (token: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/validate_token/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      
      if (data.error === 0) {
        setUser({ role: 'patient', name: data.name, email: data.email });
      } else {
        console.error('Token validation failed:', data.msg);
        setUser(null);
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      setUser(null);
      localStorage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      validatePatientToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Listen for Supabase Auth State Change (Handling Magic Link Click)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userEmail = session.user.email;
        const userName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        userEmail?.split('@')[0] || 'User';
        
        try {
          const response = await axios.post(`${BASE_URL}/auth/google/`, {
            token: session.access_token, 
            is_magic_link: true,
            email: userEmail,
            name: userName
          });

          const data = response.data;
          localStorage.setItem('authToken', data.token);
          setUser({ role: 'patient', name: userName, email: userEmail });
          
          toast({
            title: "Welcome!",
            description: `Successfully authenticated as ${userName}.`,
          });
        } catch (error) {
          console.error("Backend sync failed:", error);
          toast({
            title: "Authentication Error",
            description: "Failed to sync with the server. Please try logging in again.",
            variant: "destructive"
          });
          localStorage.removeItem('authToken');
          setUser(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <PatientView user={user} onLogout={handleLogout} />;
  }

  return <GoogleLoginPage onLogin={handleLogin} />;
};

// Doctor Route Component - handles DoctorToken
const DoctorRoute = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const validateDoctorToken = async (token: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/validate_token/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      
      if (data.error === 0) {
        setUser({ role: 'doctor', name: data.name, email: data.email });
      } else {
        console.error('Doctor token validation failed:', data.msg);
        setUser(null);
        localStorage.removeItem('DoctorToken');
      }
    } catch (error) {
      console.error('Doctor token validation failed:', error);
      setUser(null);
      localStorage.removeItem('DoctorToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('DoctorToken');
    if (token) {
      validateDoctorToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('DoctorToken');
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (user) {
    return <DoctorDashboard user={user} onLogout={handleLogout} />;
  }

  return <DoctorLogin />;
};

const App = () => {
  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "test";
  
  return (
    <PayPalScriptProvider options={{ "client-id": paypalClientId, currency: "USD" }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<PatientRoute />} />
                <Route path="/doctor-login" element={<DoctorRoute />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </PayPalScriptProvider>
  );
};

export default App;