import React, { useState, useEffect, useCallback } from 'react';
import { ConversationList } from './ConversationList';
import { DoctorChatView } from './DoctorChatView';
import { SystemPromptEditor } from './SystemPromptEditor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Stethoscope, RefreshCw, Menu, X, Users, Settings } from 'lucide-react';
import { Conversation, Message } from '@/types/dermatology';
import { BASE_URL } from '@/base_url';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sum } from 'recharts'; // Dummy import or ignore if Sum not needed in frontend

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
  is_read?: boolean;
  updated_at?: string;
}

interface ConvMessage {
  id: string;
  role: string; // Can be 'doctor', 'AI', 'ai', or email (patient)
  content: string;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'active' | 'completed'>('all');
  const [activeView, setActiveView] = useState<'patients' | 'settings'>('patients');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/doctor_tabs/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      
      if (data.tabs_doc && Array.isArray(data.tabs_doc)) {
        const convs: Conversation[] = data.tabs_doc.map((tab: TabDoc) => {
          const isPaid = String(tab.payment_status).toUpperCase() === 'PAID';
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
            patient_id: String(tab.patient_id), // Map the patient user ID
            patientEmail: tab.email,
            patientName: tab.name,
            mode: tab.mode as any || (isPaid ? 'post_payment_intake' : 'general_education'),
            paymentStatus: isPaid ? 'paid' : 'unpaid',
            status: tab.status as any || (tab.active ? 'active' : 'not_active'),
            intakeData: Object.values(intakeData).some(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)) ? intakeData : undefined,
            draftResponse: tab.doctor_draft || undefined,
            is_read: tab.is_read,
            updatedAt: tab.updated_at ? new Date(tab.updated_at) : undefined
          };
        });
        setConversations(convs);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error', description: 'Failed to load conversations.', variant: 'destructive' });
    }
  }, [toast]);

  const loadConversationMessages = useCallback(async (id: string) => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/doctor_conversation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      
      if (data.conv && Array.isArray(data.conv)) {
        const msgs: Message[] = data.conv.map((msg: ConvMessage) => {
          let role: 'patient' | 'ai' | 'doctor' = 'patient';
          let senderName = msg.role;
          if (msg.role === 'ai') { role = 'ai'; senderName = 'AI'; }
          else if (msg.role === 'doctor') { role = 'doctor'; senderName = 'You'; }
          
          return {
            id: msg.id,
            conversationId: id,
            role,
            content: msg.content,
            images: msg.images,
            timestamp: new Date(),
            isVisible: true,
            senderName,
          };
        });
        setSelectedMessages(msgs);
        
        // Update local read status
        setConversations(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  useEffect(() => {
    if (selectedId) {
      const conv = conversations.find(c => c.id === selectedId);
      setSelectedConversation(conv || null);
      if (conv) loadConversationMessages(selectedId);
    } else {
      setSelectedConversation(null);
      setSelectedMessages([]);
    }
  }, [selectedId, loadConversationMessages, refreshKey]);

  const handleUpdate = () => setRefreshKey(k => k + 1);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Patients
          </h2>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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
          onSelect={(id) => {
            setSelectedId(id);
            if (isMobile) setIsSidebarOpen(false);
          }}
          filter={filter}
        />
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Stethoscope className="h-4 w-4 md:h-5 md:w-5 text-green-700 dark:text-green-300" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-foreground leading-none">Doctor Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeView === 'patients' ? (
            <Button variant="outline" size="sm" onClick={() => setActiveView('settings')} className="h-8 md:h-9">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              <span>Settings</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setActiveView('patients')} className="h-8 md:h-9">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              <span>Patients</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadConversations} className="h-8 md:h-9">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden xs:inline">Sync</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="h-8 md:h-9">
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-80 border-r border-border flex flex-col bg-card">
            <SidebarContent />
          </div>
        )}

        {/* Mobile Sidebar (Sheet) */}
        {isMobile && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="p-0 w-80">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeView === 'settings' ? (
            <SystemPromptEditor />
          ) : selectedConversation ? (
            <DoctorChatView
              conversation={selectedConversation}
              messages={selectedMessages}
              onUpdate={handleUpdate}
              onRefresh={() => {
                loadConversations();
                loadConversationMessages(selectedId!);
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center p-6">
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Select a patient to begin review</p>
                {isMobile && (
                  <Button variant="outline" size="sm" onClick={() => setIsSidebarOpen(true)} className="mt-4">
                    View Patient List
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};