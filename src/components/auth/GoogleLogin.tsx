import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_URL } from '@/base_url';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, Chrome, Stethoscope } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const API_BASE = BASE_URL;

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

interface GoogleLoginPageProps {
  onLogin: (user: User) => void;
}

const GoogleLoginPage: React.FC<GoogleLoginPageProps> = ({ onLogin }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsMagicLinkLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      toast({
        title: "Magic Link Sent",
        description: "Check your email inbox for the login link.",
      });
    } catch (error: any) {
      console.error("Magic link failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send magic link.",
        variant: "destructive"
      });
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsGoogleLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/google/`, {
        token: credentialResponse.credential,
      });

      const data = response.data;
      localStorage.setItem('authToken', data.token);
      
      const role = data.user.role === 'Admin' ? 'doctor' : 'patient';
      onLogin({ role, name: data.user.name, email: data.user.email });
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${data.user.name}!`,
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none rounded-2xl overflow-hidden">
        <div className="bg-primary p-6 text-primary-foreground text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-2 backdrop-blur-sm">
            <Stethoscope className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">Fettle OSS</CardTitle>
          <CardDescription className="text-blue-100/80 font-medium">
            AI-Powered Dermatology Assistant
          </CardDescription>
        </div>
        
        <CardContent className="p-8 space-y-8 bg-white">
          {/* Magic Link Section */}
          <form onSubmit={handleMagicLinkLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-semibold">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 border-gray-200 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-bold shadow-lg hover:shadow-xl transition-all" 
              disabled={isMagicLinkLoading || isGoogleLoading}
            >
              {isMagicLinkLoading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Mail className="h-5 w-5 mr-2" />
              )}
              Send Magic Link
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-white px-4 text-gray-400 font-bold">Or</span>
            </div>
          </div>

          <div className="flex justify-center flex-col space-y-4">
            {isGoogleLoading ? (
              <div className="flex flex-col items-center py-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    toast({
                      title: "Google Login Failed",
                      description: "Could not authenticate with Google.",
                      variant: "destructive",
                    });
                  }}
                  useOneTap
                  theme="filled_blue"
                  shape="rectangular"
                  size="large"
                  width="350"
                />
              </div>
            )}
          </div>

          <div className="text-center space-y-4">
            <p className="text-[10px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
              By signing in, you agree to our <a href="#" className="underline hover:text-primary">Terms of Service</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleLoginPage;