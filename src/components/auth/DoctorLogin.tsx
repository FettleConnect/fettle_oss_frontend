import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope, AlertCircle, ArrowLeft, HeartPulse, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';

export const DoctorLogin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/login/`, {
        email,
        password,
      });

      const data = response.data;
      
      if (data.error === 0 && data.token) {
        localStorage.setItem('DoctorToken', data.token);
        toast({
          title: 'Authentication Successful',
          description: 'Access granted to Clinical Portal.',
        });
        window.location.reload();
      } else {
        setError(data.msg || 'Invalid credentials or unauthorized access');
      }
    } catch (err) {
      setError('Invalid credentials or unauthorized access');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50/50 p-4 py-20">
      <Card className="w-full max-w-md shadow-2xl shadow-navy/10 border-gray-100 rounded-3xl overflow-hidden">
        <div className="bg-navy p-8 text-white text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-2 shadow-lg">
            <Stethoscope className="h-8 w-8 text-navy" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight uppercase">Clinical Portal</CardTitle>
            <CardDescription className="text-accent-blue font-bold text-[10px] uppercase tracking-widest mt-1 opacity-90">
              Dermatologist Secure Access
            </CardDescription>
          </div>
        </div>

        <CardContent className="p-8 space-y-6 bg-white">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-navy font-bold uppercase text-[10px] tracking-widest ml-1">Professional Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@test.com"
                required
                className="h-12 border-gray-200 rounded-xl focus:ring-navy focus:border-navy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-navy font-bold uppercase text-[10px] tracking-widest ml-1">Access Pin/Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 border-gray-200 rounded-xl focus:ring-navy focus:border-navy"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10 text-xs font-bold uppercase tracking-tight">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-12 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-navy/20 transition-all" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Sign In to Portal'}
            </Button>
          </form>

          <div className="pt-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-accent-blue" />
                Security Notice
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                This is a secure medical environment. All access attempts are logged and monitored. Authorized clinical personnel only.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-gray-400 hover:text-navy font-bold uppercase text-[10px] tracking-widest">
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Public Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
