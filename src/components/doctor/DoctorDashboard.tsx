import React, { useState, useEffect, useCallback } from 'react';
import { ConversationList } from './ConversationList';
import { DoctorChatView } from './DoctorChatView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Stethoscope, RefreshCw } from 'lucide-react';
import { Conversation, Message } from '@/types/dermatology';
import { BASE_URL } from '@/base_url';
import { useToast } from '@/hooks/use-toast';

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

interface DoctorDashboardProps {
  user: User;
  onLogout: () => void;
}

interface TabDoc {
  id: string | number;
  name: string;
  email: string;
  payment_status: string; // PAID or UNPAID
  active: boolean;
  intake_data?: any;
  doctor_draft?: string;
  total_paid?: number;
}

interface ConvMessage {
  id: string;
  role: string; // Can be 'doctor', 'AI', 'ai', or email (patient)
  content: string;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'active' | 'completed'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadConversations = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}:8000/api/doctor_tabs/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      
      if (data.tabs_doc && Array.isArray(data.tabs_doc)) {
        // Transform API response to Conversation format
        const convs: Conversation[] = data.tabs_doc.map((tab: TabDoc) => {
          // Handle various payment_status formats from API (PAID, UNPAID, paid, unpaid, etc.)
          const paymentStatusUpper = String(tab.payment_status).toUpperCase();
          const isPaid = paymentStatusUpper === 'PAID';
          
          // Map backend snake_case to frontend camelCase
          const rawIntake = tab.intake_data || {};
          const intakeData = {
            duration: rawIntake.duration || '',
            symptoms: rawIntake.symptoms || '',
            location: rawIntake.location || '',
            medicationsTried: rawIntake.medications_tried || rawIntake.meds || '',
            priorDiagnoses: rawIntake.prior_diagnoses || '',
            relevantHealthHistory: rawIntake.relevant_health_history || rawIntake.history || '',
            images: rawIntake.images || [],
          };

          return {
            id: String(tab.id),
            patientEmail: tab.email,
            patientName: tab.name,
            mode: isPaid ? 'post_payment_intake' : 'general_education' as const,
            paymentStatus: isPaid ? 'paid' : 'unpaid',
            status: tab.active ? 'active' : 'not_active',
            intakeData: Object.values(intakeData).some(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)) ? intakeData : undefined,
            draftResponse: tab.doctor_draft || undefined,
          };
        });
        setConversations(convs);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversations.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  // Fetch conversation messages
  const loadConversationMessages = useCallback(async (id: string) => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}:8000/api/doctor_conversation/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation messages');
      }

      const data = await response.json();
      
      if (data.conv && Array.isArray(data.conv)) {
        // Transform API response to Message format
        const msgs: Message[] = data.conv.map((msg: ConvMessage) => {
          // Role can be: 'doctor', 'ai'/'AI', or email (patient)
          let role: 'patient' | 'ai' | 'doctor' = 'patient';
          let senderName = msg.role; // Store original role value
          
          if (msg.role === 'AI' || msg.role === 'ai') {
            role = 'ai';
            senderName = 'AI';
          } else if (msg.role === 'doctor') {
            role = 'doctor';
            senderName = 'You'; // Doctor viewing their own messages
          }
          // Any other role (like email) is treated as patient, senderName shows the email
          
          return {
            id: msg.id,
            conversationId: id,
            role,
            content: msg.content,
            timestamp: new Date(),
            isVisible: true,
            senderName,
          };
        });
        setSelectedMessages(msgs);
      }
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversation messages.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (selectedId) {
      const conv = conversations.find(c => c.id === selectedId);
      setSelectedConversation(conv || null);
      if (conv) {
        // Load messages from API
        loadConversationMessages(selectedId);
      }
    } else {
      setSelectedConversation(null);
      setSelectedMessages([]);
    }
  }, [selectedId, conversations, loadConversationMessages]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const handleUpdate = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-green-700 dark:text-green-300" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Doctor Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold mb-3">Patient Conversations</h2>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="paid" className="text-xs">Paid</TabsTrigger>
                <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-auto">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {selectedConversation ? (
            <DoctorChatView
              conversation={selectedConversation}
              messages={selectedMessages}
              onUpdate={handleUpdate}
              onRefresh={() => {
                loadConversations(); // Reload intake data and payment status
                loadConversationMessages(selectedId!); // Reload messages
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Select a conversation to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
