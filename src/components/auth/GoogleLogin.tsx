import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useState } from "react";
import { BASE_URL } from "@/base_url";

const API_BASE = BASE_URL + ":8000";

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

interface GoogleLoginPageProps {
  onLogin: (user: User) => void;
}

export default function GoogleLoginPage({ onLogin }: GoogleLoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/auth/google/`, {
        token: credentialResponse.credential,
      });

      // Store the token as authToken for validation on refresh
      localStorage.setItem("authToken", res.data.token);
      
      // Call onLogin with user data
      const role = res.data.user.role === 'Admin' ? 'doctor' : 'patient';
      onLogin({ 
        role, 
        name: res.data.user.name, 
        email: res.data.user.email 
      });
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error("Google login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Clear Skin AI</h1>
          <p className="text-gray-600">Sign in to access your skin health dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center py-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2" />
            <p className="text-gray-600">Signing you in...</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <GoogleLogin 
              onSuccess={onSuccess} 
              onError={() => setError("Google sign-in failed. Please try again.")}
              theme="outline"
              size="large"
              width="300"
            />
          </div>
        )}

        <p className="text-xs text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}