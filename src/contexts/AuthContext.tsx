import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User, UserRole, DOCTOR_CREDENTIALS } from '@/types/dermatology';
import { setCurrentUser, getCurrentUser, logout as logoutStore } from '@/store/dataStore';
import { BASE_URL } from '@/base_url';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsPatient: (email: string, name: string, token?: string) => void;
  loginAsDoctor: (email: string, password: string) => boolean;
  logout: () => void;
  testLoginAsPatient: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const validateTokenAndSetUser = async (token: string) => {
    try {
      const response = await axios.get(`${BASE_URL}:8000/api/validate_token/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      
      if (data.error === 0) {
        const role: UserRole = data.role === 'Admin' ? 'doctor' : 'patient';
        const validatedUser: User = {
          id: token,
          email: data.email || '',
          name: data.name,
          role: role,
        };
        setUser(validatedUser);
        setCurrentUser(validatedUser);
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
    // Check for existing auth token
    const token = localStorage.getItem('authToken');
    if (token) {
      // If token exists, validate it and get user info
      validateTokenAndSetUser(token);
    } else {
      // Check for existing session in store
      const storedUser = getCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      }

      // Check URL for token (simulating WordPress redirect)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const email = params.get('email');
      const name = params.get('name');

      if (urlToken && email) {
        loginAsPatient(email, name || 'Patient', urlToken);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setIsLoading(false);
    }
  }, []);

  const loginAsPatient = (email: string, name: string, token?: string) => {
    const newUser: User = {
      id: token || `patient_${Date.now()}`,
      email,
      name,
      role: 'patient',
    };
    setUser(newUser);
    setCurrentUser(newUser);
  };

  const loginAsDoctor = (email: string, password: string): boolean => {
    if (email === DOCTOR_CREDENTIALS.email && password === DOCTOR_CREDENTIALS.password) {
      const doctorUser: User = {
        id: 'doctor_1',
        email: DOCTOR_CREDENTIALS.email,
        name: 'Dr. Smith',
        role: 'doctor',
      };
      setUser(doctorUser);
      setCurrentUser(doctorUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    logoutStore();
  };

  const testLoginAsPatient = () => {
    loginAsPatient('test@patient.com', 'Test Patient', 'test_token_123');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginAsPatient,
        loginAsDoctor,
        logout,
        testLoginAsPatient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
