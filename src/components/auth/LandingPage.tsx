import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope, User, TestTube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const { testLoginAsPatient } = useAuth();
  const navigate = useNavigate();

  const handleTestPatient = () => {
    testLoginAsPatient();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            OnlineSkinSpecialist
          </h1>
          <p className="text-muted-foreground">
            Professional dermatology consultations online
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Patient Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <User className="h-7 w-7 text-primary" />
              </div>
              <CardTitle>Patient Access</CardTitle>
              <CardDescription>
                Start a skin consultation with our AI educational assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleTestPatient} 
                className="w-full"
                size="lg"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test as Patient
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Simulates WordPress email verification flow
              </p>
            </CardContent>
          </Card>

          {/* Doctor Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <Stethoscope className="h-7 w-7 text-green-700 dark:text-green-300" />
              </div>
              <CardTitle>Doctor Portal</CardTitle>
              <CardDescription>
                Access the dermatologist dashboard to review cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => navigate('/doctor-login')} 
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Stethoscope className="h-4 w-4 mr-2" />
                Doctor Login
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Use: doctor@test.com / doctor123
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            This is a demo application for testing the dermatology consultation workflow.
          </p>
        </div>
      </div>
    </div>
  );
};
