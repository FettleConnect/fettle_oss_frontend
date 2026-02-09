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

const queryClient = new QueryClient();

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

// Patient Route Component - handles authToken
const PatientRoute = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const validatePatientToken = async (token: string) => {
    try {
      const response = await axios.get(`${BASE_URL}:8000/api/validate_token/`, {
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

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      const response = await axios.get(`${BASE_URL}:8000/api/validate_token/`, {
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
      <div className="min-h-screen flex items-center justify-center">
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
    <PayPalScriptProvider options={{ "client-id": paypalClientId, currency: "INR" }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<PatientRoute />} />
              <Route path="/doctor-login" element={<DoctorRoute />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </PayPalScriptProvider>
  );
};

export default App;