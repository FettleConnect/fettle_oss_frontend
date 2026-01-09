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
      messageContent += `\n\n[${images.length} image(s) attached for review]`;
    }

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
    };
    setMessages(prev => [...prev, userMessage]);
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

  const handlePaymentSuccess = () => {
    setMode('post_payment_intake');
    const paymentMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: "Thank you for your payment! You're now connected to our intake process.\n\nPlease describe your skin concern in detail. I'll ask you some follow-up questions to gather all the information our dermatologist needs.\n\nWhen you've shared everything, type DONE to submit your case for review.",
    };
    setMessages(prev => [...prev, paymentMessage]);
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
    // Role can be: 'user' (patient), 'AI', 'doctor'
    let role: 'patient' | 'ai' | 'doctor' = 'patient';
    
    if (msg.role === 'AI' || msg.role === 'ai') {
      role = 'ai';
    } else if (msg.role === 'doctor') {
      role = 'doctor';
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
