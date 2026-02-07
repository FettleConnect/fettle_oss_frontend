import React, { useState, useEffect, useCallback } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { PaymentPage } from '@/components/payment/PaymentPage';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, CreditCard } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

interface PatientViewProps {
  user: User;
  onLogout: () => void;
}

interface ChatMessage {
  id: string;
  role: string; // Can be 'user', 'AI', 'doctor', or email
  content: string;
}

export const PatientView: React.FC<PatientViewProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ConversationMode>('general_education');
  const [intakeStep, setIntakeStep] = useState(0);
  const [intakeData, setIntakeData] = useState({
    duration: '',
    symptoms: '',
    location: '',
    meds: '',
    history: '',
    images: [] as string[]
  });

  const INTAKE_QUESTIONS = [
    "1. How long has this skin concern been present? (Duration)",
    "2. What symptoms are you experiencing? (e.g. itching, pain, bleeding, spreading)",
    "3. Where on your body is this located?",
    "4. Have you tried any medications or creams for this? If so, which ones?",
    "5. Have you had any prior diagnoses for this or other skin conditions?",
    "6. Do you have any other relevant medical history or allergies? (Final question - please also upload any photos if you haven't already)",
  ];

  // Fetch chat history on mount
  const fetchChatHistory = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${BASE_URL}:8000/api/chat_history/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }

      const data = await response.json();
      if (data.conv && Array.isArray(data.conv)) {
        setMessages(data.conv);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat history.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  const handleSendMessage = async (content: string, images?: string[]) => {
    // If images included, add note about them
    let messageContent = content;
    if (images && images.length > 0) {
      messageContent += `\n\n[${images.length} image(s) attached]`;
      if (mode === 'post_payment_intake') {
        setIntakeData(prev => ({ ...prev, images: [...prev.images, ...images] }));
      }
    }

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
    };
    setMessages(prev => [...prev, userMessage]);

    // Handle Guided Intake
    if (mode === 'post_payment_intake') {
      const currentStepKey = ['duration', 'symptoms', 'location', 'meds', 'history', 'history'][intakeStep];
      setIntakeData(prev => ({ ...prev, [currentStepKey]: content }));

      if (content.toUpperCase().trim() === 'DONE' || intakeStep >= INTAKE_QUESTIONS.length - 1) {
        setIsLoading(true);
        try {
          const authToken = localStorage.getItem('authToken');
          // Send final DONE to backend to trigger review mode
          const formData = new FormData();
          formData.append('question', `INTAKE COMPLETE. Summary: 
Duration: ${intakeData.duration}
Symptoms: ${intakeData.symptoms}
Location: ${intakeData.location}
Meds: ${intakeData.meds}
History: ${intakeData.history}
Images: ${intakeData.images.length} attached.
DONE`);
          
          await fetch(`${BASE_URL}:8000/api/chat_view/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
          });

          setMode('dermatologist_review');
          const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'AI',
            content: "Thank you. I have collected all the necessary information. Our dermatologist, Dr. Attili, will now review your case. You will be notified once the review is complete.",
          };
          setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
          console.error('Error completing intake:', error);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Next question
      const nextStep = intakeStep + 1;
      setIntakeStep(nextStep);
      setIsLoading(true);
      setTimeout(() => {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'AI',
          content: INTAKE_QUESTIONS[nextStep],
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
      }, 500);
      return;
    }

    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', messageContent);
      
      if (images && images.length > 0) {
        // Convert each base64 data URL to Blob and append as file
        for (let i = 0; i < images.length; i++) {
          const dataUrl = images[i];
          const response_blob = await fetch(dataUrl);
          const blob = await response_blob.blob();
          formData.append('image', blob, `image_${i + 1}.jpg`);
        }
      }
      
      const response = await fetch(`${BASE_URL}:8000/api/chat_view/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Add AI response to messages
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: data.role || 'AI',
        content: data.result,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      // Remove the user message if the request failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: ConversationMode) => {
    setMode(newMode);
  };

  const handlePaymentSuccess = async () => {
    setMode('post_payment_intake');
    setIntakeStep(0);
    setIntakeData({
      duration: '',
      symptoms: '',
      location: '',
      meds: '',
      history: '',
      images: []
    });
    
    const paymentMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: "Thank you for your payment! You're now connected to our intake process.",
    };
    setMessages(prev => [...prev, paymentMessage]);

    // Show first question
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'AI',
        content: "To help our dermatologist provide an accurate review, please answer a few questions.\n\n" + INTAKE_QUESTIONS[0],
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);

    // Inform backend of payment confirmation
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'PAYMENT_CONFIRMED');
      
      await fetch(`${BASE_URL}:8000/api/chat_view/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });
    } catch (error) {
      console.error('Error confirming payment to backend:', error);
    }

    toast({
      title: 'Payment Successful',
      description: 'You can now provide details for your consultation.',
    });
  };

  const handlePaymentCancel = () => {
    setMode('general_education');
    toast({
      title: 'Payment Cancelled',
      description: 'You can continue with educational chat.',
    });
  };

  const handleRefresh = () => {
    fetchChatHistory();
    toast({
      title: 'Refreshed',
      description: 'Chat history updated.',
    });
  };

  // Transform messages to match ChatContainer expected format
  const transformedMessages = messages.map(msg => {
    // Role can be: 'user' (patient), 'AI', 'doctor', 'system'
    let role: 'patient' | 'ai' | 'doctor' | 'system' = 'patient';
    
    if (msg.role === 'AI' || msg.role === 'ai') {
      role = 'ai';
    } else if (msg.role === 'doctor') {
      role = 'doctor';
    } else if (msg.role === 'system') {
      role = 'system';
    }
    // 'user' or any other role (like email) is treated as patient
    
    return {
      id: msg.id,
      role,
      content: msg.content,
      conversationId: '',
      timestamp: new Date(),
      isVisible: true,
    };
  });

  // Show payment page
  if (mode === 'payment_page') {
    return (
      <div className="h-screen">
        <PaymentPage onPaymentSuccess={handlePaymentSuccess} onCancel={handlePaymentCancel} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Logged in as: <span className="font-medium text-foreground">{user?.email}</span>
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="default" size="sm" onClick={() => setMode('payment_page')}>
            <CreditCard className="h-4 w-4 mr-1" />
            Payment
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatContainer
          messages={transformedMessages}
          streamingContent=""
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          mode={mode}
          showDisclaimer={messages.length === 0}
        />
      </div>
    </div>
  );
};
