import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_URL } from '@/base_url';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, HeartPulse } from 'lucide-react';
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
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50/50 p-4 py-20">
      <Card className="w-full max-w-md shadow-2xl shadow-navy/10 border-gray-100 rounded-3xl overflow-hidden">
        <div className="bg-navy p-8 text-white text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-2 shadow-lg">
            <HeartPulse className="h-8 w-8 text-navy" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight uppercase">Patient Access</CardTitle>
            <CardDescription className="text-accent-blue font-bold text-[10px] uppercase tracking-widest mt-1 opacity-90">
              Online Skin Specialist Portal
            </CardDescription>
          </div>
        </div>
        
        <CardContent className="p-8 space-y-8 bg-white">
          {/* Magic Link Section */}
          <form onSubmit={handleMagicLinkLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-navy font-bold uppercase text-[10px] tracking-widest ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 h-12 border-gray-200 rounded-xl focus:ring-navy focus:border-navy"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-navy/20 transition-all" 
              disabled={isMagicLinkLoading || isGoogleLoading}
            >
              {isMagicLinkLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Get Magic Link
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-white px-4 text-gray-400 font-bold italic">Corporate Authentication</span>
            </div>
          </div>

          <div className="flex justify-center flex-col space-y-4">
            {isGoogleLoading ? (
              <div className="flex flex-col items-center py-2">
                <Loader2 className="h-8 w-8 animate-spin text-navy" />
              </div>
            ) : (
              <div className="w-full flex justify-center scale-105">
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
                  shape="pill"
                  size="large"
                  width="350"
                />
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <p className="text-[10px] text-gray-400 leading-relaxed max-w-[280px] mx-auto font-medium uppercase tracking-tight">
              By entering, you accept our <a href="#" className="text-navy font-bold underline decoration-accent-blue/30">Terms</a> and <a href="#" className="text-navy font-bold underline decoration-accent-blue/30">Privacy Standards</a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleLoginPage;